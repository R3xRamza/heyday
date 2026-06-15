import db from '../db.js';
import { computeDueDate, resolveAnchorDate } from './timing.js';

export function recalculateTransactionTasks(transactionId) {
  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
  if (!transaction) return 0;

  const tasks = db.prepare(`
    SELECT t.id, tt.timing_value, tt.timing_direction, tt.timing_anchor
    FROM tasks t
    INNER JOIN template_tasks tt ON tt.id = t.template_task_id
    WHERE t.transaction_id = ?
  `).all(transactionId);

  const update = db.prepare('UPDATE tasks SET due_date = ? WHERE id = ?');
  let updated = 0;

  db.transaction(() => {
    for (const task of tasks) {
      const anchor = resolveAnchorDate(transaction, task.timing_anchor);
      const dueDate = computeDueDate(anchor, task.timing_value, task.timing_direction);
      update.run(dueDate, task.id);
      updated += 1;
    }
  })();

  return updated;
}

export const ANCHOR_DATE_FIELDS = [
  'close_date',
  'listing_date',
  'acceptance_date',
  'option_end_date',
  'important_date',
  'created_at',
];

export function anchorDatesChanged(before, after) {
  return (
    before.close_date !== after.close_date
    || before.listing_date !== after.listing_date
    || before.acceptance_date !== after.acceptance_date
    || before.option_end_date !== after.option_end_date
    || before.important_date !== after.important_date
  );
}
