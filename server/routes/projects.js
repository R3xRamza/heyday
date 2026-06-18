import { Router } from 'express';
import db from '../db.js';

const router = Router();

function canWriteForUser(reqUser, userId) {
  return reqUser.id === userId || reqUser.role === 'admin';
}

function getProjectOr404(id) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

router.get('/', (req, res) => {
  const userId = Number(req.query.user_id);
  if (!userId) return res.status(400).json({ error: 'user_id is required' });

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const projects = db.prepare(`
    SELECT * FROM projects
    WHERE user_id = ? AND status != 'archived'
    ORDER BY sort_order, updated_at DESC, id DESC
  `).all(userId);

  res.json({ projects });
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
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM projects WHERE user_id = ?',
  ).get(userId);

  const result = db.prepare(`
    INSERT INTO projects (user_id, title, description, sort_order)
    VALUES (?, ?, ?, ?)
  `).run(userId, title, req.body.description?.trim() || null, maxOrder.m + 1);

  res.status(201).json({ project: getProjectOr404(result.lastInsertRowid) });
});

router.patch('/:id', (req, res) => {
  const project = getProjectOr404(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!canWriteForUser(req.user, project.user_id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const title = req.body.title != null ? req.body.title.trim() : project.title;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const description = req.body.description != null
    ? (req.body.description.trim() || null)
    : project.description;

  db.prepare(`
    UPDATE projects SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(title, description, project.id);

  res.json({ project: getProjectOr404(project.id) });
});

router.delete('/:id', (req, res) => {
  const project = getProjectOr404(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!canWriteForUser(req.user, project.user_id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
  res.json({ ok: true });
});

export default router;
