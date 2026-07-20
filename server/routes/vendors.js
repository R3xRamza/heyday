import { Router } from 'express';
import db from '../db.js';

const router = Router();

const SORT_MAP = {
  likes: 'like_count',
  name: 'v.name',
  category: 'v.category',
  updated_at: 'v.updated_at',
};

const PATCH_FIELDS = [
  'name', 'company', 'category', 'phone', 'email', 'website', 'notes',
];

function trimOrNull(val) {
  if (val == null) return null;
  if (typeof val !== 'string') return val;
  const t = val.trim();
  return t || null;
}

function getLikes(vendorId, userId = null) {
  return db.prepare(`
    SELECT vl.*, u.name as user_name, u.email as user_email,
      CASE WHEN vl.user_id = ? THEN 1 ELSE 0 END as is_mine
    FROM vendor_likes vl
    LEFT JOIN users u ON u.id = vl.user_id
    WHERE vl.vendor_id = ?
    ORDER BY datetime(vl.created_at) DESC, vl.id DESC
  `).all(userId ?? 0, vendorId).map((l) => ({
    ...l,
    is_mine: !!l.is_mine,
  }));
}

function getVendor(id, userId = null) {
  const vendor = db.prepare(`
    SELECT v.*,
      cu.name as created_by_name,
      uu.name as updated_by_name,
      (SELECT COUNT(*) FROM vendor_likes vl WHERE vl.vendor_id = v.id) as like_count,
      CASE WHEN EXISTS (
        SELECT 1 FROM vendor_likes vl
        WHERE vl.vendor_id = v.id AND vl.user_id = ?
      ) THEN 1 ELSE 0 END as liked_by_me
    FROM vendors v
    LEFT JOIN users cu ON cu.id = v.created_by
    LEFT JOIN users uu ON uu.id = v.updated_by
    WHERE v.id = ?
  `).get(userId ?? 0, id);

  if (!vendor) return null;
  return {
    ...vendor,
    liked_by_me: !!vendor.liked_by_me,
    like_count: vendor.like_count ?? 0,
    likes: getLikes(id, userId),
  };
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
  const userId = req.user.id;

  const sortKey = SORT_MAP[req.query.sort] || SORT_MAP.likes;
  const sortDir = req.query.order === 'asc' ? 'ASC' : 'DESC';
  const orderBy = sortKey === 'v.name' || sortKey === 'v.category'
    ? `${sortKey} COLLATE NOCASE ${sortDir}, v.name COLLATE NOCASE ASC`
    : `${sortKey} ${sortDir}, v.name COLLATE NOCASE ASC`;

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
      uu.name as updated_by_name,
      (SELECT COUNT(*) FROM vendor_likes vl WHERE vl.vendor_id = v.id) as like_count,
      CASE WHEN EXISTS (
        SELECT 1 FROM vendor_likes vl
        WHERE vl.vendor_id = v.id AND vl.user_id = ?
      ) THEN 1 ELSE 0 END as liked_by_me
    FROM vendors v
    LEFT JOIN users cu ON cu.id = v.created_by
    LEFT JOIN users uu ON uu.id = v.updated_by
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(userId, ...params, limit, offset).map((v) => ({
    ...v,
    liked_by_me: !!v.liked_by_me,
    like_count: v.like_count ?? 0,
  }));

  res.json({ vendors, total, page, limit });
});

router.get('/:id', (req, res) => {
  const vendor = getVendor(req.params.id, req.user.id);
  if (!vendor) return res.status(404).json({ error: 'Not found' });
  res.json({ vendor });
});

router.post('/', (req, res) => {
  const name = trimOrNull(req.body.name);
  if (!name) return res.status(400).json({ error: 'name is required' });

  const result = db.prepare(`
    INSERT INTO vendors (name, company, category, phone, email, website, notes, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    trimOrNull(req.body.company),
    trimOrNull(req.body.category),
    trimOrNull(req.body.phone),
    trimOrNull(req.body.email),
    trimOrNull(req.body.website),
    trimOrNull(req.body.notes),
    req.user.id,
    req.user.id,
  );

  res.status(201).json({ vendor: getVendor(result.lastInsertRowid, req.user.id) });
});

router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM vendors WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const sets = [];
  const values = [];

  for (const field of PATCH_FIELDS) {
    if (!(field in req.body)) continue;

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

  res.json({ vendor: getVendor(req.params.id, req.user.id) });
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM vendors WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/** Always insert a new like (multiple likes + notes per person allowed). */
router.post('/:id/likes', (req, res) => {
  const vendor = db.prepare('SELECT id FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Not found' });

  const note = trimOrNull(req.body.note);
  db.prepare(`
    INSERT INTO vendor_likes (vendor_id, user_id, note)
    VALUES (?, ?, ?)
  `).run(vendor.id, req.user.id, note);

  res.status(201).json({ vendor: getVendor(vendor.id, req.user.id) });
});

/** Edit a like note — any auth user. */
router.patch('/:id/likes/:likeId', (req, res) => {
  const vendor = db.prepare('SELECT id FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Not found' });

  const like = db.prepare(`
    SELECT id FROM vendor_likes WHERE id = ? AND vendor_id = ?
  `).get(req.params.likeId, vendor.id);
  if (!like) return res.status(404).json({ error: 'Like not found' });

  if (!('note' in req.body)) {
    return res.status(400).json({ error: 'note is required' });
  }

  db.prepare(`
    UPDATE vendor_likes
    SET note = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(trimOrNull(req.body.note), like.id);

  res.json({ vendor: getVendor(vendor.id, req.user.id) });
});

/** Remove a like — any auth user. */
router.delete('/:id/likes/:likeId', (req, res) => {
  const vendor = db.prepare('SELECT id FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Not found' });

  const like = db.prepare(`
    SELECT id FROM vendor_likes WHERE id = ? AND vendor_id = ?
  `).get(req.params.likeId, vendor.id);
  if (!like) return res.status(404).json({ error: 'Like not found' });

  db.prepare('DELETE FROM vendor_likes WHERE id = ?').run(like.id);
  res.json({ vendor: getVendor(vendor.id, req.user.id) });
});

export default router;
