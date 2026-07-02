import { Router } from 'express';
import db from '../db.js';
import { isOverdue, isDueThisWeek } from '../lib/timing.js';
import { celebrationsInRange, toDateStr } from '../lib/marketingCalendar.js';
import { ACTIVE_LISTINGS_SCOPE, closedYtdStats, hubTransactionRows } from '../lib/transactionScopes.js';

const router = Router();

const ACTIVE_LEAD_STAGES = [
  'Lead',
  'Hot Prospect (0-3 months)',
  'Nurture (4+ months out)',
  'Client: Actively Working',
  'Active Listing',
  'Under Contract',
];

const TEAM_ORDER_SQL = `
  CASE email
    WHEN 'tessa@theheydaygroup.com' THEN 0
    WHEN 'adam@theheydaygroup.com' THEN 1
    WHEN 'margaret@theheydaygroup.com' THEN 2
    WHEN 'meredith@theheydaygroup.com' THEN 3
    ELSE 99
  END, name
`;

function isAdmin(user) {
  return user?.role === 'admin';
}

router.get('/stats', (_req, res) => {
  const closedYtd = closedYtdStats(db);

  const pending = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as volume
    FROM transactions WHERE stage = 'pending' AND close_date IS NOT NULL
  `).get();

  const activeListings = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as volume
    FROM transactions WHERE ${ACTIVE_LISTINGS_SCOPE}
  `).get();

  const placeholders = ACTIVE_LEAD_STAGES.map(() => '?').join(', ');
  const activeLeads = db.prepare(`
    SELECT COUNT(*) as count FROM contacts
    WHERE stage IN (${placeholders}) AND COALESCE(person_type, 'contact') != 'child'
  `).get(...ACTIVE_LEAD_STAGES);

  const { comingSoon, listings, pendingDeals } = hubTransactionRows(db);

  res.json({
    closedYtd,
    pending,
    activeListings,
    activeLeads: { count: activeLeads.count },
    comingSoon,
    listings,
    pendingDeals,
  });
});

function hubCelebrationWindow() {
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  const end = new Date(start);
  if (start.getDay() === 5) {
    end.setDate(end.getDate() + 2);
  }
  return { start: toDateStr(start), end: toDateStr(end) };
}

router.get('/celebrations', (req, res) => {
  let startStr;
  let endStr;
  if (req.query.window === 'hub' || (!req.query.days && !req.query.start)) {
    ({ start: startStr, end: endStr } = hubCelebrationWindow());
  } else if (req.query.days) {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);
    startStr = toDateStr(start);
    endStr = toDateStr(end);
  } else {
    startStr = req.query.start;
    endStr = req.query.end;
  }

  const contacts = db.prepare(`
    SELECT id, name, birthday, anniversary, partner_birthday, partner_name, person_type, home_anniversary
    FROM contacts
    WHERE (birthday IS NOT NULL AND TRIM(birthday) != '')
       OR (anniversary IS NOT NULL AND TRIM(anniversary) != '')
       OR (partner_birthday IS NOT NULL AND TRIM(partner_birthday) != '')
       OR (home_anniversary IS NOT NULL AND TRIM(home_anniversary) != '')
  `).all();

  const events = celebrationsInRange(contacts, startStr, endStr);
  res.json({ events, start: startStr, end: endStr });
});

router.get('/team-tasks', (_req, res) => {
  const members = db.prepare(`
    SELECT id, name, email, role FROM users
    WHERE email != 'admin@theheydaygroup.com'
    ORDER BY ${TEAM_ORDER_SQL}
  `).all();

  const openTasksStmt = db.prepare(`
    SELECT t.id, t.title, t.due_date, t.status, t.transaction_id,
      tt.calendar_nickname
    FROM tasks t
    LEFT JOIN template_tasks tt ON tt.id = t.template_task_id
    WHERE t.assigned_to = ? AND t.status != 'complete'
    ORDER BY (t.due_date IS NULL), t.due_date ASC, t.id ASC
  `);

  const summary = members.map((m) => {
    const open = openTasksStmt.all(m.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueTasks = open.filter((t) => isOverdue(t.due_date, t.status));
    const activeTasks = open.filter((t) => isDueThisWeek(t.due_date, t.status, today));

    overdueTasks.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
    activeTasks.sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));

    const nextTasks = [...overdueTasks, ...activeTasks].slice(0, 3).map((t) => ({
      ...t,
      is_overdue: isOverdue(t.due_date, t.status),
    }));

    return {
      ...m,
      activeCount: activeTasks.length,
      overdueCount: overdueTasks.length,
      nextTasks,
    };
  });

  res.json({ members: summary });
});

router.get('/messages', (_req, res) => {
  const messages = db.prepare(`
    SELECT m.*, u.name as user_name, u.email as user_email
    FROM team_messages m
    LEFT JOIN users u ON u.id = m.user_id
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 50
  `).all();
  res.json({ messages });
});

router.post('/messages', (req, res) => {
  const body = req.body.body?.trim();
  if (!body) return res.status(400).json({ error: 'body is required' });

  const r = db.prepare('INSERT INTO team_messages (user_id, body) VALUES (?, ?)').run(req.user.id, body);
  const message = db.prepare(`
    SELECT m.*, u.name as user_name, u.email as user_email
    FROM team_messages m LEFT JOIN users u ON u.id = m.user_id
    WHERE m.id = ?
  `).get(r.lastInsertRowid);
  res.status(201).json({ message });
});

router.delete('/messages/:id', (req, res) => {
  const message = db.prepare('SELECT * FROM team_messages WHERE id = ?').get(req.params.id);
  if (!message) return res.status(404).json({ error: 'Not found' });
  if (message.user_id !== req.user.id && !isAdmin(req.user)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  db.prepare('DELETE FROM team_messages WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/links', (_req, res) => {
  const links = db.prepare('SELECT * FROM team_links ORDER BY sort_order ASC, id ASC').all();
  res.json({ links });
});

router.post('/links', (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin only' });
  const label = req.body.label?.trim();
  let url = req.body.url?.trim();
  if (!label || !url) return res.status(400).json({ error: 'label and url are required' });
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM team_links').get().m;
  const r = db.prepare('INSERT INTO team_links (label, url, sort_order) VALUES (?, ?, ?)').run(label, url, maxOrder + 1);
  const link = db.prepare('SELECT * FROM team_links WHERE id = ?').get(r.lastInsertRowid);
  res.status(201).json({ link });
});

router.delete('/links/:id', (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin only' });
  const link = db.prepare('SELECT id FROM team_links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM team_links WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
