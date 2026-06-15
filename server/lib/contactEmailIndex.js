import db from '../db.js';

/** Build email → contact_id map for Gmail matching. Prefer primary email over email_2. */
export function buildContactEmailIndex() {
  const rows = db.prepare(`
    SELECT id, email, email_2, raw_json FROM contacts
    WHERE email IS NOT NULL OR email_2 IS NOT NULL OR raw_json IS NOT NULL
  `).all();

  const index = new Map();

  function add(email, contactId, priority) {
    const key = email?.trim()?.toLowerCase();
    if (!key || !key.includes('@')) return;
    const existing = index.get(key);
    if (!existing || priority < existing.priority) {
      index.set(key, { contactId, priority });
    }
  }

  for (const row of rows) {
    add(row.email, row.id, 1);
    add(row.email_2, row.id, 2);

    if (row.raw_json) {
      try {
        const raw = JSON.parse(row.raw_json);
        for (let i = 1; i <= 4; i++) {
          add(raw[`Relationship ${i} Email 1`], row.id, 3);
          add(raw[`Relationship ${i} Email 2`], row.id, 3);
        }
      } catch {
        /* ignore */
      }
    }
  }

  const lookup = new Map();
  for (const [email, { contactId }] of index) {
    lookup.set(email, contactId);
  }
  return lookup;
}

export function extractEmailsFromHeaders(from, to, cc) {
  const emails = new Set();
  const parts = [from, to, cc].filter(Boolean).join(',');
  const matches = parts.match(/[\w.+-]+@[\w.-]+\.\w+/gi) || [];
  matches.forEach((m) => emails.add(m.toLowerCase()));
  return [...emails];
}
