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
  const insertActivity = db.prepare(`
    INSERT INTO transaction_activity (transaction_id, user_id, event_type, summary, detail, task_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const row of rows) {
      update.run(row.id);
      insertActivity.run(
        row.id,
        null,
        'stage_change',
        'Auto-closed — closing date passed',
        row.close_date,
        null,
      );
    }
  })();

  return { closed: rows.length };
}
