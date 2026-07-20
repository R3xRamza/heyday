/**
 * Seed / backfill vendors from CRM contacts with FUB stage "Vendors".
 * Reads customVendorType + customWebsite from contact raw_json when present.
 * Idempotent: skips contacts already linked via source_contact_id.
 */

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
  // Prefer a clean primary label when FUB stores comma-separated synonyms
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

export function seedVendorsFromCrm(db) {
  const contacts = db.prepare(`
    SELECT id, name, company, phone, email, notes, description, raw_json
    FROM contacts
    WHERE stage = 'Vendors'
    ORDER BY name COLLATE NOCASE ASC, id ASC
  `).all();

  if (contacts.length === 0) return { inserted: 0, skipped: 0, totalContacts: 0 };

  const existing = new Set(
    db.prepare(`
      SELECT source_contact_id AS id FROM vendors WHERE source_contact_id IS NOT NULL
    `).all().map((r) => r.id),
  );

  const insert = db.prepare(`
    INSERT INTO vendors (
      name, company, category, phone, email, website, rating, notes,
      source_contact_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  let inserted = 0;
  let skipped = 0;

  const run = db.transaction(() => {
    for (const c of contacts) {
      if (existing.has(c.id)) {
        skipped += 1;
        continue;
      }
      const name = trim(c.name);
      if (!name) {
        skipped += 1;
        continue;
      }
      const raw = parseRaw(c.raw_json);
      insert.run(
        name,
        trim(c.company),
        categoryFromRaw(raw),
        trim(c.phone),
        trim(c.email),
        websiteFromRaw(raw),
        notesFromContact(c, raw),
        c.id,
      );
      inserted += 1;
    }
  });

  run();
  return { inserted, skipped, totalContacts: contacts.length };
}
