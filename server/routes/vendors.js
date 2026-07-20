import { Router } from 'express';
import db from '../db.js';

const router = Router();

const SORT_MAP = {
  rating: 'v.rating',
  name: 'v.name',
  updated_at: 'v.updated_at',
};

const PATCH_FIELDS = [
  'name', 'company', 'category', 'phone', 'email', 'website', 'rating', 'notes',
];

function trimOrNull(val) {
  if (val == null) return null;
  if (typeof val !== 'string') return val;
  const t = val.trim();
  return t || null;
}

function normalizeRating(val) {
  if (val === null || val === '' || val === undefined) return null;
  const n = parseInt(val, 10);
  if (!Number.isFinite(n) || n < 1 || n > 5) return undefined;
  return n;
}

function getVendor(id) {
  return db.prepare(`
    SELECT v.*,
      cu.name as created_by_name,
      uu.name as updated_by_name
    FROM vendors v
    LEFT JOIN users cu ON cu.id = v.created_by
    LEFT JOIN users uu ON uu.id = v.updated_by
    WHERE v.id = ?
  `).get(id);
}

router.get('/categories', (_req, res) => {
  const categories = db.prepare(`
    SELECT category as value, COUNT(*) as count
    FROM vendors
    WHERE category IS NOT NULL AND category != ''
    GROUP BY category
    ORDER BY count DESC, category ASC
  `).all();
  res.json({ categories });
});

router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = (page - 1) * limit;

  const sortKey = SORT_MAP[req.query.sort] || SORT_MAP.rating;
  const sortDir = req.query.order === 'asc' ? 'ASC' : 'DESC';

  const conditions = ['1=1'];
  const params = [];

  const search = (req.query.search || '').trim();
  if (search) {
    const q = `%${search.toLowerCase()}%`;
    conditions.push(`(
      LOWER(v.name) LIKE ? OR LOWER(IFNULL(v.company,'')) LIKE ?
      OR LOWER(IFNULL(v.category,'')) LIKE ? OR LOWER(IFNULL(v.notes,'')) LIKE ?
      OR LOWER(IFNULL(v.phone,'')) LIKE ? OR LOWER(IFNULL(v.email,'')) LIKE ?
    )`);
    params.push(q, q, q, q, q, q);
  }

  const category = (req.query.category || '').trim();
  if (category) {
    conditions.push('LOWER(v.category) = LOWER(?)');
    params.push(category);
  }

  const where = conditions.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as c FROM vendors v WHERE ${where}`).get(...params).c;

  const vendors = db.prepare(`
    SELECT v.*,
      cu.name as created_by_name,
      uu.name as updated_by_name
    FROM vendors v
    LEFT JOIN users cu ON cu.id = v.created_by
    LEFT JOIN users uu ON uu.id = v.updated_by
    WHERE ${where}
    ORDER BY (${sortKey} IS NULL), ${sortKey} ${sortDir}, v.name ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ vendors, total, page, limit });
});

router.get('/:id', (req, res) => {
  const vendor = getVendor(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Not found' });
  res.json({ vendor });
});

router.post('/', (req, res) => {
  const name = trimOrNull(req.body.name);
  if (!name) return res.status(400).json({ error: 'name is required' });

  let rating = null;
  if ('rating' in req.body) {
    const r = normalizeRating(req.body.rating);
    if (r === undefined) return res.status(400).json({ error: 'rating must be 1–5 or null' });
    rating = r;
  }

  const result = db.prepare(`
    INSERT INTO vendors (name, company, category, phone, email, website, rating, notes, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    trimOrNull(req.body.company),
    trimOrNull(req.body.category),
    trimOrNull(req.body.phone),
    trimOrNull(req.body.email),
    trimOrNull(req.body.website),
    rating,
    trimOrNull(req.body.notes),
    req.user.id,
    req.user.id,
  );

  res.status(201).json({ vendor: getVendor(result.lastInsertRowid) });
});

router.patch('/:id', (req, res) => {
  const existing = getVendor(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const sets = [];
  const values = [];

  for (const field of PATCH_FIELDS) {
    if (!(field in req.body)) continue;

    if (field === 'rating') {
      const r = normalizeRating(req.body.rating);
      if (r === undefined) return res.status(400).json({ error: 'rating must be 1–5 or null' });
      sets.push('rating = ?');
      values.push(r);
      continue;
    }

    if (field === 'name') {
      const name = trimOrNull(req.body.name);
      if (!name) return res.status(400).json({ error: 'name is required' });
      sets.push('name = ?');
      values.push(name);
      continue;
    }

    sets.push(`${field} = ?`);
    values.push(trimOrNull(req.body[field]));
  }

  if (sets.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  sets.push('updated_at = CURRENT_TIMESTAMP');
  sets.push('updated_by = ?');
  values.push(req.user.id);
  values.push(req.params.id);

  db.prepare(`UPDATE vendors SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  res.json({ vendor: getVendor(req.params.id) });
});

router.delete('/:id', (req, res) => {
  const existing = getVendor(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
