import { Router } from 'express';
import db from '../db.js';

const router = Router();

function canWriteForUser(reqUser, userId) {
  return reqUser.id === userId || reqUser.role === 'admin';
}

function purgeOldCompleted(userId) {
  db.prepare(`
    DELETE FROM user_todos
    WHERE user_id = ?
      AND is_complete = 1
      AND completed_at IS NOT NULL
      AND completed_at < datetime('now', '-7 days')
  `).run(userId);
}

function getItems(userId) {
  return db.prepare(`
    SELECT * FROM user_todos
    WHERE user_id = ?
    ORDER BY sort_order, id
  `).all(userId).map((item) => ({
    ...item,
    is_complete: Boolean(item.is_complete),
  }));
}

function latestUpdatedAt(userId) {
  const row = db.prepare(`
    SELECT MAX(COALESCE(completed_at, created_at)) as t
    FROM user_todos
    WHERE user_id = ?
  `).get(userId);
  return row?.t || null;
}

function getTodoOr404(id) {
  return db.prepare('SELECT * FROM user_todos WHERE id = ?').get(id);
}

router.get('/', (req, res) => {
  const userId = Number(req.query.user_id);
  if (!userId) return res.status(400).json({ error: 'user_id is required' });

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  purgeOldCompleted(userId);
  res.json({
    items: getItems(userId),
    updated_at: latestUpdatedAt(userId),
  });
});

router.post('/', (req, res) => {
  const userId = Number(req.body.user_id);
  const title = req.body.title?.trim();
  if (!userId) return res.status(400).json({ error: 'user_id is required' });
  if (!title) return res.status(400).json({ error: 'title is required' });

  if (!canWriteForUser(req.user, userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM user_todos WHERE user_id = ?',
  ).get(userId);

  const result = db.prepare(`
    INSERT INTO user_todos (user_id, title, notes, due_date, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    userId,
    title,
    req.body.notes?.trim() || null,
    req.body.due_date?.trim() || null,
    maxOrder.m + 1,
  );

  const item = getItems(userId).find((i) => i.id === result.lastInsertRowid);
  res.status(201).json({ item, updated_at: latestUpdatedAt(userId) });
});

router.patch('/:id', (req, res) => {
  const todo = getTodoOr404(req.params.id);
  if (!todo) return res.status(404).json({ error: 'Todo not found' });
  if (!canWriteForUser(req.user, todo.user_id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const title = req.body.title != null ? req.body.title.trim() : todo.title;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const notes = req.body.notes != null ? (req.body.notes.trim() || null) : todo.notes;

  const due_date = req.body.due_date !== undefined
    ? (req.body.due_date?.trim() || null)
    : todo.due_date;

  let is_complete = todo.is_complete;
  let completed_at = todo.completed_at;
  if (req.body.is_complete !== undefined) {
    is_complete = req.body.is_complete ? 1 : 0;
    completed_at = is_complete ? new Date().toISOString() : null;
  }

  db.prepare(`
    UPDATE user_todos
    SET title = ?, notes = ?, due_date = ?, is_complete = ?, completed_at = ?
    WHERE id = ?
  `).run(title, notes, due_date, is_complete, completed_at, todo.id);

  purgeOldCompleted(todo.user_id);
  const item = getItems(todo.user_id).find((i) => i.id === todo.id);
  res.json({ item, updated_at: latestUpdatedAt(todo.user_id) });
});

router.delete('/:id', (req, res) => {
  const todo = getTodoOr404(req.params.id);
  if (!todo) return res.status(404).json({ error: 'Todo not found' });
  if (!canWriteForUser(req.user, todo.user_id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.prepare('DELETE FROM user_todos WHERE id = ?').run(todo.id);
  res.json({ ok: true, updated_at: latestUpdatedAt(todo.user_id) });
});

export default router;
