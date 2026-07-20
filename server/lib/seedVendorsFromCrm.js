/**
 * Seed / backfill vendors:
 * 1) Bundled FUB export (`server/data/vendors-seed.json`) — full Vendors stage list
 * 2) Link any local CRM contacts in stage "Vendors" via source_contact_id
 *
 * Idempotent via vendors.external_id (FUB person id). Preserves team notes + rating.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, '..', 'data', 'vendors-seed.json');

function trim(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function parseRaw(rawJson) {
  if (!rawJson) return {};
  try {
    return typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
  } catch {
    return {};
  }
}

function categoryFromRaw(raw) {
  const t = trim(raw.customVendorType);
  if (!t) return null;
  const primary = t.split(',')[0].trim();
  return primary || t;
}

function websiteFromRaw(raw) {
  return trim(raw.customWebsite) || trim(raw.Website) || trim(raw.website) || null;
}

function notesFromContact(c, raw) {
  const parts = [trim(c.notes), trim(c.description), trim(raw.Notes), trim(raw.Description)].filter(Boolean);
  if (parts.length === 0) return null;
  return [...new Set(parts)].join('\n\n');
}

function loadBundledSeed() {
  if (!fs.existsSync(SEED_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.warn('vendors-seed.json unreadable:', err.message);
    return [];
  }
}

export function seedVendorsFromCrm(db) {
  // Link existing CRM-seeded rows to FUB ids so bundled upsert doesn't duplicate
  db.prepare(`
    UPDATE vendors
    SET external_id = (
      SELECT c.external_id FROM contacts c
      WHERE c.id = vendors.source_contact_id
        AND c.external_id IS NOT NULL
        AND TRIM(c.external_id) != ''
    )
    WHERE external_id IS NULL
      AND source_contact_id IS NOT NULL
  `).run();

  const upsert = db.prepare(`
    INSERT INTO vendors (
      name, company, category, phone, email, website, notes, external_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(external_id) DO UPDATE SET
      name = excluded.name,
      company = COALESCE(excluded.company, vendors.company),
      category = COALESCE(excluded.category, vendors.category),
      phone = COALESCE(excluded.phone, vendors.phone),
      email = COALESCE(excluded.email, vendors.email),
      website = COALESCE(excluded.website, vendors.website),
      notes = CASE
        WHEN vendors.notes IS NULL OR vendors.notes = '' THEN excluded.notes
        ELSE vendors.notes
      END,
      updated_at = CURRENT_TIMESTAMP
  `);

  const insertUnlinked = db.prepare(`
    INSERT INTO vendors (
      name, company, category, phone, email, website, notes, source_contact_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  const linkContact = db.prepare(`
    UPDATE vendors
    SET source_contact_id = COALESCE(source_contact_id, ?)
    WHERE external_id = ?
  `);

  let fromSeed = 0;
  let linkedContacts = 0;
  let insertedContacts = 0;

  const run = db.transaction(() => {
    for (const row of loadBundledSeed()) {
      const name = trim(row.name);
      const externalId = trim(row.external_id) != null ? String(trim(row.external_id)) : null;
      if (!name || !externalId) continue;
      upsert.run(
        name,
        trim(row.company),
        trim(row.category),
        trim(row.phone),
        trim(row.email),
        trim(row.website),
        trim(row.notes),
        externalId,
      );
      fromSeed += 1;
    }

    const contacts = db.prepare(`
      SELECT id, external_id, name, company, phone, email, notes, description, raw_json
      FROM contacts
      WHERE stage = 'Vendors'
      ORDER BY name COLLATE NOCASE ASC, id ASC
    `).all();

    const alreadyLinked = new Set(
      db.prepare(`
        SELECT source_contact_id AS id FROM vendors WHERE source_contact_id IS NOT NULL
      `).all().map((r) => r.id),
    );

    for (const c of contacts) {
      if (alreadyLinked.has(c.id)) continue;

      const ext = trim(c.external_id) != null ? String(trim(c.external_id)) : null;
      if (ext) {
        const result = linkContact.run(c.id, ext);
        if (result.changes > 0) {
          linkedContacts += 1;
          alreadyLinked.add(c.id);
          continue;
        }
      }

      // Contact not in bundled seed — add it
      const name = trim(c.name);
      if (!name) continue;
      const raw = parseRaw(c.raw_json);

      if (ext) {
        upsert.run(
          name,
          trim(c.company),
          categoryFromRaw(raw),
          trim(c.phone),
          trim(c.email),
          websiteFromRaw(raw),
          notesFromContact(c, raw),
          ext,
        );
        linkContact.run(c.id, ext);
      } else {
        insertUnlinked.run(
          name,
          trim(c.company),
          categoryFromRaw(raw),
          trim(c.phone),
          trim(c.email),
          websiteFromRaw(raw),
          notesFromContact(c, raw),
          c.id,
        );
      }
      insertedContacts += 1;
      alreadyLinked.add(c.id);
    }
  });

  run();

  const total = db.prepare('SELECT COUNT(*) as c FROM vendors').get().c;
  return { fromSeed, linkedContacts, insertedContacts, total };
}
