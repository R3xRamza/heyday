/**
 * Clear all transactions + tasks, then repopulate sample properties with checklists.
 * Keeps users, CRM contacts, checklist templates, and auth intact.
 *
 * Usage: npm run reset-transactions
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from '../lib/migrate.js';
import { seedChecklistTemplatesIfEmpty } from '../seed-data.js';
import { resetTransactions } from '../lib/transactionSeed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', '..', 'heyday.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

runMigrations(db);
seedChecklistTemplatesIfEmpty(db);

const before = {
  transactions: db.prepare('SELECT COUNT(*) as c FROM transactions').get().c,
  tasks: db.prepare('SELECT COUNT(*) as c FROM tasks').get().c,
};

const result = resetTransactions(db);

console.log(`Cleared ${before.transactions} transaction(s) and ${before.tasks} task(s).`);
console.log(`Repopulated ${result.transactions} transaction(s) with ${result.tasks} task(s).`);

db.close();
