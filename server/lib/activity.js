import db from '../db.js';

export function actorLabel(user) {
  if (user?.name) return user.name;
  if (user?.id) {
    return db.prepare('SELECT name FROM users WHERE id = ?').get(user.id)?.name || 'User';
  }
  return 'User';
}

export function logActivity({ transactionId, userId, eventType, summary, detail = null, taskId = null }) {
  db.prepare(`
    INSERT INTO transaction_activity (transaction_id, user_id, event_type, summary, detail, task_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(transactionId, userId, eventType, summary, detail, taskId);
}

export function formatFieldChange(label, from, to) {
  const fmt = (v) => (v == null || v === '' ? '—' : String(v));
  return `${label} changed from "${fmt(from)}" to "${fmt(to)}"`;
}
