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

export function getTransactionChecklists(db, transactionId) {
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

/** Backfill junction from tasks + legacy checklist_template_id. */
export function backfillTransactionChecklists(db) {
  ensureTransactionChecklistsTable(db);

  const fromTasks = db.prepare(`
    SELECT DISTINCT t.transaction_id, tt.template_id
    FROM tasks t
    INNER JOIN template_tasks tt ON tt.id = t.template_task_id
    WHERE t.transaction_id IS NOT NULL
  `).all();

  for (const row of fromTasks) {
    linkTemplateToTransaction(db, row.transaction_id, row.template_id, 0);
  }

  const legacy = db.prepare(`
    SELECT id, checklist_template_id FROM transactions
    WHERE checklist_template_id IS NOT NULL
  `).all();

  for (const tx of legacy) {
    linkTemplateToTransaction(db, tx.id, tx.checklist_template_id, 0);
  }
}
