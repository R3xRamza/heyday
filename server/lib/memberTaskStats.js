import { isOverdue, isDueThisWeek, weekRangeSunday } from './timing.js';
import { resolveAgentScope, agentScopeUserId } from './agentScope.js';

export function computeTaskStats(tasks, refDate = new Date()) {
  const today = new Date(refDate);
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

export function assignedTasksForMember(db, userId, agentScope) {
  const scope = resolveAgentScope(agentScope);
  const scopeUserId = agentScopeUserId(scope);
  const scopeFilter = scopeUserId
    ? ` AND (
        COALESCE(t.category, CASE WHEN t.transaction_id IS NOT NULL THEN 'transaction' ELSE 'admin' END) != 'transaction'
        OR t.transaction_id IS NULL
        OR tx.agent_id = ?
      )`
    : '';

  const params = scopeUserId ? [userId, scopeUserId] : [userId];

  return db.prepare(`
    SELECT t.status, t.due_date,
      COALESCE(t.category, CASE WHEN t.transaction_id IS NOT NULL THEN 'transaction' ELSE 'admin' END) AS category
    FROM tasks t
    LEFT JOIN transactions tx ON tx.id = t.transaction_id
    WHERE t.assigned_to = ?${scopeFilter}
  `).all(...params);
}

export function memberTaskSummary(db, userId, agentScope) {
  const tasks = assignedTasksForMember(db, userId, agentScope);
  const today = new Date();

  const stats = computeTaskStats(tasks, today);
  const transaction = computeTaskStats(tasks.filter((t) => t.category === 'transaction'), today);
  const admin = computeTaskStats(tasks.filter((t) => t.category === 'admin'), today);

  return { stats, transaction, admin };
}
