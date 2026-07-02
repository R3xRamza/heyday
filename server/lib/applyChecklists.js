import { computeDueDate, resolveAnchorDate } from './timing.js';
import { resolveAssigneeId, resolveTaskPriority, resolveTaskRole } from './taskAssignment.js';
import { logActivity, actorLabel } from './activity.js';
import {
  getTransactionChecklists,
  linkTemplateToTransaction,
  unlinkTemplateFromTransaction,
  syncTransactionChecklistLinks,
  isChecklistAppliedToTransaction,
} from './transactionChecklists.js';

/**
 * Apply one or more checklist templates to a transaction.
 * Skips template_task rows already present (by template_task_id).
 */
export function applyChecklistsToTransaction(db, transactionId, templateIds, user) {
  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
  if (!transaction) return { error: 'not_found', status: 404 };

  const ids = [...new Set(templateIds.map(Number).filter(Boolean))];
  if (ids.length === 0) return { error: 'template_ids required', status: 400 };

  const existingTemplateTaskIds = new Set(
    db.prepare(`
      SELECT template_task_id FROM tasks
      WHERE transaction_id = ? AND template_task_id IS NOT NULL
    `).all(transactionId).map((r) => r.template_task_id),
  );

  const insert = db.prepare(`
    INSERT INTO tasks (title, due_date, status, transaction_id, template_task_id, priority, assigned_to, category)
    VALUES (?, ?, 'pending', ?, ?, ?, ?, 'transaction')
  `);

  const created = [];
  const appliedNames = [];
  const inSetup = transaction.workflow_status && transaction.workflow_status !== 'active';

  syncTransactionChecklistLinks(db, transactionId);
  let nextSortOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM transaction_checklists WHERE transaction_id = ?',
  ).get(transactionId).m + 1;

  db.transaction(() => {
    for (const templateId of ids) {
      linkTemplateToTransaction(db, transactionId, templateId, nextSortOrder++);

      const template = db.prepare('SELECT name FROM checklist_templates WHERE id = ?').get(templateId);
      if (!template) continue;

      const templateTasks = db.prepare(
        'SELECT * FROM template_tasks WHERE template_id = ? ORDER BY sort_order',
      ).all(templateId);

      let addedFromTemplate = 0;
      for (const tt of templateTasks) {
        if (existingTemplateTaskIds.has(tt.id)) continue;

        const anchor = resolveAnchorDate(transaction, tt.timing_anchor);
        const dueDate = computeDueDate(anchor, tt.timing_value, tt.timing_direction);
        const role = tt.default_role || resolveTaskRole(tt.title);
        const assignedTo = resolveAssigneeId(db, tt.title, role);
        const priority = resolveTaskPriority(tt.title, role);
        const r = insert.run(tt.title, dueDate, transaction.id, tt.id, priority, assignedTo);
        existingTemplateTaskIds.add(tt.id);
        created.push(db.prepare('SELECT * FROM tasks WHERE id = ?').get(r.lastInsertRowid));
        addedFromTemplate += 1;
      }

      if (addedFromTemplate > 0) {
        appliedNames.push(template.name);
      }
    }

    const lastTemplateId = ids[ids.length - 1];
    if (inSetup) {
      db.prepare('UPDATE transactions SET checklist_template_id = ?, workflow_status = ? WHERE id = ?')
        .run(lastTemplateId, 'assign', transactionId);
    } else if (!transaction.checklist_template_id) {
      db.prepare('UPDATE transactions SET checklist_template_id = ? WHERE id = ?')
        .run(lastTemplateId, transactionId);
    }
  })();

  if (user && appliedNames.length > 0) {
    const actor = actorLabel(user);
    logActivity({
      transactionId: Number(transactionId),
      userId: user.id,
      eventType: 'checklist_added',
      summary: `${actor} added checklist(s): ${appliedNames.join(', ')}`,
    });
  } else if (user && ids.length > 0) {
    const linkedNames = ids
      .map((templateId) => db.prepare('SELECT name FROM checklist_templates WHERE id = ?').get(templateId)?.name)
      .filter(Boolean);
    if (linkedNames.length > 0) {
      const actor = actorLabel(user);
      logActivity({
        transactionId: Number(transactionId),
        userId: user.id,
        eventType: 'checklist_added',
        summary: `${actor} linked checklist(s): ${linkedNames.join(', ')}`,
      });
    }
  }

  const enrichedTasks = created.map((t) => enrichTaskWithTemplate(db, t));
  const checklists = getTransactionChecklists(db, transactionId);

  return { tasks: enrichedTasks, applied: appliedNames, checklists };
}

/**
 * Remove a checklist template from a transaction and delete its spawned tasks.
 */
export function removeChecklistFromTransaction(db, transactionId, templateId, user) {
  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
  if (!transaction) return { error: 'not_found', status: 404 };

  const templateIdNum = Number(templateId);

  if (!isChecklistAppliedToTransaction(db, transactionId, templateIdNum)) {
    return { error: 'checklist_not_linked', status: 404 };
  }

  const template = db.prepare('SELECT name FROM checklist_templates WHERE id = ?').get(templateIdNum);
  if (!template) return { error: 'template_not_found', status: 404 };

  const taskStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as completed
    FROM tasks t
    INNER JOIN template_tasks tt ON tt.id = t.template_task_id
    WHERE t.transaction_id = ? AND tt.template_id = ?
  `).get(transactionId, templateIdNum);

  const tasksRemoved = taskStats?.total ?? 0;

  db.transaction(() => {
    db.prepare(`
      DELETE FROM tasks
      WHERE transaction_id = ?
        AND template_task_id IN (SELECT id FROM template_tasks WHERE template_id = ?)
    `).run(transactionId, templateIdNum);

    unlinkTemplateFromTransaction(db, transactionId, templateIdNum);

    if (Number(transaction.checklist_template_id) === templateIdNum) {
      const next = db.prepare(`
        SELECT template_id FROM transaction_checklists
        WHERE transaction_id = ?
        ORDER BY sort_order ASC, template_id ASC
        LIMIT 1
      `).get(transactionId);
      db.prepare('UPDATE transactions SET checklist_template_id = ? WHERE id = ?')
        .run(next?.template_id ?? null, transactionId);
    }
  })();

  if (user) {
    const actor = actorLabel(user);
    const total = taskStats?.total ?? 0;
    const completed = taskStats?.completed ?? 0;
    const detail = total > 0
      ? `${total} task${total === 1 ? '' : 's'} removed (${completed} completed)`
      : null;
    logActivity({
      transactionId: Number(transactionId),
      userId: user.id,
      eventType: 'checklist_removed',
      summary: `${actor} removed checklist: ${template.name}`,
      detail,
    });
  }

  return {
    removed: template.name,
    tasksRemoved,
    checklists: getTransactionChecklists(db, transactionId),
  };
}

function enrichTaskWithTemplate(db, task) {
  if (!task?.template_task_id) return task;
  const row = db.prepare(`
    SELECT tt.template_id, ct.name AS template_name
    FROM template_tasks tt
    LEFT JOIN checklist_templates ct ON ct.id = tt.template_id
    WHERE tt.id = ?
  `).get(task.template_task_id);
  if (!row) return task;
  return { ...task, template_id: row.template_id, template_name: row.template_name };
}
