import { computeDueDate, resolveAnchorDate } from './timing.js';
import { resolveAssigneeId, resolveTaskPriority, resolveTaskRole } from './taskAssignment.js';
import { logActivity, actorLabel } from './activity.js';
import { linkTemplateToTransaction } from './transactionChecklists.js';

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
    INSERT INTO tasks (title, due_date, status, transaction_id, template_task_id, priority, assigned_to)
    VALUES (?, ?, 'pending', ?, ?, ?, ?)
  `);

  const created = [];
  const appliedNames = [];
  const appliedChecklists = [];

  db.transaction(() => {
    ids.forEach((templateId, index) => {
      linkTemplateToTransaction(db, transactionId, templateId, index);
    });

    for (const templateId of ids) {
      const template = db.prepare('SELECT name FROM checklist_templates WHERE id = ?').get(templateId);
      if (!template) continue;

      appliedChecklists.push({
        id: templateId,
        name: template.name,
        sort_order: ids.indexOf(templateId),
      });

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

      if (addedFromTemplate > 0) appliedNames.push(template.name);
    }

    const lastTemplateId = ids[ids.length - 1];
    db.prepare('UPDATE transactions SET checklist_template_id = ?, workflow_status = ? WHERE id = ?')
      .run(lastTemplateId, 'assign', transactionId);
  })();

  if (user && appliedNames.length > 0) {
    const actor = actorLabel(user);
    logActivity({
      transactionId: Number(transactionId),
      userId: user.id,
      eventType: 'checklist_added',
      summary: `${actor} added checklist(s): ${appliedNames.join(', ')}`,
    });
  }

  const enrichedTasks = created.map((t) => enrichTaskWithTemplate(db, t));

  return { tasks: enrichedTasks, applied: appliedNames, checklists: appliedChecklists };
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
