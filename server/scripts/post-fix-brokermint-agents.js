/**
 * POST Brokermint rows to fix agent_id on production (batched).
 * Usage: node server/scripts/post-fix-brokermint-agents.js [csv-path] [base-url]
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

const allRows = parse(fs.readFileSync(csvPath, 'utf8'), {
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

const cookie = (loginRes.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
if (!loginRes.ok) {
  console.error('Login failed:', loginRes.status, await loginRes.text());
  process.exit(1);
}

console.log('Logged in to', baseUrl);

let updated = 0;
let skipped = 0;

for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
  const rows = allRows.slice(i, i + BATCH_SIZE);
  const res = await fetch(`${baseUrl}/api/transactions/fix-brokermint-agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ rows }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error('Batch failed:', res.status, body.slice(0, 500));
    process.exit(1);
  }
  const result = JSON.parse(body);
  updated += result.updated;
  skipped += result.skipped;
  if (i + BATCH_SIZE >= allRows.length) {
    console.log('By agent:', Object.fromEntries((result.byAgent || []).map((r) => [r.agent_name, r.c])));
  }
}

console.log('\nDone. Updated:', updated, 'Skipped:', skipped);
