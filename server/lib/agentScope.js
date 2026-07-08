import db from '../db.js';

const SCOPE_EMAILS = {
  meredith: 'meredith@theheydaygroup.com',
  tessa: 'tessa@theheydaygroup.com',
};

const userIdByEmail = new Map();

function userIdForEmail(email) {
  if (userIdByEmail.has(email)) return userIdByEmail.get(email);
  const row = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  const id = row?.id ?? null;
  userIdByEmail.set(email, id);
  return id;
}

/** @returns {'meredith' | 'all' | 'tessa'} */
export function parseAgentScope(query = {}) {
  const raw = String(query.agent_scope ?? query.scope ?? 'M').trim().toLowerCase();
  if (raw === 'a' || raw === 'all') return 'all';
  if (raw === 't' || raw === 'tessa') return 'tessa';
  return 'meredith';
}

export function agentScopeUserId(scope) {
  if (scope === 'meredith') return userIdForEmail(SCOPE_EMAILS.meredith);
  if (scope === 'tessa') return userIdForEmail(SCOPE_EMAILS.tessa);
  return null;
}

/** SQL fragment for transactions table alias (NULL agent_id excluded in M/T). */
export function transactionAgentScopeClause(scope, tableAlias = 't') {
  const userId = agentScopeUserId(scope);
  if (!userId) return { sql: '', params: [] };
  const col = tableAlias ? `${tableAlias}.agent_id` : 'agent_id';
  return { sql: ` AND ${col} = ?`, params: [userId] };
}

export function transactionInScope(scope, transactionId) {
  if (scope === 'all') return true;
  const userId = agentScopeUserId(scope);
  if (!userId) return false;
  const tx = db.prepare('SELECT agent_id FROM transactions WHERE id = ?').get(transactionId);
  if (!tx) return false;
  return tx.agent_id === userId;
}

export function assertTransactionInScope(req, res, transactionId) {
  const scope = parseAgentScope(req.query);
  if (transactionInScope(scope, transactionId)) return true;
  res.status(404).json({ error: 'Not found' });
  return false;
}

/** Filter transaction-linked tasks; admin / standalone tasks pass through. */
export function taskTransactionScopeClause(scope, taskAlias = 't', txAlias = 'tx') {
  const userId = agentScopeUserId(scope);
  if (!userId) return { sql: '', params: [] };
  return {
    sql: ` AND (${taskAlias}.transaction_id IS NULL OR ${txAlias}.agent_id = ?)`,
    params: [userId],
  };
}
