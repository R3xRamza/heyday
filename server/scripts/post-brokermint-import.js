/**
 * POST Brokermint CSV to a running HEYDAY server (admin import endpoint).
 * Usage:
 *   node server/scripts/post-brokermint-import.js [csv-path] [base-url]
 *
 * Env: HEYDAY_EMAIL, HEYDAY_PASSWORD (default admin seed)
 */
import fs from 'fs';

const csvPath = process.argv[2] || '/Users/rexramza/Downloads/report.csv';
const baseUrl = (process.argv[3] || process.env.HEYDAY_URL || 'https://heyday-production-ce72.up.railway.app').replace(/\/$/, '');
const email = process.env.HEYDAY_EMAIL || 'admin@theheydaygroup.com';
const password = process.env.HEYDAY_PASSWORD || 'admin123';

if (!fs.existsSync(csvPath)) {
  console.error('CSV not found:', csvPath);
  process.exit(1);
}

const csv = fs.readFileSync(csvPath, 'utf8');

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

const importRes = await fetch(`${baseUrl}/api/transactions/import-brokermint`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Cookie: cookie,
  },
  body: JSON.stringify({ csv }),
});

const importBody = await importRes.text();
if (!importRes.ok) {
  console.error('Import failed:', importRes.status, importBody.slice(0, 500));
  process.exit(1);
}

console.log(JSON.stringify(JSON.parse(importBody), null, 2));
