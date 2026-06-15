import { Router } from 'express';
import db from '../db.js';
import { seedContactActivitiesFromNotes } from '../lib/contactActivitySeed.js';

const router = Router();

const SORT_MAP = {
  last_contacted: 'c.last_contacted',
  name: 'c.name',
  date_added: 'c.date_added',
};

const PATCH_FIELDS = [
  'stage', 'lead_source', 'assigned_to_name', 'assigned_to', 'is_contacted',
  'tags', 'notes', 'description', 'email', 'phone', 'first_name', 'last_name', 'name',
];

function buildListQuery(query) {
  const conditions = ['1=1'];
  const params = [];

  const search = (query.search || '').trim();
  if (search) {
    const q = `%${search.toLowerCase()}%`;
    conditions.push(`(
      LOWER(c.name) LIKE ? OR LOWER(c.email) LIKE ? OR LOWER(c.email_2) LIKE ?
      OR LOWER(c.phone) LIKE ? OR LOWER(c.phone_2) LIKE ? OR LOWER(c.tags) LIKE ?
      OR LOWER(c.company) LIKE ? OR LOWER(c.property_address) LIKE ?
      OR LOWER(c.street) LIKE ? OR LOWER(c.city) LIKE ?
      OR LOWER(c.notes) LIKE ? OR LOWER(c.description) LIKE ?
    )`);
    params.push(q, q, q, q, q, q, q, q, q, q, q, q);
  }

  if (query.stage) {
    conditions.push('c.stage = ?');
    params.push(query.stage);
  }
  if (query.lead_source) {
    conditions.push('c.lead_source = ?');
    params.push(query.lead_source);
  }
  if (query.assigned_to) {
    conditions.push('c.assigned_to_name = ?');
    params.push(query.assigned_to);
  }
  if (query.is_contacted === '1' || query.is_contacted === 'true') {
    conditions.push('c.is_contacted = 1');
  } else if (query.is_contacted === '0' || query.is_contacted === 'false') {
    conditions.push('c.is_contacted = 0');
  }
  if (query.tag) {
    conditions.push('LOWER(c.tags) LIKE ?');
    params.push(`%${query.tag.toLowerCase()}%`);
  }

  const where = conditions.join(' AND ');
  return { where, params };
}

router.get('/filters', (_req, res) => {
  const stages = db.prepare(`
    SELECT stage as value, COUNT(*) as count FROM contacts
    WHERE stage IS NOT NULL AND stage != '' GROUP BY stage ORDER BY count DESC
  `).all();
  const leadSources = db.prepare(`
    SELECT lead_source as value, COUNT(*) as count FROM contacts
    WHERE lead_source IS NOT NULL AND lead_source != '' GROUP BY lead_source ORDER BY count DESC LIMIT 100
  `).all();
  const assigned = db.prepare(`
    SELECT assigned_to_name as value, COUNT(*) as count FROM contacts
    WHERE assigned_to_name IS NOT NULL AND assigned_to_name != '' AND LENGTH(assigned_to_name) < 60
    GROUP BY assigned_to_name ORDER BY count DESC LIMIT 50
  `).all();

  res.json({ stages, leadSources, assigned });
});

