/**
 * Sync Follow Up Boss API contacts into contacts table.
 * Usage: node server/scripts/sync-fub-contacts-api.js [--force]
 *
 * Contacts only — never reads/writes the vendors table.
 * Preserves contact row ids (upsert by external_id) so vendor.source_contact_id links stay valid.
 */
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { runMigrations } from '../lib/migrate.js';
import { CONTACT_COLUMNS } from '../lib/fubImport.js';
import { FUB_CONTACT_FIELDS, mapFubApiPerson } from '../lib/fubApiImport.js';
import {
  fetchAllPeopleForAssignedUser,
  fetchAllNotes,
  fetchFubUsers,
  resolveFubUserId,
} from '../lib/fubApiClient.js';
import { isExcludedCrmStage } from '../lib/crmContactScope.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEREDITH_NAME = 'Meredith Alderson';
const MIN_SAFE_COUNT = 5000;
const EXPECTED_MIN = 8500;
const EXPECTED_MAX = 9500;
const useForce = process.argv.includes('--force');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'heyday.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema only — do not re-seed/update vendors during CRM sync
runMigrations(db, { skipVendorSeed: true });

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

/** Fingerprint vendors so we can abort if anything touches them. */
function vendorsSnapshot() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM vendors').get().c;
  const likes = db.prepare('SELECT COUNT(*) AS c FROM vendor_likes').get()?.c ?? 0;
  const row = db.prepare(`
    SELECT
      COUNT(*) AS c,
      COALESCE(SUM(id), 0) AS id_sum,
      COALESCE(SUM(LENGTH(COALESCE(name, ''))), 0) AS name_len,
      COALESCE(SUM(LENGTH(COALESCE(notes, ''))), 0) AS notes_len,
      COALESCE(SUM(COALESCE(rating, 0)), 0) AS rating_sum,
      COALESCE(SUM(COALESCE(source_contact_id, 0)), 0) AS source_sum,
      COALESCE(SUM(LENGTH(COALESCE(external_id, ''))), 0) AS ext_len
    FROM vendors
  `).get();
  return { count, likes, ...row };
}

function assertVendorsUnchanged(before, after) {
  const keys = Object.keys(before);
  for (const key of keys) {
    if (before[key] !== after[key]) {
      throw new Error(
        `Safety stop: vendors table changed during CRM sync (${key}: ${before[key]} → ${after[key]}). Rolled back.`,
      );
    }
  }
}

/** Upsert FUB Background into contact_activity + import timeline notes. */
function syncFubNotesAndBackground(dbConn, crmPeople) {
  const findContact = dbConn.prepare(`
    SELECT id FROM contacts WHERE external_id = ? LIMIT 1
  `);
  const upsertActivity = dbConn.prepare(`
    INSERT INTO contact_activity (
      contact_id, event_type, summary, body, occurred_at, direction, mailbox, external_id
    ) VALUES (?, 'note', ?, ?, ?, 'unknown', 'fub', ?)
    ON CONFLICT(external_id) DO UPDATE SET
      summary = excluded.summary,
      body = excluded.body,
      occurred_at = COALESCE(excluded.occurred_at, contact_activity.occurred_at)
  `);

  let backgroundUpserts = 0;
  for (const person of crmPeople) {
    const externalId = person.id != null ? String(person.id) : null;
    if (!externalId) continue;
    const background = person.background != null ? String(person.background).trim() : '';
    if (!background) continue;
    const contact = findContact.get(externalId);
    if (!contact) continue;
    upsertActivity.run(
      contact.id,
      'Background',
      background,
      person.updated || person.created || null,
      `fub_background_${externalId}`,
    );
    backgroundUpserts += 1;
  }

  return { backgroundUpserts };
}

