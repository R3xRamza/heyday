import { MARKETING_90_DAY_TEMPLATE_NAME } from './checklist-templates.js';

function marketing90TemplateId(db) {
  return db.prepare('SELECT id FROM checklist_templates WHERE name = ?')
    .get(MARKETING_90_DAY_TEMPLATE_NAME)?.id ?? null;
}

function completeOpenMarketing90Tasks(db, { transactionId = null } = {}) {
  const templateId = marketing90TemplateId(db);
  if (!templateId) return { completed: 0 };

  const completedAt = new Date().toISOString();
  // Placeholder order must match SQL: completedAt, [transactionId], templateId, templateId
  const params = [completedAt];
  let txnFilter = '';
  if (transactionId != null) {
    txnFilter = 'AND transaction_id = ?';
    params.push(Number(transactionId));
  } else {
    txnFilter = "AND transaction_id IN (SELECT id FROM transactions WHERE stage = 'closed')";
  }
  params.push(templateId, templateId);

  const result = db.prepare(`
    UPDATE tasks
    SET status = 'complete', completed_at = COALESCE(completed_at, ?)
    WHERE status != 'complete'
      ${txnFilter}
      AND (
        template_task_id IN (SELECT id FROM template_tasks WHERE template_id = ?)
        OR title IN (SELECT title FROM template_tasks WHERE template_id = ?)
      )
  `).run(...params);

  return { completed: result.changes };
}

/** Complete open Marketing 90 Day Plan tasks on one transaction (e.g. just closed). */
export function completeMarketing90DayTasksForTransaction(db, transactionId) {
  if (!transactionId) return { completed: 0 };
  return completeOpenMarketing90Tasks(db, { transactionId: Number(transactionId) });
}

/** Idempotent: complete open Marketing 90 Day Plan tasks on all closed transactions. */
export function completeMarketing90DayTasksForClosed(db) {
  return completeOpenMarketing90Tasks(db);
}
