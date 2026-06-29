/**
 * Junction table helpers for multiple checklists per transaction.
 */

export function ensureTransactionChecklistsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transaction_checklists (
      transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      template_id INTEGER NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
      sort_order INTEGER DEFAULT 0,
      PRIMARY KEY (transaction_id, template_id)
    );
  `);
}

export function linkTemplateToTransaction(db, transactionId, templateId, sortOrder) {
  db.prepare(`
    INSERT INTO transaction_checklists (transaction_id, template_id, sort_order)
    VALUES (?, ?, ?)
    ON CONFLICT(transaction_id, template_id) DO UPDATE SET sort_order = excluded.sort_order
  `).run(transactionId, templateId, sortOrder);
}

export function unlinkTemplateFromTransaction(db, transactionId, templateId) {
  db.prepare(
    'DELETE FROM transaction_checklists WHERE transaction_id = ? AND template_id = ?',
  ).run(transactionId, templateId);
}

/** Ensure junction rows exist for tasks + legacy checklist_template_id on one transaction. */
export function syncTransactionChecklistLinks(db, transactionId) {
  ensureTransactionChecklistsTable(db);

  const fromTasks = db.prepare(`
    SELECT DISTINCT tt.template_id
    FROM tasks t
    INNER JOIN template_tasks tt ON tt.id = t.template_task_id
    WHERE t.transaction_id = ?
  `).all(transactionId);

  let nextOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM transaction_checklists WHERE transaction_id = ?',
  ).get(transactionId).m + 1;

  for (const row of fromTasks) {
    const exists = db.prepare(
      'SELECT 1 FROM transaction_checklists WHERE transaction_id = ? AND template_id = ?',
    ).get(transactionId, row.template_id);
    if (!exists) {
      linkTemplateToTransaction(db, transactionId, row.template_id, nextOrder++);
    }
  }

  const legacy = db.prepare(
    'SELECT checklist_template_id FROM transactions WHERE id = ?',
  ).get(transactionId);
  if (legacy?.checklist_template_id) {
    const exists = db.prepare(
      'SELECT 1 FROM transaction_checklists WHERE transaction_id = ? AND template_id = ?',
    ).get(transactionId, legacy.checklist_template_id);
    if (!exists) {
      linkTemplateToTransaction(db, transactionId, legacy.checklist_template_id, nextOrder++);
    }
  }
}

export function isChecklistAppliedToTransaction(db, transactionId, templateId) {
  syncTransactionChecklistLinks(db, transactionId);

  const inJunction = db.prepare(
    'SELECT 1 FROM transaction_checklists WHERE transaction_id = ? AND template_id = ?',
  ).get(transactionId, templateId);
  if (inJunction) return true;

  const hasTasks = db.prepare(`
    SELECT 1 FROM tasks t
    INNER JOIN template_tasks tt ON tt.id = t.template_task_id
    WHERE t.transaction_id = ? AND tt.template_id = ?
    LIMIT 1
  `).get(transactionId, templateId);
  if (hasTasks) return true;

  const legacy = db.prepare(
    'SELECT checklist_template_id FROM transactions WHERE id = ?',
  ).get(transactionId);
  return Number(legacy?.checklist_template_id) === Number(templateId);
}

export function getTransactionChecklists(db, transactionId) {
  syncTransactionChecklistLinks(db, transactionId);

  return db.prepare(`
    SELECT tc.template_id AS id, ct.name, tc.sort_order,
      (SELECT COUNT(*) FROM tasks tk
        INNER JOIN template_tasks tt ON tt.id = tk.template_task_id
        WHERE tk.transaction_id = tc.transaction_id AND tt.template_id = tc.template_id) AS task_count
    FROM transaction_checklists tc
    INNER JOIN checklist_templates ct ON ct.id = tc.template_id
    WHERE tc.transaction_id = ?
    ORDER BY tc.sort_order ASC, tc.template_id ASC
  `).all(transactionId);
}

/** Backfill junction from tasks + legacy checklist_template_id (all transactions). */
export function backfillTransactionChecklists(db) {
  ensureTransactionChecklistsTable(db);

  const transactionIds = db.prepare(`
    SELECT DISTINCT transaction_id FROM (
      SELECT transaction_id FROM tasks WHERE transaction_id IS NOT NULL
      UNION
      SELECT id AS transaction_id FROM transactions WHERE checklist_template_id IS NOT NULL
    )
  `).all();

  for (const { transaction_id } of transactionIds) {
    syncTransactionChecklistLinks(db, transaction_id);
  }
}
