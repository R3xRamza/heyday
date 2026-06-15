/**
 * Remove all transactions, tasks, and related rows. Does not touch users, CRM, or templates.
 * Usage: npm run clear-transactions
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { clearTransactionData } from '../lib/transactionSeed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', '..', 'heyday.db');

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const before = {
  transactions: db.prepare('SELECT COUNT(*) as c FROM transactions').get().c,
  tasks: db.prepare('SELECT COUNT(*) as c FROM tasks').get().c,
};

clearTransactionData(db);

console.log(`Removed ${before.transactions} transaction(s) and ${before.tasks} task(s).`);
console.log('Transactions and Task Hub are empty. Users, CRM, and checklist templates are unchanged.');

db.close();
