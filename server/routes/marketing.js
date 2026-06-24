import { Router } from 'express';
import db from '../db.js';
import { celebrationsInRange } from '../lib/marketingCalendar.js';

const router = Router();

const POST_FIELDS = ['title', 'platform', 'status', 'scheduled_date', 'notes'];

function pickPost(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    platform: row.platform,
    status: row.status,
    scheduled_date: row.scheduled_date,
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validatePost(body, partial = false) {
  if (!partial || body.title !== undefined) {
    if (!body.title?.trim()) return 'title is required';
  }
  if (!partial || body.platform !== undefined) {
    if (!body.platform?.trim()) return 'platform is required';
  }
  if (!partial || body.scheduled_date !== undefined) {
    if (!body.scheduled_date) return 'scheduled_date is required';
  }
  if (body.status && !['planning', 'posting', 'done'].includes(body.status)) {
    return 'status must be planning, posting, or done';
  }
  return null;
}

router.get('/calendar', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end are required' });

  const posts = db.prepare(`
    SELECT * FROM marketing_posts
    WHERE scheduled_date >= ? AND scheduled_date <= ?
    ORDER BY scheduled_date ASC, id ASC
  `).all(start, end).map(pickPost);

  res.json({ posts });
});

router.get('/birthdays', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end are required' });

  const contacts = db.prepare(`
    SELECT id, name, birthday, anniversary, partner_birthday, partner_name, person_type, stage, home_anniversary
    FROM contacts
    WHERE (birthday IS NOT NULL AND TRIM(birthday) != '')
       OR (anniversary IS NOT NULL AND TRIM(anniversary) != '')
       OR (partner_birthday IS NOT NULL AND TRIM(partner_birthday) != '')
       OR (home_anniversary IS NOT NULL AND TRIM(home_anniversary) != '')
  `).all();

  const events = celebrationsInRange(contacts, start, end);
  res.json({ events });
});

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

function validateMonthKey(month) {
  if (!month || !MONTH_KEY_RE.test(month)) return 'month must be YYYY-MM';
  const [, m] = month.split('-').map(Number);
  if (m < 1 || m > 12) return 'month must be YYYY-MM';
  return null;
}

router.get('/birthday-pins', (req, res) => {
  const { month } = req.query;
  const err = validateMonthKey(month);
  if (err) return res.status(400).json({ error: err });

  const rows = db.prepare(`
    SELECT contact_id FROM marketing_birthday_pins WHERE month = ? ORDER BY contact_id ASC
  `).all(month);

  res.json({ month, contact_ids: rows.map((r) => r.contact_id) });
});

