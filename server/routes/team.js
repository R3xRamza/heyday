import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../db.js';
import { parseAgentScope } from '../lib/agentScope.js';
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

function listTeamMembers() {
  const members = db.prepare(`
    SELECT id, name, email, role FROM users
    WHERE email != 'admin@theheydaygroup.com'
    ORDER BY ${TEAM_ORDER_SQL}
  `).all();

  return members.length
    ? members
    : db.prepare('SELECT id, name, email, role FROM users ORDER BY name').all();
}

function memberWithStats(member, agentScope) {
  const { stats, transaction, admin } = memberTaskSummary(db, member.id, agentScope);
  return { ...member, stats, transaction, admin };
}

const MANAGE_ROLES = new Set(['admin', 'owner_lead']);
const MEMBER_ROLES = new Set(['operations', 'marketing', 'analyst', 'owner_lead', 'agent', 'admin']);

function canManageUsers(req, res) {
  if (MANAGE_ROLES.has(req.user?.role)) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

router.post('/members', (req, res) => {
  if (!canManageUsers(req, res)) return;
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const role = String(req.body.role || 'operations').trim();
  if (!name || !email || password.length < 8) {
    return res.status(400).json({ error: 'Name, email, and a password of at least 8 characters are required' });
  }
  if (!MEMBER_ROLES.has(role) || role === 'admin') {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const passwordHash = bcrypt.hashSync(password, 12);
  const result = db.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
  ).run(name, email, passwordHash, role);
  const member = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ member });
});

router.patch('/members/:id', (req, res) => {
  if (!canManageUsers(req, res)) return;
  const member = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Not found' });
  const role = String(req.body.role || '').trim();
  if (!MEMBER_ROLES.has(role) || role === 'admin') {
    return res.status(400).json({ error: 'Invalid role' });
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, member.id);
  const next = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(member.id);
  res.json({ member: next });
});

router.post('/reassign', (req, res) => {
  if (!canManageUsers(req, res)) return;
  const fromId = Number(req.body.from_user_id);
  const toId = Number(req.body.to_user_id);
  if (!fromId || !toId || fromId === toId) {
    return res.status(400).json({ error: 'Pick two different people' });
  }
  const fromUser = db.prepare('SELECT id FROM users WHERE id = ?').get(fromId);
  const toUser = db.prepare('SELECT id FROM users WHERE id = ?').get(toId);
  if (!fromUser || !toUser) return res.status(404).json({ error: 'User not found' });
  const result = db.prepare('UPDATE tasks SET assigned_to = ? WHERE assigned_to = ?').run(toId, fromId);
  res.json({ moved: result.changes });
});

router.get('/', (req, res) => {
  const agentScope = parseAgentScope(req.query);
  res.json({
    members: listTeamMembers().map((m) => memberWithStats(m, agentScope)),
  });
});

router.get('/:id', (req, res) => {
  const member = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Not found' });
  const agentScope = parseAgentScope(req.query);
  res.json({ member: memberWithStats(member, agentScope) });
});

export default router;
