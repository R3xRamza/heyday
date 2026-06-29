import { Router } from 'express';
import db from '../db.js';
import { isOverdue } from '../lib/timing.js';

const router = Router();

function memberStats(userId) {
  const tasks = db.prepare(`
    SELECT status, due_date, priority FROM tasks WHERE assigned_to = ?
  `).all(userId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  let complete = 0;
  let overdue = 0;
  let active = 0;
  let pending = 0;

  for (const t of tasks) {
    if (t.status === 'complete') {
      complete += 1;
      continue;
    }
    if (isOverdue(t.due_date, t.status)) {
      overdue += 1;
    } else if (t.due_date === todayStr) {
      active += 1;
    } else {
      pending += 1;
    }
  }

  const total = tasks.length;
  const progress = total ? Math.round((complete / total) * 100) : 0;

  return { total, complete, pending, active, overdue, progress };
}

router.get('/', (_req, res) => {
  const members = db.prepare(`
    SELECT id, name, email, role FROM users
    WHERE email != 'admin@theheydaygroup.com'
    ORDER BY CASE email
      WHEN 'tessa@theheydaygroup.com' THEN 0
      WHEN 'adam@theheydaygroup.com' THEN 1
      WHEN 'margaret@theheydaygroup.com' THEN 2
      WHEN 'meredith@theheydaygroup.com' THEN 3
      ELSE 99
    END, name
  `).all();

  const team = members.length
    ? members
    : db.prepare('SELECT id, name, email, role FROM users ORDER BY name').all();

  res.json({
    members: team.map((m) => ({ ...m, stats: memberStats(m.id) })),
  });
});

router.get('/:id', (req, res) => {
  const member = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Not found' });
  res.json({ member: { ...member, stats: memberStats(member.id) } });
});

export default router;
