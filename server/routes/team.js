import { Router } from 'express';
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
