/**
 * Import Follow Up Boss CSV into contacts table.
 * Usage: node server/scripts/import-fub-contacts.js [path-to-csv]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse';
import db from '../db.js';
import { runMigrations } from '../lib/migrate.js';
import { mapFubRow, CONTACT_COLUMNS } from '../lib/fubImport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = '/Users/rexramza/Downloads/all-people-2026-06-15.csv';
const csvPath = process.argv[2] || defaultPath;

runMigrations(db);

if (!fs.existsSync(csvPath)) {
  console.error('CSV not found:', csvPath);
  process.exit(1);
}

const users = db.prepare('SELECT id, email, name FROM users').all();
const usersByName = Object.fromEntries(users.map((u) => [u.name, u.id]));
users.forEach((u) => { usersByName[u.email] = u.id; });

const placeholders = CONTACT_COLUMNS.map(() => '?').join(', ');
const updateSet = CONTACT_COLUMNS.filter((c) => c !== 'external_id')
  .map((c) => `${c} = excluded.${c}`)
  .join(', ');

const upsert = db.prepare(`
  INSERT INTO contacts (${CONTACT_COLUMNS.join(', ')}, updated_at)
  VALUES (${placeholders}, CURRENT_TIMESTAMP)
  ON CONFLICT(external_id) DO UPDATE SET
    ${updateSet},
    updated_at = CURRENT_TIMESTAMP
`);

function loadRows() {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(csvPath)
      .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true }))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function main() {
  console.log('Reading CSV:', csvPath);
  const rawRows = await loadRows();
  console.log('Parsed rows:', rawRows.length);

  const beforeCount = db.prepare('SELECT COUNT(*) as c FROM contacts').get().c;
  db.transaction(() => {
    db.prepare('DELETE FROM contacts').run();
  })();
  console.log(`Cleared ${beforeCount} existing contact(s) before import`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const BATCH = 500;

  for (let i = 0; i < rawRows.length; i += BATCH) {
    const batch = rawRows.slice(i, i + BATCH);
    db.transaction(() => {
      for (const row of batch) {
        try {
          const mapped = mapFubRow(row, usersByName);
          if (!mapped.external_id) {
            skipped++;
            continue;
          }
          upsert.run(...CONTACT_COLUMNS.map((c) => mapped[c]));
          inserted++;
        } catch (e) {
          errors++;
          if (errors <= 5) console.error('Row error:', e.message);
        }
      }
    })();
    if ((i + BATCH) % 2000 === 0 || i + BATCH >= rawRows.length) {
      console.log(`  processed ${Math.min(i + BATCH, rawRows.length)} / ${rawRows.length}`);
    }
  }

  const total = db.prepare('SELECT COUNT(*) as c FROM contacts').get().c;
  console.log('\nDone.');
  console.log('  Upserted:', inserted);
  console.log('  Skipped (no ID):', skipped);
  console.log('  Errors:', errors);
  console.log('  Total in DB:', total);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
