/**
 * Remap and dedupe transaction tasks after checklist template resync.
 * Resync nulls template_task_id on live tasks; without cleanup, orphans stack with newly linked tasks.
 */

const CHECKLIST_TITLE = /^(CLOSE OUT|MARKETING|UNDER CONTRACT|GO LIVE|COMING SOON|LISTING|FOLLOW UP|EXECUTED|PRIOR TO|POST-OPTION|OPTION PERIOD|Social Post)/i;

function detachAndDeleteTask(db, taskId) {
  db.prepare('UPDATE transaction_activity SET task_id = NULL WHERE task_id = ?').run(taskId);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
}

function transactionIdsForTemplate(db, templateId) {
  return db.prepare(`
    SELECT DISTINCT transaction_id AS id FROM (
      SELECT transaction_id FROM transaction_checklists WHERE template_id = ?
      UNION
      SELECT id AS transaction_id FROM transactions WHERE checklist_template_id = ?
    )
    WHERE transaction_id IS NOT NULL
  `).all(templateId, templateId).map((r) => r.id);
}

/**
 * For one template: relink orphans by title, dedupe duplicates, delete stale checklist-style orphans.
 */
export function dedupeChecklistTasksForTemplate(db, templateId) {
  const templateTasks = db.prepare(
    'SELECT id, title FROM template_tasks WHERE template_id = ? ORDER BY sort_order',
  ).all(templateId);
  const templateTaskIdByTitle = new Map(templateTasks.map((tt) => [tt.title, tt.id]));

  let relinked = 0;
  let deleted = 0;

  for (const txId of transactionIdsForTemplate(db, templateId)) {
    const txTasks = db.prepare(
      'SELECT id, title, template_task_id, status FROM tasks WHERE transaction_id = ?',
    ).all(txId);

    for (const [title, targetTemplateTaskId] of templateTaskIdByTitle) {
      const matching = txTasks.filter((t) => t.title === title);
      if (matching.length === 0) continue;

      const correctlyLinked = matching.filter((t) => t.template_task_id === targetTemplateTaskId);
      const keeper = correctlyLinked[0]
        || matching.find((t) => t.template_task_id == null)
        || matching[0];

      if (keeper.template_task_id !== targetTemplateTaskId) {
        db.prepare('UPDATE tasks SET template_task_id = ? WHERE id = ?').run(targetTemplateTaskId, keeper.id);
        keeper.template_task_id = targetTemplateTaskId;
        relinked += 1;
      }

      for (const t of matching) {
        if (t.id === keeper.id) continue;
        detachAndDeleteTask(db, t.id);
        deleted += 1;
      }
    }

    const staleOrphans = db.prepare(`
      SELECT id, title FROM tasks
      WHERE transaction_id = ? AND template_task_id IS NULL
    `).all(txId);

    for (const t of staleOrphans) {
      if (!CHECKLIST_TITLE.test(t.title || '')) continue;

      const inAppliedTemplate = db.prepare(`
        SELECT 1 FROM template_tasks tt
        INNER JOIN transaction_checklists tc ON tc.template_id = tt.template_id
        WHERE tc.transaction_id = ? AND tt.title = ?
        LIMIT 1
      `).get(txId, t.title);

      if (!inAppliedTemplate) {
        detachAndDeleteTask(db, t.id);
        deleted += 1;
      }
    }
  }

  return { relinked, deleted };
}

export function dedupeChecklistTasksForTemplateNames(db, names) {
  let relinked = 0;
  let deleted = 0;
  for (const name of names) {
    const row = db.prepare('SELECT id FROM checklist_templates WHERE name = ?').get(name);
    if (!row) continue;
    const result = dedupeChecklistTasksForTemplate(db, row.id);
    relinked += result.relinked;
    deleted += result.deleted;
  }
  return { relinked, deleted };
}

export function dedupeAllChecklistTemplates(db) {
  const templates = db.prepare('SELECT id FROM checklist_templates').all();
  let relinked = 0;
  let deleted = 0;
  for (const { id } of templates) {
    const result = dedupeChecklistTasksForTemplate(db, id);
    relinked += result.relinked;
    deleted += result.deleted;
  }
  return { relinked, deleted };
}

/** True when a task is a one-off manual add (not a checklist template row). */
export function isManualTransactionTask(task) {
  if (task.template_task_id != null) return false;
  if (task.template_id != null) return false;
  return !CHECKLIST_TITLE.test(task.title || '');
}
