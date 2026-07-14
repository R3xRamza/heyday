import { Router } from 'express';
import db from '../db.js';
import { celebrationsInRange, toDateStr } from '../lib/marketingCalendar.js';
import { ON_MARKET_LISTINGS_SCOPE, PRE_LISTINGS_SCOPE, closedYtdStats, hubTransactionRows } from '../lib/transactionScopes.js';
import { closePastDueTransactions } from '../lib/transactionAutoClose.js';
import { parseAgentScope, transactionAgentScopeClause } from '../lib/agentScope.js';
import { memberTaskSummary } from '../lib/memberTaskStats.js';

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

  const members = db.prepare(`
    SELECT id, name, email, role FROM users
    WHERE email != 'admin@theheydaygroup.com'
    ORDER BY ${TEAM_ORDER_SQL}
  `).all();

  const summary = members.map((m) => {
    const { stats, transaction, admin } = memberTaskSummary(db, m.id, agentScope);
    return {
      ...m,
      thisWeekCount: stats.thisWeek,
      overdueCount: stats.overdue,
      transaction: {
        thisWeekCount: transaction.thisWeek,
        overdueCount: transaction.overdue,
      },
      admin: {
        thisWeekCount: admin.thisWeek,
        overdueCount: admin.overdue,
      },
    };
  });

  res.json({ members: summary });
});

router.get('/messages', (_req, res) => {
  const messages = db.prepare(`
    SELECT m.*, u.name as user_name, u.email as user_email
    FROM team_messages m
    LEFT JOIN users u ON u.id = m.user_id
    ORDER BY m.pinned DESC, m.sort_order ASC, m.id ASC
    LIMIT 50
  `).all();
  res.json({ messages });
});

function getMessageOr404(id) {
  return db.prepare(`
    SELECT m.*, u.name as user_name, u.email as user_email
    FROM team_messages m LEFT JOIN users u ON u.id = m.user_id
    WHERE m.id = ?
  `).get(id);
}

function asFlag(value, fallback = 0) {
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  return fallback ? 1 : 0;
}

router.post('/messages', (req, res) => {
  const body = req.body.body?.trim();
  if (!body) return res.status(400).json({ error: 'body is required' });

  const minOrder = db.prepare('SELECT COALESCE(MIN(sort_order), 0) as m FROM team_messages').get().m;
  const r = db.prepare(`
    INSERT INTO team_messages (user_id, body, sort_order)
    VALUES (?, ?, ?)
  `).run(req.user.id, body, minOrder - 1);
  res.status(201).json({ message: getMessageOr404(r.lastInsertRowid) });
});

router.put('/messages/reorder', (req, res) => {
  const orderedIds = Array.isArray(req.body.ordered_ids)
    ? req.body.ordered_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : null;
  if (!orderedIds || orderedIds.length === 0) {
    return res.status(400).json({ error: 'ordered_ids array is required' });
  }

  const unique = [...new Set(orderedIds)];
  if (unique.length !== orderedIds.length) {
    return res.status(400).json({ error: 'ordered_ids must be unique' });
  }

  const find = db.prepare('SELECT id FROM team_messages WHERE id = ?');
  if (orderedIds.some((id) => !find.get(id))) {
    return res.status(400).json({ error: 'ordered_ids contains unknown message id' });
  }

  const update = db.prepare('UPDATE team_messages SET sort_order = ? WHERE id = ?');
  const placeholders = orderedIds.map(() => '?').join(',');
  const reorder = db.transaction((ids) => {
    ids.forEach((id, index) => update.run(index, id));
    const others = db.prepare(`
      SELECT id FROM team_messages
      WHERE id NOT IN (${placeholders})
      ORDER BY pinned DESC, sort_order ASC, id ASC
    `).all(...ids);
    others.forEach((row, index) => update.run(ids.length + index, row.id));
  });
  reorder(orderedIds);

  const messages = db.prepare(`
    SELECT m.*, u.name as user_name, u.email as user_email
    FROM team_messages m
    LEFT JOIN users u ON u.id = m.user_id
    ORDER BY m.pinned DESC, m.sort_order ASC, m.id ASC
    LIMIT 50
  `).all();
  res.json({ messages });
});

router.patch('/messages/:id', (req, res) => {
  const message = getMessageOr404(req.params.id);
  if (!message) return res.status(404).json({ error: 'Not found' });

  const body = req.body.body != null ? String(req.body.body).trim() : message.body;
  if (!body) return res.status(400).json({ error: 'body is required' });

  const pinned = req.body.pinned !== undefined
    ? asFlag(req.body.pinned)
    : asFlag(message.pinned);

  let pinnedAt = message.pinned_at;
  let sortOrder = message.sort_order ?? 0;
  if (req.body.pinned !== undefined) {
    if (pinned && !asFlag(message.pinned)) {
      pinnedAt = new Date().toISOString();
      const minOrder = db.prepare('SELECT COALESCE(MIN(sort_order), 0) as m FROM team_messages').get().m;
      sortOrder = minOrder - 1;
    } else if (!pinned) {
      pinnedAt = null;
    }
  }

  db.prepare(`
    UPDATE team_messages
    SET body = ?, pinned = ?, pinned_at = ?, sort_order = ?
    WHERE id = ?
  `).run(body, pinned, pinnedAt, sortOrder, message.id);

  res.json({ message: getMessageOr404(message.id) });
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

router.put('/links/reorder', (req, res) => {
  const orderedIds = Array.isArray(req.body.ordered_ids)
    ? req.body.ordered_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : null;
  if (!orderedIds || orderedIds.length === 0) {
    return res.status(400).json({ error: 'ordered_ids array is required' });
  }

  const existingIds = new Set(
    db.prepare('SELECT id FROM team_links').all().map((row) => row.id),
  );
  if (orderedIds.length !== existingIds.size || orderedIds.some((id) => !existingIds.has(id))) {
    return res.status(400).json({ error: 'ordered_ids must include every link id exactly once' });
  }

  const update = db.prepare('UPDATE team_links SET sort_order = ? WHERE id = ?');
  const reorder = db.transaction((ids) => {
    ids.forEach((id, index) => update.run(index, id));
  });
  reorder(orderedIds);

  const links = db.prepare('SELECT * FROM team_links ORDER BY sort_order ASC, id ASC').all();
  res.json({ links });
});

router.patch('/links/:id', (req, res) => {
  const link = db.prepare('SELECT * FROM team_links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });

  const label = req.body.label != null ? String(req.body.label).trim() : link.label;
  let url = req.body.url != null ? String(req.body.url).trim() : link.url;
  if (!label || !url) return res.status(400).json({ error: 'label and url are required' });
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  db.prepare('UPDATE team_links SET label = ?, url = ? WHERE id = ?').run(label, url, link.id);
  const updated = db.prepare('SELECT * FROM team_links WHERE id = ?').get(link.id);
  res.json({ link: updated });
});

router.delete('/links/:id', (req, res) => {
  const link = db.prepare('SELECT id FROM team_links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM team_links WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
