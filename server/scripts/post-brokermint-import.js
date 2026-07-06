/**
 * POST Brokermint CSV to a running HEYDAY server (admin import endpoint).
 * Sends rows in small batches to avoid proxy body-size limits.
 *
 * Usage:
 *   node server/scripts/post-brokermint-import.js [csv-path] [base-url]
 *
 * Env: HEYDAY_EMAIL, HEYDAY_PASSWORD (default admin seed)
 */
import fs from 'fs';
import { parse } from 'csv-parse/sync';

const csvPath = process.argv[2] || '/Users/rexramza/Downloads/report.csv';
const baseUrl = (process.argv[3] || process.env.HEYDAY_URL || 'https://hub.theheydaygroup.com').replace(/\/$/, '');
const email = process.env.HEYDAY_EMAIL || 'admin@theheydaygroup.com';
const password = process.env.HEYDAY_PASSWORD || 'admin123';
const BATCH_SIZE = 40;

if (!fs.existsSync(csvPath)) {
  console.error('CSV not found:', csvPath);
  process.exit(1);
}

const csv = fs.readFileSync(csvPath, 'utf8');
const allRows = parse(csv, {
  columns: true,
  skip_empty_lines: true,
  relax_quotes: true,
  relax_column_count: true,
});

const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
  redirect: 'manual',
});

const setCookie = loginRes.headers.getSetCookie?.() || [];
const cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
const loginBody = await loginRes.text();

if (!loginRes.ok) {
  console.error('Login failed:', loginRes.status, loginBody.slice(0, 200));
  process.exit(1);
}

console.log('Logged in to', baseUrl);
console.log('Parsed rows:', allRows.length);

const totals = { inserted: 0, skipped: 0, errors: 0, before: null, byStage: null, total: 0 };

for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
  const rows = allRows.slice(i, i + BATCH_SIZE);
  const clearFirst = i === 0;

  const importRes = await fetch(`${baseUrl}/api/transactions/import-brokermint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({ rows, clearFirst }),
  });

  const importBody = await importRes.text();
  if (!importRes.ok) {
    console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, importRes.status, importBody.slice(0, 500));
    process.exit(1);
  }

  const result = JSON.parse(importBody);
  if (clearFirst && result.before) totals.before = result.before;
  totals.inserted += result.inserted;
  totals.skipped += result.skipped;
  totals.errors += result.errors;
  totals.total = result.total;
  totals.byStage = result.byStage;
  console.log(`  batch ${Math.floor(i / BATCH_SIZE) + 1}: +${result.inserted} inserted (${result.total} total)`);
}

console.log('\nDone.');
console.log(JSON.stringify(totals, null, 2));
