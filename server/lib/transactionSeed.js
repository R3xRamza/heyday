import { SEED_TRANSACTIONS } from '../seed-data.js';
import { parseLegacyCityLine } from './address.js';

function parseLocationFromSeed(cityLine) {
  return parseLegacyCityLine(cityLine || '');
}
import { computeDueDate, resolveAnchorDate } from './timing.js';
import { resolveAssigneeId, resolveTaskPriority, resolveTaskRole, reassignAllTasksByRole } from './taskAssignment.js';
import { getPartiesForTransaction } from './transactionParties.js';
import { linkTemplateToTransaction } from './transactionChecklists.js';

const CHECKLIST_BY_REPRESENTING = {
  seller: 'Listing : CTC (if no TC)',
  private_listing: 'Listing : CTC (if no TC)',
  buyer: 'Buyer : CTC (if no TC)',
  seller_and_buyer: 'Listing : CTC (if no TC)',
  seller_and_client: 'Listing : CTC (if no TC)',
  both: 'Listing : CTC (if no TC)',
  landlord: 'Lease : Listing',
  leasing: 'Lease : Listing',
  tenant: 'Buyer : CTC (if no TC)',
  renting: 'Buyer : CTC (if no TC)',
};

export function clearTransactionData(db) {
  db.exec('PRAGMA foreign_keys = OFF');
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM transaction_activity').run();
  db.prepare('DELETE FROM transaction_parties').run();
  db.prepare('DELETE FROM transaction_checklists').run();
  db.prepare('DELETE FROM transactions').run();
  db.exec('PRAGMA foreign_keys = ON');
}

function applyChecklist(db, transactionId, templateName) {
  const template = db.prepare('SELECT id FROM checklist_templates WHERE name = ?').get(templateName);
  if (!template) {
    console.warn(`Checklist not found: ${templateName}`);
    return 0;
  }

  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
  const templateTasks = db.prepare('SELECT * FROM template_tasks WHERE template_id = ? ORDER BY sort_order')
    .all(template.id);

  const insert = db.prepare(`
    INSERT INTO tasks (title, due_date, status, transaction_id, template_task_id, priority, assigned_to)
    VALUES (?, ?, 'pending', ?, ?, ?, ?)
  `);

  db.transaction(() => {
    templateTasks.forEach((tt) => {
      const anchor = resolveAnchorDate(transaction, tt.timing_anchor);
      const dueDate = computeDueDate(anchor, tt.timing_value, tt.timing_direction);
      const role = tt.default_role || resolveTaskRole(tt.title);
      const assignedTo = resolveAssigneeId(db, tt.title, role);
      const priority = resolveTaskPriority(tt.title, role);
      insert.run(tt.title, dueDate, transaction.id, tt.id, priority, assignedTo);
    });
  })();

  db.prepare('UPDATE transactions SET checklist_template_id = ?, workflow_status = ? WHERE id = ?')
    .run(template.id, 'active', transactionId);
  linkTemplateToTransaction(db, transactionId, template.id, 0);

  return templateTasks.length;
}

export function seedTransactionsWithChecklists(db) {
  const admin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@theheydaygroup.com');
  const agentId = admin?.id ?? 1;

  const insert = db.prepare(`
    INSERT INTO transactions (address, city, state, zip, value, owner_name, representing, stage,
      important_date, important_date_label, agent_id, workflow_status, close_date, listing_date, acceptance_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let taskCount = 0;

  SEED_TRANSACTIONS.forEach((t) => {
    const loc = parseLocationFromSeed(t.city);
    const r = insert.run(
      t.address,
      loc.city,
      loc.state,
      loc.zip,
      t.value,
      t.owner,
      t.representing,
      t.stage,
      t.important,
      t.label,
      agentId,
      'active',
      t.important,
      t.important,
      t.important,
    );

    const txId = r.lastInsertRowid;
    const templateName = CHECKLIST_BY_REPRESENTING[t.representing] || CHECKLIST_BY_REPRESENTING.seller;
    taskCount += applyChecklist(db, txId, templateName);
    getPartiesForTransaction(db, txId);
  });

  reassignAllTasksByRole(db);

  return {
    transactions: SEED_TRANSACTIONS.length,
    tasks: db.prepare('SELECT COUNT(*) as c FROM tasks').get().c,
    tasksCreated: taskCount,
  };
}

export function resetTransactions(db) {
  clearTransactionData(db);
  return seedTransactionsWithChecklists(db);
}
