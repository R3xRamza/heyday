/** Delete open tasks on a terminated deal. Completed tasks stay. */
export function cancelOpenTasksForTransaction(db, transactionId) {
  const openTasks = db.prepare(
    "SELECT id FROM tasks WHERE transaction_id = ? AND status != 'complete'",
  ).all(transactionId);
  if (!openTasks.length) return 0;
  const ids = openTasks.map((task) => task.id);
  const marks = ids.map(() => '?').join(', ');
  db.prepare(`UPDATE transaction_activity SET task_id = NULL WHERE task_id IN (${marks})`).run(...ids);
  db.prepare(`DELETE FROM tasks WHERE id IN (${marks})`).run(...ids);
  return openTasks.length;
}

/** Clean deals already marked terminated before open tasks were removed. */
export function cancelOpenTasksOnTerminatedDeals(db) {
  const rows = db.prepare("SELECT id FROM transactions WHERE stage = 'terminated'").all();
  let canceled = 0;
  for (const row of rows) {
    canceled += cancelOpenTasksForTransaction(db, row.id);
  }
  return canceled;
}
