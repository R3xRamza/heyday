import { Router } from 'express';
import db from '../db.js';
import { isOverdue, isDueThisWeek, weekRangeSunday } from '../lib/timing.js';

const router = Router();

function memberStats(userId) {
  const tasks = db.prepare(`
    SELECT status, due_date FROM tasks WHERE assigned_to = ?
  `).all(userId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { start, end } = weekRangeSunday(today);

  let overdue = 0;
  let thisWeek = 0;
  let thisWeekComplete = 0;
  let thisWeekTotal = 0;

  for (const t of tasks) {
    if (!t.due_date) continue;

    if (isOverdue(t.due_date, t.status)) {
      overdue += 1;
      continue;
    }

    if (t.due_date < start || t.due_date > end) continue;

    thisWeekTotal += 1;
    if (t.status === 'complete') {
      thisWeekComplete += 1;
    } else if (isDueThisWeek(t.due_date, t.status, today)) {
      thisWeek += 1;
    }
  }

  const progress = thisWeekTotal ? Math.round((thisWeekComplete / thisWeekTotal) * 100) : 0;

  return { thisWeek, overdue, thisWeekComplete, thisWeekTotal, progress };
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
