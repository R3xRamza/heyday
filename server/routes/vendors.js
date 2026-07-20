import { Router } from 'express';
import db from '../db.js';

const router = Router();

const SORT_MAP = {
  likes: 'like_count',
  dislikes: 'dislike_count',
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

function normalizeKind(val) {
  const k = String(val || 'like').trim().toLowerCase();
  return k === 'dislike' ? 'dislike' : 'like';
}

function getReactions(vendorId, userId = null) {
  return db.prepare(`
    SELECT vl.*, u.name as user_name, u.email as user_email,
      CASE WHEN vl.user_id = ? THEN 1 ELSE 0 END as is_mine
    FROM vendor_likes vl
    LEFT JOIN users u ON u.id = vl.user_id
    WHERE vl.vendor_id = ?
    ORDER BY datetime(vl.created_at) DESC, vl.id DESC
  `).all(userId ?? 0, vendorId).map((l) => ({
    ...l,
    kind: normalizeKind(l.kind),
    is_mine: !!l.is_mine,
  }));
}

const VENDOR_SELECT_COUNTS = `
  (SELECT COUNT(*) FROM vendor_likes vl WHERE vl.vendor_id = v.id AND IFNULL(vl.kind, 'like') = 'like') as like_count,
  (SELECT COUNT(*) FROM vendor_likes vl WHERE vl.vendor_id = v.id AND vl.kind = 'dislike') as dislike_count,
  CASE WHEN EXISTS (
    SELECT 1 FROM vendor_likes vl
    WHERE vl.vendor_id = v.id AND vl.user_id = ? AND IFNULL(vl.kind, 'like') = 'like'
  ) THEN 1 ELSE 0 END as liked_by_me,
  CASE WHEN EXISTS (
    SELECT 1 FROM vendor_likes vl
    WHERE vl.vendor_id = v.id AND vl.user_id = ? AND vl.kind = 'dislike'
  ) THEN 1 ELSE 0 END as disliked_by_me
`;

function decorateVendor(row) {
  return {
    ...row,
    liked_by_me: !!row.liked_by_me,
    disliked_by_me: !!row.disliked_by_me,
    like_count: row.like_count ?? 0,
    dislike_count: row.dislike_count ?? 0,
  };
}

function getVendor(id, userId = null) {
  const uid = userId ?? 0;
  const vendor = db.prepare(`
    SELECT v.*,
      cu.name as created_by_name,
      uu.name as updated_by_name,
      ${VENDOR_SELECT_COUNTS}
    FROM vendors v
    LEFT JOIN users cu ON cu.id = v.created_by
    LEFT JOIN users uu ON uu.id = v.updated_by
    WHERE v.id = ?
  `).get(uid, uid, id);

  if (!vendor) return null;
  return {
    ...decorateVendor(vendor),
    likes: getReactions(id, userId),
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
      ${VENDOR_SELECT_COUNTS}
    FROM vendors v
    LEFT JOIN users cu ON cu.id = v.created_by
    LEFT JOIN users uu ON uu.id = v.updated_by
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(userId, userId, ...params, limit, offset).map(decorateVendor);

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

/** Insert a like or dislike (multiple per person allowed). */
router.post('/:id/likes', (req, res) => {
  const vendor = db.prepare('SELECT id FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Not found' });

  const note = trimOrNull(req.body.note);
  const kind = normalizeKind(req.body.kind);
  db.prepare(`
    INSERT INTO vendor_likes (vendor_id, user_id, note, kind)
    VALUES (?, ?, ?, ?)
  `).run(vendor.id, req.user.id, note, kind);

  res.status(201).json({ vendor: getVendor(vendor.id, req.user.id) });
});

/** Edit a reaction note — any auth user. */
router.patch('/:id/likes/:likeId', (req, res) => {
  const vendor = db.prepare('SELECT id FROM vendors WHERE id = ?').get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Not found' });

  const like = db.prepare(`
    SELECT id FROM vendor_likes WHERE id = ? AND vendor_id = ?
  `).get(req.params.likeId, vendor.id);
  if (!like) return res.status(404).json({ error: 'Like not found' });

  if (!('note' in req.body) && !('kind' in req.body)) {
    return res.status(400).json({ error: 'note or kind is required' });
  }

  const sets = [];
  const values = [];
  if ('note' in req.body) {
    sets.push('note = ?');
    values.push(trimOrNull(req.body.note));
  }
  if ('kind' in req.body) {
    sets.push('kind = ?');
    values.push(normalizeKind(req.body.kind));
  }
  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(like.id);

  db.prepare(`UPDATE vendor_likes SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  res.json({ vendor: getVendor(vendor.id, req.user.id) });
});

/** Remove a reaction — any auth user. */
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
