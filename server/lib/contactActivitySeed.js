import db from '../db.js';

/** Split notes on date lines like "3/11/2025:" or "MEREDITH'S NOTES:" */
export function splitNotesIntoChunks(notes) {
  if (!notes?.trim()) return [];

  const lines = notes.split('\n');
  const chunks = [];
  let current = { date: null, lines: [] };

  const datePattern = /^(\d{1,2}\/\d{1,2}\/\d{2,4}):?\s*$/;
  const headerPattern = /^[A-Z][A-Z\s'"]+:\s*$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (datePattern.test(trimmed) || headerPattern.test(trimmed)) {
      if (current.lines.length) chunks.push({ ...current });
      current = { date: trimmed.replace(/:$/, ''), lines: [] };
    } else if (trimmed) {
      current.lines.push(line);
    }
  }
  if (current.lines.length) chunks.push(current);

  if (chunks.length <= 1 && notes.length > 0) {
    return [{ date: null, lines: [notes] }];
  }
  return chunks;
}

export function seedContactActivitiesFromNotes(contactId) {
  const existing = db.prepare('SELECT COUNT(*) as c FROM contact_activity WHERE contact_id = ?').get(contactId).c;
  if (existing > 0) return false;

  const contact = db.prepare('SELECT notes, description FROM contacts WHERE id = ?').get(contactId);
  if (!contact) return false;

  const insert = db.prepare(`
    INSERT INTO contact_activity (contact_id, event_type, summary, body, occurred_at, direction, mailbox)
    VALUES (?, 'note', ?, ?, ?, 'unknown', 'import')
  `);

  let seeded = false;

  if (contact.description?.trim()) {
    insert.run(contactId, 'Description', contact.description.trim(), null);
    seeded = true;
  }

  const chunks = splitNotesIntoChunks(contact.notes);
  for (const chunk of chunks) {
    const body = chunk.lines.join('\n').trim();
    if (!body) continue;
    const summary = chunk.date ? `Note — ${chunk.date}` : 'Imported notes';
    let occurredAt = null;
    if (chunk.date && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(chunk.date)) {
      const [m, d, y] = chunk.date.split('/');
      const year = y.length === 2 ? `20${y}` : y;
      occurredAt = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00`;
    }
    insert.run(contactId, summary, body, occurredAt);
    seeded = true;
  }

  return seeded;
}