async function importFubTimelineNotes(dbConn, apiKey) {
  console.log('Fetching timeline notes from Follow Up Boss...');
  const { notes, expectedTotal } = await fetchAllNotes(apiKey);
  console.log(`Fetched notes: ${notes.length}${expectedTotal != null ? ` (metadata total: ${expectedTotal})` : ''}`);

  const findContact = dbConn.prepare(`
    SELECT id FROM contacts WHERE external_id = ? LIMIT 1
  `);
  const upsertActivity = dbConn.prepare(`
    INSERT INTO contact_activity (
      contact_id, event_type, summary, body, subject, occurred_at, direction, mailbox, external_id
    ) VALUES (?, 'note', ?, ?, ?, ?, 'unknown', 'fub', ?)
    ON CONFLICT(external_id) DO UPDATE SET
      summary = excluded.summary,
      body = excluded.body,
      subject = excluded.subject,
      occurred_at = COALESCE(excluded.occurred_at, contact_activity.occurred_at)
  `);

  let imported = 0;
  let skipped = 0;
  const run = dbConn.transaction(() => {
    for (const note of notes) {
      const personId = note.personId ?? note.person_id ?? note.peopleId;
      if (personId == null) {
        skipped += 1;
        continue;
      }
      const contact = findContact.get(String(personId));
      if (!contact) {
        skipped += 1;
        continue;
      }
      const noteId = note.id != null ? String(note.id) : null;
      if (!noteId) {
        skipped += 1;
        continue;
      }
      const body = String(note.body || note.note || note.text || '').trim();
      if (!body) {
        skipped += 1;
        continue;
      }
      const subject = note.subject != null ? String(note.subject).trim() : null;
      const summary = subject || 'FUB note';
      const occurred = note.created || note.updated || note.createdAt || null;
      upsertActivity.run(
        contact.id,
        summary,
        body,
        subject,
        occurred,
        `fub_note_${noteId}`,
      );
      imported += 1;
    }
  });
  run();
  return { imported, skipped, fetched: notes.length };
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

  console.log(`DB: ${dbPath}`);
  console.log(`Sync target: assignedUserId=${assignedUserId} (${MEREDITH_NAME})`);
  console.log('Fetching contacts from Follow Up Boss (GET only)...');
  console.log('Vendors table will not be modified.');

  const vendorsBefore = vendorsSnapshot();
  const { people, expectedTotal } = await fetchAllPeopleForAssignedUser(apiKey, assignedUserId, FUB_CONTACT_FIELDS);
  const vendorStageCount = people.filter((p) => String(p.stage || '').trim().toLowerCase() === 'vendors').length;
  const trashCount = people.filter((p) => String(p.stage || '').trim().toLowerCase() === 'trash').length;
  // CRM contacts only — Vendors stage lives in /crm/vendors, never in contacts list
  const crmPeople = people.filter((p) => !isExcludedCrmStage(p.stage));

  console.log(`Fetched total rows: ${people.length}${expectedTotal != null ? ` (metadata total: ${expectedTotal})` : ''}`);
  console.log(`Excluded Trash: ${trashCount}, Vendors stage: ${vendorStageCount}`);
  console.log(`CRM contacts to sync: ${crmPeople.length}`);

  if (crmPeople.length === 0) {
    throw new Error('Safety stop: API returned 0 CRM contacts. Contacts table was not modified.');
  }
  if (!useForce && crmPeople.length < MIN_SAFE_COUNT) {
    throw new Error(`Safety stop: only ${crmPeople.length} CRM contacts (< ${MIN_SAFE_COUNT}). Re-run with --force if intentional.`);
  }

  const users = db.prepare('SELECT id, email, name FROM users').all();
  const usersByName = Object.fromEntries(users.map((u) => [u.name, u.id]));
  users.forEach((u) => { usersByName[u.email] = u.id; });

  const upsert = upsertStatement();
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let removed = 0;
  const BATCH = 500;
  const beforeCount = db.prepare('SELECT COUNT(*) as c FROM contacts').get().c;
  const keepExternalIds = new Set();

  const applyAll = db.transaction(() => {
    for (let i = 0; i < crmPeople.length; i += BATCH) {
      const batch = crmPeople.slice(i, i + BATCH);
      for (const person of batch) {
        try {
          const mapped = mapFubApiPerson(person, usersByName);
          if (!mapped.external_id) {
            skipped += 1;
            continue;
          }
          keepExternalIds.add(String(mapped.external_id));
          upsert.run(...CONTACT_COLUMNS.map((c) => mapped[c]));
          inserted += 1;
        } catch (err) {
          errors += 1;
          if (errors <= 5) console.error('Row error:', err.message);
        }
      }
      const processed = Math.min(i + BATCH, crmPeople.length);
      if (processed % 1000 === 0 || processed === crmPeople.length) {
        console.log(`  upserted ${processed} / ${crmPeople.length}`);
      }
    }

    // Remove stale / Vendors-stage contacts — never delete rows vendors still point at.
    const existing = db.prepare(`
      SELECT c.id, c.external_id, c.stage
      FROM contacts c
      WHERE c.external_id IS NOT NULL AND TRIM(c.external_id) != ''
    `).all();

    const deleteOne = db.prepare(`
      DELETE FROM contacts
      WHERE id = ?
        AND NOT EXISTS (
          SELECT 1 FROM vendors v WHERE v.source_contact_id = contacts.id
        )
    `);

    for (const row of existing) {
      const keep = keepExternalIds.has(String(row.external_id)) && !isExcludedCrmStage(row.stage);
      if (keep) continue;
      const result = deleteOne.run(row.id);
      removed += result.changes;
    }

    const vendorsAfter = vendorsSnapshot();
    assertVendorsUnchanged(vendorsBefore, vendorsAfter);
  });

  applyAll();

  const bg = syncFubNotesAndBackground(db, crmPeople);
  console.log(`  Background → activity: ${bg.backgroundUpserts}`);

  let noteStats = { imported: 0, skipped: 0, fetched: 0 };
  try {
    noteStats = await importFubTimelineNotes(db, apiKey);
    console.log(`  Timeline notes imported: ${noteStats.imported} (skipped ${noteStats.skipped})`);
  } catch (err) {
    console.warn(`  Timeline notes sync skipped: ${err.message || err}`);
  }

  const vendorsFinal = vendorsSnapshot();
  assertVendorsUnchanged(vendorsBefore, vendorsFinal);

  const total = db.prepare('SELECT COUNT(*) as c FROM contacts').get().c;
  const crmTotal = db.prepare(`
    SELECT COUNT(*) as c FROM contacts c
    WHERE (c.stage IS NULL OR LOWER(TRIM(c.stage)) NOT IN ('vendors', 'trash'))
  `).get().c;
  const withNotes = db.prepare(`
    SELECT COUNT(*) as c FROM contacts c
    WHERE (c.stage IS NULL OR LOWER(TRIM(c.stage)) NOT IN ('vendors', 'trash'))
      AND notes IS NOT NULL AND TRIM(notes) != ''
  `).get().c;
  console.log('\nDone.');
  console.log(`  Previous count: ${beforeCount}`);
  console.log(`  Upserted: ${inserted}`);
  console.log(`  Removed (stale/Vendors, not vendor-linked): ${removed}`);
  console.log(`  Skipped (no ID): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total contact rows: ${total}`);
  console.log(`  CRM list count (excl. Vendors/Trash): ${crmTotal}`);
  console.log(`  CRM contacts with notes/background text: ${withNotes}`);
  console.log(`  Vendors unchanged: ${vendorsFinal.count} rows`);
  console.log(`  Target range check (${EXPECTED_MIN}-${EXPECTED_MAX}): ${crmTotal >= EXPECTED_MIN && crmTotal <= EXPECTED_MAX ? 'OK' : 'outside expected range'}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
