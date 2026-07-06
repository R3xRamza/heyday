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
import { runBrokermintImport } from '../lib/brokermintImport.js';

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

  console.log('Reading CSV:', csvPath);
  console.log('Database:', dbPath);
  const rawRows = await loadRows(csvPath);
  console.log('Parsed rows:', rawRows.length);

  const result = runBrokermintImport(db, rawRows);

  console.log('\nDone.');
  if (result.before) {
    console.log(`  Cleared ${result.before.transactions} transaction(s) and ${result.before.tasks} task(s)`);
  }
  console.log('  Inserted:', result.inserted);
  console.log('  Skipped:', result.skipped);
  console.log('  Errors:', result.errors);
  console.log('  Total in DB:', result.total);
  console.log('  By stage:', result.byStage);

  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
