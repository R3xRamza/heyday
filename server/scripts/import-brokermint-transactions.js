/**
 * Replace all transactions with a Brokermint CSV export.
 * Usage: node server/scripts/import-brokermint-transactions.js [path-to-csv]
 *
 * Env: DATABASE_PATH (default heyday.db at repo root)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse';
import Database from 'better-sqlite3';
import { runMigrations } from '../lib/migrate.js';
import { clearTransactionData } from '../lib/transactionSeed.js';
import {
  mapBrokermintRow,
  BROKERMINT_INSERT_COLUMNS,
} from '../lib/brokermintImport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = '/Users/rexramza/Downloads/report.csv';
const csvPath = process.argv[2] || defaultPath;
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'heyday.db');

function loadRows(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true }))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  runMigrations(db);

  const users = db.prepare('SELECT id, email, name FROM users').all();
  const usersByEmail = Object.fromEntries(users.map((u) => [u.email, u.id]));
  const meredith = usersByEmail['meredith@theheydaygroup.com'];
  const defaultAgentId = meredith ?? users[0]?.id ?? 1;

  console.log('Reading CSV:', csvPath);
  console.log('Database:', dbPath);
  const rawRows = await loadRows(csvPath);
  console.log('Parsed rows:', rawRows.length);

  const before = {
    transactions: db.prepare('SELECT COUNT(*) as c FROM transactions').get().c,
    tasks: db.prepare('SELECT COUNT(*) as c FROM tasks').get().c,
  };

  clearTransactionData(db);
  console.log(`Cleared ${before.transactions} transaction(s) and ${before.tasks} task(s)`);

  const placeholders = BROKERMINT_INSERT_COLUMNS.map(() => '?').join(', ');
  const insert = db.prepare(`
    INSERT INTO transactions (${BROKERMINT_INSERT_COLUMNS.join(', ')})
    VALUES (${placeholders})
  `);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  db.transaction(() => {
    for (const row of rawRows) {
      try {
        const mapped = mapBrokermintRow(row, { usersByEmail, defaultAgentId });
        if (!mapped) {
          skipped++;
          continue;
        }
        insert.run(...BROKERMINT_INSERT_COLUMNS.map((col) => mapped[col]));
        inserted++;
      } catch (e) {
        errors++;
        if (errors <= 5) {
          console.error('Row error:', e.message, row.custom_id || row.full_address);
        }
      }
    }
  })();

  const byStage = db.prepare('SELECT stage, COUNT(*) as c FROM transactions GROUP BY stage ORDER BY stage').all();
  const total = db.prepare('SELECT COUNT(*) as c FROM transactions').get().c;

  console.log('\nDone.');
  console.log('  Inserted:', inserted);
  console.log('  Skipped:', skipped);
  console.log('  Errors:', errors);
  console.log('  Total in DB:', total);
  console.log('  By stage:', Object.fromEntries(byStage.map((r) => [r.stage, r.c])));

  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