router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = (page - 1) * limit;

  const sortKey = SORT_MAP[req.query.sort] || SORT_MAP.last_contacted;
  const sortDir = req.query.order === 'asc' ? 'ASC' : 'DESC';

  const { where, params } = buildListQuery(req.query);

  const total = db.prepare(`SELECT COUNT(*) as c FROM contacts c WHERE ${where}`).get(...params).c;

  const contacts = db.prepare(`
    SELECT c.id, c.external_id, c.name, c.first_name, c.last_name, c.email, c.phone,
      c.stage, c.lead_source, c.assigned_to_name, c.is_contacted, c.tags,
      c.last_contacted, c.date_added, c.property_address, c.property_city,
      c.street, c.city, c.state, c.company, u.name as assigned_user_name
    FROM contacts c
    LEFT JOIN users u ON u.id = c.assigned_to
    WHERE ${where}
    ORDER BY (${sortKey} IS NULL), ${sortKey} ${sortDir}, c.name ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const byStage = db.prepare(`
    SELECT stage, COUNT(*) as count FROM contacts
    WHERE stage IS NOT NULL GROUP BY stage
  `).all();

  const highlightStages = ['Sphere', 'Closed', 'Client: Actively Working', 'Hot Prospect (0-3 months)', 'Lead'];
  const stageHighlights = {};
  for (const s of highlightStages) {
    const row = byStage.find((r) => r.stage === s);
    stageHighlights[s] = row?.count ?? 0;
  }

  res.json({
    contacts,
    total,
    page,
    limit,
    stats: { total, byStage, stageHighlights },
  });
});

router.get('/:id/activity', (req, res) => {
  const contact = db.prepare('SELECT id FROM contacts WHERE id = ?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Not found' });

  seedContactActivitiesFromNotes(contact.id);

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
  const offset = (page - 1) * limit;

  const conditions = ['contact_id = ?'];
  const params = [contact.id];

  if (req.query.type && req.query.type !== 'all') {
    conditions.push('event_type = ?');
    params.push(req.query.type);
  }
  if (req.query.mailbox) {
    conditions.push('mailbox = ?');
    params.push(req.query.mailbox);
  }

  const where = conditions.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as c FROM contact_activity WHERE ${where}`).get(...params).c;

  const activities = db.prepare(`
    SELECT a.*, u.name as user_name
    FROM contact_activity a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE ${where}
    ORDER BY datetime(a.occurred_at) DESC, a.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const lastComm = db.prepare(`
    SELECT MAX(occurred_at) as t FROM contact_activity WHERE contact_id = ?
  `).get(contact.id)?.t;

  res.json({ activities, total, page, limit, lastCommunication: lastComm });
});

router.post('/:id/activity', (req, res) => {
  const contact = db.prepare('SELECT id FROM contacts WHERE id = ?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Not found' });

  const { body, event_type: type = 'note' } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'body is required' });

  const result = db.prepare(`
    INSERT INTO contact_activity (contact_id, user_id, event_type, summary, body, occurred_at, direction, mailbox)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'unknown', 'heyday')
  `).run(contact.id, req.user.id, type, body.trim().slice(0, 120), body.trim());

  const activity = db.prepare(`
    SELECT a.*, u.name as user_name FROM contact_activity a
    LEFT JOIN users u ON u.id = a.user_id WHERE a.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ activity });
});

router.get('/:id', (req, res) => {
  const contact = db.prepare(`
    SELECT c.*, u.name as assigned_user_name
    FROM contacts c
    LEFT JOIN users u ON u.id = c.assigned_to
    WHERE c.id = ?
  `).get(req.params.id);

  if (!contact) return res.status(404).json({ error: 'Not found' });

  let raw = null;
  if (contact.raw_json) {
    try {
      raw = JSON.parse(contact.raw_json);
    } catch {
      raw = null;
    }
  }

  res.json({ contact: { ...contact, raw } });
});

router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const sets = [];
  const values = [];
  for (const field of PATCH_FIELDS) {
    if (!(field in req.body)) continue;
    let val = req.body[field];
    if (field === 'is_contacted') val = val ? 1 : 0;
    if (typeof val === 'string') val = val.trim() || null;
    sets.push(`${field} = ?`);
    values.push(val);
  }

  if (sets.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(req.params.id);

  if ('notes' in req.body && req.body.notes?.trim()) {
    db.prepare(`
      INSERT INTO contact_activity (contact_id, user_id, event_type, summary, body, occurred_at, direction, mailbox)
      VALUES (?, ?, 'note', 'Note updated', ?, CURRENT_TIMESTAMP, 'unknown', 'heyday')
    `).run(req.params.id, req.user.id, req.body.notes.trim());
  }

  db.prepare(`UPDATE contacts SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  const contact = db.prepare(`
    SELECT c.*, u.name as assigned_user_name FROM contacts c
    LEFT JOIN users u ON u.id = c.assigned_to WHERE c.id = ?
  `).get(req.params.id);

  res.json({ contact });
});

export default router;
