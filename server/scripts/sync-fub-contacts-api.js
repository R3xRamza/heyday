/**
 * Sync Follow Up Boss API contacts into contacts table.
 * Usage: node server/scripts/sync-fub-contacts-api.js [--force]
 */
import 'dotenv/config';
import db from '../db.js';
import { runMigrations } from '../lib/migrate.js';
import { CONTACT_COLUMNS } from '../lib/fubImport.js';
import { FUB_CONTACT_FIELDS, mapFubApiPerson } from '../lib/fubApiImport.js';
import { fetchAllPeopleForAssignedUser, fetchFubUsers, resolveFubUserId } from '../lib/fubApiClient.js';

const MEREDITH_NAME = 'Meredith Alderson';
const MIN_SAFE_COUNT = 5000;
const EXPECTED_MIN = 8500;
const EXPECTED_MAX = 9500;
const useForce = process.argv.includes('--force');

runMigrations(db);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return String(value).trim();
}

function resolveAssignedUserIdFromEnv() {
  const raw = process.env.FUB_ASSIGNED_USER_ID;
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('FUB_ASSIGNED_USER_ID must be a positive integer');
  }
  return parsed;
}

function upsertStatement() {
  const placeholders = CONTACT_COLUMNS.map(() => '?').join(', ');
  const updateSet = CONTACT_COLUMNS.filter((c) => c !== 'external_id')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');

  return db.prepare(`
    INSERT INTO contacts (${CONTACT_COLUMNS.join(', ')}, updated_at)
    VALUES (${placeholders}, CURRENT_TIMESTAMP)
    ON CONFLICT(external_id) DO UPDATE SET
      ${updateSet},
      updated_at = CURRENT_TIMESTAMP
  `);
}

async function main() {
  const apiKey = requiredEnv('FUB_API_KEY');
  let assignedUserId = resolveAssignedUserIdFromEnv();

  if (!assignedUserId) {
    const users = await fetchFubUsers(apiKey);
    assignedUserId = resolveFubUserId(users, MEREDITH_NAME);
    if (!assignedUserId) {
      throw new Error(`Could not resolve FUB user id for "${MEREDITH_NAME}". Set FUB_ASSIGNED_USER_ID.`);
    }
  }

  console.log(`Sync target: assignedUserId=${assignedUserId} (${MEREDITH_NAME})`);
  console.log('Fetching contacts from Follow Up Boss (GET only)...');
  const { people, expectedTotal } = await fetchAllPeopleForAssignedUser(apiKey, assignedUserId, FUB_CONTACT_FIELDS);
  const activePeople = people.filter((p) => String(p.stage || '').toLowerCase() !== 'trash');

  console.log(`Fetched total rows: ${people.length}${expectedTotal != null ? ` (metadata total: ${expectedTotal})` : ''}`);
  console.log(`Active rows (excluding Trash): ${activePeople.length}`);

  if (activePeople.length === 0) {
    throw new Error('Safety stop: API returned 0 active contacts. Contacts table was not modified.');
  }
  if (!useForce && activePeople.length < MIN_SAFE_COUNT) {
    throw new Error(`Safety stop: only ${activePeople.length} contacts (< ${MIN_SAFE_COUNT}). Re-run with --force if intentional.`);
  }

  const users = db.prepare('SELECT id, email, name FROM users').all();
  const usersByName = Object.fromEntries(users.map((u) => [u.name, u.id]));
  users.forEach((u) => { usersByName[u.email] = u.id; });

  const upsert = upsertStatement();
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const BATCH = 500;
  const beforeCount = db.prepare('SELECT COUNT(*) as c FROM contacts').get().c;

  const applyAll = db.transaction(() => {
    db.prepare('DELETE FROM contacts').run();
    for (let i = 0; i < activePeople.length; i += BATCH) {
      const batch = activePeople.slice(i, i + BATCH);
      for (const person of batch) {
        try {
          const mapped = mapFubApiPerson(person, usersByName);
          if (!mapped.external_id) {
            skipped += 1;
            continue;
          }
          upsert.run(...CONTACT_COLUMNS.map((c) => mapped[c]));
          inserted += 1;
        } catch (err) {
          errors += 1;
          if (errors <= 5) console.error('Row error:', err.message);
        }
      }
      const processed = Math.min(i + BATCH, activePeople.length);
      if (processed % 1000 === 0 || processed === activePeople.length) {
        console.log(`  imported ${processed} / ${activePeople.length}`);
      }
    }
  });

  applyAll();

  const total = db.prepare('SELECT COUNT(*) as c FROM contacts').get().c;
  console.log('\nDone.');
  console.log(`  Previous count: ${beforeCount}`);
  console.log(`  Upserted: ${inserted}`);
  console.log(`  Skipped (no ID): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total in DB: ${total}`);
  console.log(`  Target range check (${EXPECTED_MIN}-${EXPECTED_MAX}): ${total >= EXPECTED_MIN && total <= EXPECTED_MAX ? 'OK' : 'outside expected range'}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
