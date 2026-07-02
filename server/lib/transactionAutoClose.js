import { logActivity } from './activity.js';

/** True when close_date is strictly before today (local calendar date). */
export function isCloseDatePast(closeDate) {
  if (!closeDate || !String(closeDate).trim()) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${String(closeDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  return d < today;
}

/** Derive portfolio stage from close_date and current stage. */
export function deriveStageFromCloseDate(record) {
  if (record.stage === 'closed') return 'closed';
  if (record.close_date && isCloseDatePast(record.close_date)) return 'closed';
  if (record.close_date) return 'pending';
  return 'active';
}

/** Close transactions whose close_date has passed; idempotent. */
export function closePastDueTransactions(db) {
  const rows = db.prepare(`
    SELECT id, stage, close_date
    FROM transactions
    WHERE stage != 'closed'
      AND close_date IS NOT NULL
      AND TRIM(close_date) != ''
      AND close_date < date('now')
  `).all();

  if (rows.length === 0) return { closed: 0 };

  const update = db.prepare("UPDATE transactions SET stage = 'closed' WHERE id = ?");

  db.transaction(() => {
    for (const row of rows) {
      update.run(row.id);
      logActivity({
        transactionId: row.id,
        userId: null,
        eventType: 'stage_change',
        summary: 'Auto-closed — closing date passed',
        detail: row.close_date,
      });
    }
  })();

  return { closed: rows.length };
}
