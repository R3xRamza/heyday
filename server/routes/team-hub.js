import { Router } from 'express';
import db from '../db.js';
import { isOverdue, isDueThisWeek } from '../lib/timing.js';
import { celebrationsInRange, toDateStr } from '../lib/marketingCalendar.js';
import { ON_MARKET_LISTINGS_SCOPE, PRE_LISTINGS_SCOPE, closedYtdStats, hubTransactionRows } from '../lib/transactionScopes.js';
import { closePastDueTransactions } from '../lib/transactionAutoClose.js';
import { parseAgentScope, transactionAgentScopeClause } from '../lib/agentScope.js';

const router = Router();

const TEAM_ORDER_SQL = `
  CASE email
    WHEN 'tessa@theheydaygroup.com' THEN 0
    WHEN 'adam@theheydaygroup.com' THEN 1
    WHEN 'margaret@theheydaygroup.com' THEN 2
    WHEN 'meredith@theheydaygroup.com' THEN 3
    ELSE 99
  END, name
`;

router.get('/stats', (req, res) => {
  closePastDueTransactions(db);
  const agentScope = parseAgentScope(req.query);
  const { sql: scopeSql, params: scopeParams } = transactionAgentScopeClause(agentScope, '');
  const closedYtd = closedYtdStats(db, agentScope);

  const pending = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as volume
    FROM transactions WHERE stage = 'pending' AND close_date IS NOT NULL${scopeSql}
  `).get(...scopeParams);

  const activeListings = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as volume
    FROM transactions WHERE ${ON_MARKET_LISTINGS_SCOPE}${scopeSql}
  `).get(...scopeParams);

  const comingSoonStats = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as volume
    FROM transactions WHERE ${PRE_LISTINGS_SCOPE}${scopeSql}
  `).get(...scopeParams);

  const { comingSoon, listings, pendingDeals } = hubTransactionRows(db, agentScope);

  res.json({
    closedYtd,
    pending,
    activeListings,
    comingSoonStats,
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

router.get('/team-tasks', (req, res) => {
  const agentScope = parseAgentScope(req.query);
  const { sql: scopeSql, params: scopeParams } = transactionAgentScopeClause(agentScope, 'tx');
  const scopeFilter = scopeSql
    ? ` AND (
        COALESCE(t.category, CASE WHEN t.transaction_id IS NOT NULL THEN 'transaction' ELSE 'admin' END) != 'transaction'
        OR t.transaction_id IS NULL
        ${scopeSql}
      )`
    : '';

  const members = db.prepare(`
    SELECT id, name, email, role FROM users
    WHERE email != 'admin@theheydaygroup.com'
    ORDER BY ${TEAM_ORDER_SQL}
  `).all();

  const openTasksStmt = db.prepare(`
    SELECT t.id, t.title, t.due_date, t.status, t.transaction_id,
      COALESCE(t.category, CASE WHEN t.transaction_id IS NOT NULL THEN 'transaction' ELSE 'admin' END) AS category,
      tt.calendar_nickname
    FROM tasks t
    LEFT JOIN template_tasks tt ON tt.id = t.template_task_id
    LEFT JOIN transactions tx ON tx.id = t.transaction_id
    WHERE t.assigned_to = ? AND t.status != 'complete'${scopeFilter}
    ORDER BY (t.due_date IS NULL), t.due_date ASC, t.id ASC
  `);

  function countsForCategory(open, category, today) {
    const tasks = open.filter((t) => t.category === category);
    return {
      activeCount: tasks.filter((t) => isDueThisWeek(t.due_date, t.status, today)).length,
      overdueCount: tasks.filter((t) => isOverdue(t.due_date, t.status)).length,
    };
  }

  const summary = members.map((m) => {
    const open = openTasksStmt.all(m.id, ...scopeParams);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const transaction = countsForCategory(open, 'transaction', today);
    const admin = countsForCategory(open, 'admin', today);

    return {
      ...m,
      activeCount: transaction.activeCount + admin.activeCount,
      overdueCount: transaction.overdueCount + admin.overdueCount,
      transaction,
      admin,
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
  db.prepare('DELETE FROM team_messages WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/links', (_req, res) => {
  const links = db.prepare('SELECT * FROM team_links ORDER BY sort_order ASC, id ASC').all();
  res.json({ links });
});

router.post('/links', (req, res) => {
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
  const link = db.prepare('SELECT id FROM team_links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM team_links WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
