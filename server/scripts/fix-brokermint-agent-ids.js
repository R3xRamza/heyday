/**
 * Re-map transaction agent_id from Brokermint CSV (matched by custom_id → transaction_name).
 * Usage: node server/scripts/fix-brokermint-agent-ids.js [path-to-csv]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse';
import Database from 'better-sqlite3';
import { fixBrokermintAgentIds } from '../lib/brokermintImport.js';

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

  console.log('Reading CSV:', csvPath);
  console.log('Database:', dbPath);
  const rawRows = await loadRows(csvPath);
  const result = fixBrokermintAgentIds(db, rawRows);

  console.log('\nDone.');
  console.log('  Updated:', result.updated);
  console.log('  Skipped:', result.skipped);
  console.log('  By agent:', Object.fromEntries(result.byAgent.map((r) => [r.agent_name, r.c])));

  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