router.put('/birthday-pins', (req, res) => {
  const { month, contact_ids: contactIds } = req.body;
  const err = validateMonthKey(month);
  if (err) return res.status(400).json({ error: err });
  if (!Array.isArray(contactIds)) return res.status(400).json({ error: 'contact_ids array is required' });

  const ids = [...new Set(contactIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];

  db.transaction(() => {
    db.prepare('DELETE FROM marketing_birthday_pins WHERE month = ?').run(month);
    const insert = db.prepare('INSERT INTO marketing_birthday_pins (month, contact_id) VALUES (?, ?)');
    for (const contactId of ids) {
      insert.run(month, contactId);
    }
  })();

  res.json({ month, contact_ids: ids });
});

router.get('/platform-goals', (_req, res) => {
  const goals = db.prepare(`
    SELECT * FROM marketing_platform_goals ORDER BY sort_order ASC, platform ASC
  `).all();
  res.json({ goals });
});

router.put('/platform-goals', (req, res) => {
  const { goals } = req.body;
  if (!Array.isArray(goals)) return res.status(400).json({ error: 'goals array is required' });

  const upsert = db.prepare(`
    INSERT INTO marketing_platform_goals (platform, frequency, goal, color, sort_order)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(platform) DO UPDATE SET
      frequency = excluded.frequency,
      goal = excluded.goal,
      color = excluded.color,
      sort_order = excluded.sort_order
  `);

  db.transaction(() => {
    goals.forEach((g, i) => {
      if (!g.platform?.trim()) return;
      upsert.run(
        g.platform.trim(),
        g.frequency?.trim() || null,
        g.goal?.trim() || null,
        g.color?.trim() || null,
        g.sort_order ?? i,
      );
    });
  })();

  const updated = db.prepare(`
    SELECT * FROM marketing_platform_goals ORDER BY sort_order ASC, platform ASC
  `).all();
  res.json({ goals: updated });
});

router.post('/platform-goals', (req, res) => {
  const { platform, frequency, goal, color } = req.body;
  if (!platform?.trim()) return res.status(400).json({ error: 'platform is required' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM marketing_platform_goals').get().m;

  try {
    db.prepare(`
      INSERT INTO marketing_platform_goals (platform, frequency, goal, color, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(platform.trim(), frequency?.trim() || null, goal?.trim() || null, color?.trim() || '#053e3f', maxOrder + 1);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Platform already exists' });
    }
    throw e;
  }

  const goals = db.prepare(`
    SELECT * FROM marketing_platform_goals ORDER BY sort_order ASC, platform ASC
  `).all();
  res.json({ goals });
});

router.get('/posts', (req, res) => {
  const { start, end } = req.query;
  let sql = 'SELECT * FROM marketing_posts WHERE 1=1';
  const params = [];
  if (start) {
    sql += ' AND scheduled_date >= ?';
    params.push(start);
  }
  if (end) {
    sql += ' AND scheduled_date <= ?';
    params.push(end);
  }
  sql += ' ORDER BY scheduled_date ASC, id ASC';
  const posts = db.prepare(sql).all(...params).map(pickPost);
  res.json({ posts });
});

router.get('/posts/:id', (req, res) => {
  const post = pickPost(db.prepare('SELECT * FROM marketing_posts WHERE id = ?').get(req.params.id));
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json({ post });
});

router.post('/posts', (req, res) => {
  const err = validatePost(req.body);
  if (err) return res.status(400).json({ error: err });

  const { title, platform, status = 'planning', scheduled_date, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO marketing_posts (title, platform, status, scheduled_date, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(),
    platform.trim(),
    status,
    scheduled_date,
    notes?.trim() || null,
    req.user?.id ?? null,
  );

  const post = pickPost(db.prepare('SELECT * FROM marketing_posts WHERE id = ?').get(result.lastInsertRowid));
  res.status(201).json({ post });
});

router.patch('/posts/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM marketing_posts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const err = validatePost(req.body, true);
  if (err) return res.status(400).json({ error: err });

  const updates = {};
  for (const f of POST_FIELDS) {
    if (req.body[f] !== undefined) {
      updates[f] = f === 'title' || f === 'platform' || f === 'notes'
        ? (req.body[f]?.trim() || null)
        : req.body[f];
    }
  }

  const sets = Object.keys(updates).map((k) => `${k} = ?`);
  if (sets.length === 0) return res.json({ post: pickPost(existing) });

  sets.push('updated_at = CURRENT_TIMESTAMP');
  const values = Object.values(updates);
  values.push(req.params.id);

  db.prepare(`UPDATE marketing_posts SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  const post = pickPost(db.prepare('SELECT * FROM marketing_posts WHERE id = ?').get(req.params.id));
  res.json({ post });
});

router.delete('/posts/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM marketing_posts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM marketing_posts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/', (_req, res) => {
  const postCount = db.prepare('SELECT COUNT(*) as c FROM marketing_posts').get().c;
  const doneCount = db.prepare("SELECT COUNT(*) as c FROM marketing_posts WHERE status = 'done'").get().c;
  const pct = postCount ? Math.round((doneCount / postCount) * 100) : 0;
  res.json({ status: `${pct}% On-Schedule`, postCount, doneCount });
});

export default router;
