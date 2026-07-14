import { Router } from 'express';
import db from '../db.js';
import { isOverdue, computeDueDate, resolveAnchorDate } from '../lib/timing.js';
import { recalculateTemplateTaskDueDate } from '../lib/recalculateTasks.js';
import { resolveAssigneeId, resolveTaskRole } from '../lib/taskAssignment.js';
import { logActivity, formatFieldChange, actorLabel } from '../lib/activity.js';
import { parsePagination, wantsPagination, buildCountSql } from '../lib/pagination.js';
import { parseAgentScope, transactionAgentScopeClause, taskTransactionScopeClause } from '../lib/agentScope.js';

const router = Router();

const TASK_SELECT = `
  SELECT t.*, u.name as user_name, tx.address as transaction_address,
    COALESCE(t.timing_value, tt.timing_value) as timing_value,
    COALESCE(t.timing_direction, tt.timing_direction) as timing_direction,
    COALESCE(t.timing_anchor, tt.timing_anchor) as timing_anchor,
    t.timing_anchor as task_timing_anchor,
    tt.calendar_nickname, tt.template_id, ct.name AS template_name
  FROM tasks t
  LEFT JOIN users u ON u.id = t.assigned_to
  LEFT JOIN transactions tx ON tx.id = t.transaction_id
  LEFT JOIN template_tasks tt ON tt.id = t.template_task_id
  LEFT JOIN checklist_templates ct ON ct.id = tt.template_id
`;

function parseTaskTiming(body) {
  const anchor = body.timing_anchor?.trim() || null;
  if (!anchor) {
    return { timing_value: null, timing_direction: null, timing_anchor: null };
  }
  return {
    timing_value: body.timing_value != null ? Number(body.timing_value) : 0,
    timing_direction: body.timing_direction === 'B' ? 'B' : 'A',
    timing_anchor: anchor,
  };
}

function resolveTaskDueDate(transaction, { due_date, timing_value, timing_direction, timing_anchor }) {
  if (timing_anchor && transaction) {
    const anchorDate = resolveAnchorDate(transaction, timing_anchor);
    return computeDueDate(anchorDate, timing_value ?? 0, timing_direction || 'A');
  }
  return due_date || null;
}

function enrich(task) {
  const role = resolveTaskRole(task.title);
  const suggested = resolveAssigneeId(db, task.title, role);
  return {
    ...task,
    is_overdue: isOverdue(task.due_date, task.status),
    suggested_assignee: suggested,
    requires_document: Boolean(task.requires_document),
    user_initials: task.user_name
      ? task.user_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
      : null,
  };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function weekEndStr() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function computeStats(tasks) {
  const today = todayStr();
  const weekEnd = weekEndStr();

  const open = tasks.filter((t) => t.status !== 'complete');
  const completedToday = tasks.filter(
    (t) => t.status === 'complete' && t.completed_at?.slice(0, 10) === today
  ).length;

  return {
    completedToday,
    highPriority: open.filter((t) => t.is_overdue).length,
    totalActive: open.length,
    todayCount: open.filter((t) => t.due_date === today).length,
    overdueCount: open.filter((t) => t.is_overdue).length,
    weekCount: open.filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd).length,
  };
}

function resolveAssignedTo(req) {
  const raw = req.query.assigned_to;
  if (raw === 'me') return req.user?.id ?? null;
  if (raw === undefined || raw === '') return null;
  return Number(raw) || raw;
}

const TASK_PRIORITIES = new Set(['normal', 'high']);

function parseTaskPriority(value, fallback = 'normal') {
  return TASK_PRIORITIES.has(value) ? value : fallback;
}

function taskCategory(task) {
  return task.category ?? (task.transaction_id ? 'transaction' : 'admin');
}

router.get('/team-priority', (req, res) => {
  const filter = req.query.filter || 'all';
  const today = todayStr();
  const weekEnd = weekEndStr();

  let sql = `
    ${TASK_SELECT}
    WHERE t.status != 'complete'
      AND t.due_date IS NOT NULL
  `;
  const params = [];

  if (filter === 'week') {
    sql += ' AND (t.due_date < ? OR (t.due_date >= ? AND t.due_date <= ?))';
    params.push(today, today, weekEnd);
  } else {
    sql += ' AND t.due_date < ?';
    params.push(today);
  }

  sql += ' ORDER BY CASE WHEN t.due_date < ? THEN 0 ELSE 1 END, t.due_date ASC, t.id ASC LIMIT 10';
  params.push(today);
  const tasks = db.prepare(sql).all(...params).map(enrich);
  res.json({ tasks });
});

router.get('/team-overview', (req, res) => {
  const today = todayStr();
  const weekEnd = weekEndStr();
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const agentScope = parseAgentScope(req.query);
  const { sql: scopeSql, params: scopeParams } = transactionAgentScopeClause(agentScope, 'tx');

  const sql = `
    ${TASK_SELECT}
    WHERE t.status != 'complete'
      AND t.due_date IS NOT NULL
      AND COALESCE(t.category, CASE WHEN t.transaction_id IS NOT NULL THEN 'transaction' ELSE 'admin' END) = 'transaction'
      AND (u.email IS NULL OR u.email != 'admin@theheydaygroup.com')
      AND t.transaction_id IS NOT NULL${scopeSql}
    ORDER BY
      CASE
        WHEN t.due_date < ? THEN 0
        WHEN t.due_date = ? THEN 1
        WHEN t.due_date <= ? THEN 2
        ELSE 3
      END,
      t.due_date ASC,
      t.id ASC
    LIMIT ?
  `;

  const tasks = db.prepare(sql).all(...scopeParams, today, today, weekEnd, limit).map(enrich);
  res.json({ tasks });
});

router.get('/team-admin-overview', (_req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(_req.query.limit, 10) || 20));

  const sql = `
    ${TASK_SELECT}
    WHERE t.status != 'complete'
      AND COALESCE(t.category, CASE WHEN t.transaction_id IS NOT NULL THEN 'transaction' ELSE 'admin' END) = 'admin'
      AND (u.email IS NULL OR u.email != 'admin@theheydaygroup.com')
    ORDER BY
      CASE WHEN t.priority = 'high' THEN 0 ELSE 1 END,
      (t.due_date IS NULL),
      t.due_date ASC,
      t.id ASC
    LIMIT ?
  `;

  const tasks = db.prepare(sql).all(limit).map(enrich);
  res.json({ tasks });
});

router.get('/milestones', (req, res) => {
  const today = todayStr();
  const end = new Date();
  end.setDate(end.getDate() + 30);
  const endStr = end.toISOString().slice(0, 10);
  const agentScope = parseAgentScope(req.query);
  const { sql: scopeSql, params: scopeParams } = transactionAgentScopeClause(agentScope, '');

  const rows = db.prepare(`
    SELECT id, address, city, stage, close_date
    FROM transactions
    WHERE close_date IS NOT NULL
      AND close_date >= ?
      AND close_date <= ?${scopeSql}
    ORDER BY close_date ASC
  `).all(today, endStr, ...scopeParams);

  const milestones = rows.map((tx) => ({
    transaction_id: tx.id,
    date: tx.close_date,
    title: tx.address?.trim() || '—',
    sub: tx.stage ? `${tx.stage} · ${tx.city || '—'}` : (tx.city || '—'),
    type: 'close',
  }));

  res.json({ milestones });
});

router.get('/expirations', (req, res) => {
  const today = todayStr();
  const end = new Date();
  end.setDate(end.getDate() + 30);
  const endStr = end.toISOString().slice(0, 10);
  const agentScope = parseAgentScope(req.query);
  const { sql: scopeSql, params: scopeParams } = transactionAgentScopeClause(agentScope, '');

  const rows = db.prepare(`
    SELECT id, address, city, stage, important_date
    FROM transactions
    WHERE important_date IS NOT NULL
      AND important_date >= ?
      AND important_date <= ?
      AND stage != 'closed'${scopeSql}
    ORDER BY important_date ASC
  `).all(today, endStr, ...scopeParams);

  const milestones = rows.map((tx) => ({
    transaction_id: tx.id,
    date: tx.important_date,
    title: tx.address?.trim() || '—',
    sub: tx.stage ? `${tx.stage} · ${tx.city || '—'}` : (tx.city || '—'),
    type: 'expiration',
  }));

  res.json({ milestones });
});

router.get('/', (req, res) => {
  const transactionId = req.query.transaction_id;
  const assignedTo = resolveAssignedTo(req);
  const filter = req.query.filter || 'all';
  const showCompleted = req.query.include_completed !== 'false';
  const agentScope = parseAgentScope(req.query);
  const { sql: taskScopeSql, params: taskScopeParams } = taskTransactionScopeClause(agentScope, 't', 'tx');

  let baseSql = `${TASK_SELECT} WHERE 1=1`;
  const baseParams = [];

  if (taskScopeSql) {
    baseSql += taskScopeSql;
    baseParams.push(...taskScopeParams);
  }

  if (transactionId) {
    baseSql += ' AND t.transaction_id = ?';
    baseParams.push(transactionId);
  }
  if (assignedTo) {
    baseSql += ' AND t.assigned_to = ?';
    baseParams.push(assignedTo);
  }
  if (req.query.transaction_only === 'true') {
    baseSql += ' AND t.transaction_id IS NOT NULL';
  }
  if (req.query.category === 'transaction' || req.query.category === 'admin') {
    baseSql += " AND COALESCE(t.category, CASE WHEN t.transaction_id IS NOT NULL THEN 'transaction' ELSE 'admin' END) = ?";
    baseParams.push(req.query.category);
  }
  if (req.query.due_after) {
    baseSql += ' AND t.due_date >= ?';
    baseParams.push(req.query.due_after);
  }
  if (req.query.due_before) {
    baseSql += ' AND t.due_date <= ?';
    baseParams.push(req.query.due_before);
  }
  if (req.query.require_due_date === 'true') {
    baseSql += ' AND t.due_date IS NOT NULL';
  }

  const allForStats = db.prepare(baseSql).all(...baseParams).map(enrich);
  const stats = computeStats(allForStats);

  let sql = baseSql;
  const params = [...baseParams];

  const today = todayStr();
  const weekEnd = weekEndStr();

  if (filter === 'completed_today') {
    sql += " AND t.status = 'complete' AND date(t.completed_at) = ?";
    params.push(today);
  } else {
    const hideCompleted = !showCompleted && (
      filter === 'active'
      || filter === 'today'
      || filter === 'week'
      || filter === 'overdue'
      || filter === 'all'
    );

    if (hideCompleted) {
      sql += " AND t.status != 'complete'";
    }

    if (filter === 'today') {
      sql += ' AND t.due_date = ?';
      params.push(today);
    } else if (filter === 'week') {
      sql += ' AND t.due_date >= ? AND t.due_date <= ?';
      params.push(today, weekEnd);
    } else if (filter === 'overdue') {
      sql += ' AND t.due_date < ?';
      params.push(today);
    }
  }

  const countSql = buildCountSql(sql);
  let total = null;
  let page = null;
  let limit = null;
  let offset = 0;

  if (wantsPagination(req.query)) {
    ({ page, limit, offset } = parsePagination(req.query));
    total = db.prepare(countSql).get(...params).c;
  }

  sql += ` ORDER BY CASE WHEN t.status = 'complete' THEN 1 ELSE 0 END, (t.due_date IS NULL), t.due_date ASC, t.id ASC`;
  if (wantsPagination(req.query)) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }
  const tasks = db.prepare(sql).all(...params).map(enrich);

  res.json({
    tasks,
    stats,
    ...(total != null ? { total, page, limit } : {}),
  });
});

router.post('/', (req, res) => {
  const {
    title,
    description,
    due_date,
    assigned_to,
    transaction_id,
    category,
    priority,
    timing_value,
    timing_direction,
    timing_anchor,
  } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  const txId = transaction_id ? Number(transaction_id) : null;
  let transaction = null;
  if (txId) {
    transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId);
    if (!transaction) return res.status(400).json({ error: 'Invalid transaction_id' });
  }

  const assignee = assigned_to ? Number(assigned_to) : null;
  if (assignee) {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(assignee);
    if (!user) return res.status(400).json({ error: 'Invalid assigned_to' });
  }

  const timing = parseTaskTiming({ timing_value, timing_direction, timing_anchor });
  const resolvedDueDate = resolveTaskDueDate(transaction, {
    due_date,
    ...timing,
  });

  const resolvedCategory = txId
    ? 'transaction'
    : (category === 'transaction' ? 'transaction' : 'admin');

  const resolvedPriority = resolvedCategory === 'admin'
    ? parseTaskPriority(priority, 'normal')
    : 'normal';

  const r = db.prepare(`
    INSERT INTO tasks (
      title, description, due_date, assigned_to, transaction_id, category,
      timing_value, timing_direction, timing_anchor,
      priority, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    String(title).trim(),
    description?.trim() || null,
    resolvedDueDate,
    assignee,
    txId,
    resolvedCategory,
    timing.timing_value,
    timing.timing_direction,
    timing.timing_anchor,
    resolvedPriority,
  );

  const actor = actorLabel(req.user);
  if (txId) {
    logActivity({
      transactionId: txId,
      userId: req.user.id,
      eventType: 'task_created',
      summary: `${actor} added task "${String(title).trim()}"`,
      taskId: r.lastInsertRowid,
    });
  }

  const task = db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(r.lastInsertRowid);
  res.status(201).json({ task: enrich(task) });
});

router.patch('/bulk/assign', (req, res) => {
  const { assignments } = req.body;
  if (!Array.isArray(assignments)) return res.status(400).json({ error: 'assignments array required' });

  const update = db.prepare('UPDATE tasks SET assigned_to = ? WHERE id = ?');
  db.transaction(() => {
    assignments.forEach(({ task_id, assigned_to }) => {
      update.run(assigned_to || null, task_id);
    });
  })();

  res.json({ ok: true });
});

router.patch('/bulk/complete-overdue', (req, res) => {
  const transactionId = Number(req.body.transaction_id);
  if (!transactionId) return res.status(400).json({ error: 'transaction_id is required' });

  const today = todayStr();
  const overdue = db.prepare(`
    SELECT id, title FROM tasks
    WHERE transaction_id = ?
      AND status != 'complete'
      AND due_date IS NOT NULL
      AND due_date < ?
  `).all(transactionId, today);

  if (!overdue.length) {
    return res.json({ completed: 0, tasks: [] });
  }

  const completedAt = new Date().toISOString();
  const update = db.prepare("UPDATE tasks SET status = 'complete', completed_at = ? WHERE id = ?");

  db.transaction(() => {
    for (const task of overdue) {
      update.run(completedAt, task.id);
    }
  })();

  const actor = actorLabel(req.user);
  logActivity({
    transactionId,
    userId: req.user.id,
    eventType: 'task_updated',
    summary: `${actor} marked ${overdue.length} overdue task${overdue.length === 1 ? '' : 's'} complete`,
    detail: overdue.map((t) => t.title).join('\n'),
  });

  const tasks = db.prepare(`${TASK_SELECT} WHERE t.transaction_id = ? ORDER BY (t.due_date IS NULL), t.due_date ASC, t.id ASC`)
    .all(transactionId)
    .map(enrich);

  res.json({ completed: overdue.length, tasks });
});

router.patch('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });

  const {
    status,
    assigned_to,
    title,
    description,
    due_date,
    timing_value,
    timing_direction,
    timing_anchor,
    priority,
    marketing_post_type,
  } = req.body;
  const changes = [];

  const transaction = task.transaction_id
    ? db.prepare('SELECT * FROM transactions WHERE id = ?').get(task.transaction_id)
    : null;

  if (title !== undefined && title !== task.title) {
    changes.push(formatFieldChange('Task name', task.title, title));
    db.prepare('UPDATE tasks SET title = ? WHERE id = ?').run(title.trim(), req.params.id);
  }
  if (description !== undefined && description !== task.description) {
    db.prepare('UPDATE tasks SET description = ? WHERE id = ?').run(description || null, req.params.id);
  }

  if (marketing_post_type !== undefined) {
    const nextType = marketing_post_type != null && String(marketing_post_type).trim()
      ? String(marketing_post_type).trim()
      : null;
    const prevType = task.marketing_post_type || null;
    if (nextType !== prevType) {
      changes.push(formatFieldChange('Post type', prevType || 'None', nextType || 'None'));
      db.prepare('UPDATE tasks SET marketing_post_type = ? WHERE id = ?').run(nextType, req.params.id);
    }
  }

  const timingTouched = timing_anchor !== undefined
    || timing_value !== undefined
    || timing_direction !== undefined;

  if (due_date !== undefined || timingTouched) {
    const timing = timingTouched
      ? parseTaskTiming({
        timing_value: timing_value ?? task.timing_value,
        timing_direction: timing_direction ?? task.timing_direction,
        timing_anchor: timing_anchor !== undefined ? timing_anchor : task.timing_anchor,
      })
      : {
        timing_value: task.timing_value,
        timing_direction: task.timing_direction,
        timing_anchor: task.timing_anchor,
      };

    if (task.template_task_id) {
      if (req.body.due_date_override === true && due_date !== undefined) {
        const override = Boolean(due_date);
        if (due_date !== task.due_date || override !== Boolean(task.due_date_override)) {
          changes.push(formatFieldChange('Deadline', task.due_date, due_date || null));
        }
        db.prepare(`
          UPDATE tasks
          SET due_date = ?, due_date_override = 1,
              timing_value = NULL, timing_direction = NULL, timing_anchor = NULL
          WHERE id = ?
        `).run(due_date || null, req.params.id);
      } else if (timingTouched) {
        const timing = parseTaskTiming({
          timing_value: timing_value ?? task.timing_value,
          timing_direction: timing_direction ?? task.timing_direction,
          timing_anchor: timing_anchor !== undefined ? timing_anchor : task.timing_anchor,
        });
        const resolvedDueDate = resolveTaskDueDate(transaction, timing);
        if (resolvedDueDate !== task.due_date) {
          changes.push(formatFieldChange('Deadline', task.due_date, resolvedDueDate));
        }
        db.prepare(`
          UPDATE tasks
          SET due_date = ?, timing_value = ?, timing_direction = ?, timing_anchor = ?, due_date_override = 0
          WHERE id = ?
        `).run(
          resolvedDueDate,
          timing.timing_value,
          timing.timing_direction,
          timing.timing_anchor,
          req.params.id,
        );
      } else if (req.body.due_date_override === false) {
        db.prepare(`
          UPDATE tasks
          SET timing_value = NULL, timing_direction = NULL, timing_anchor = NULL, due_date_override = 0
          WHERE id = ?
        `).run(req.params.id);
        const resolvedDueDate = recalculateTemplateTaskDueDate(db, task.id, transaction);
        db.prepare('UPDATE tasks SET due_date = ? WHERE id = ?').run(resolvedDueDate, req.params.id);
        if (resolvedDueDate !== task.due_date) {
          changes.push(formatFieldChange('Deadline', task.due_date, resolvedDueDate));
        }
      } else if (due_date !== undefined) {
        // Bare due_date on a template task = fixed override (e.g. task dashboard edit)
        if (due_date !== task.due_date || !task.due_date_override) {
          changes.push(formatFieldChange('Deadline', task.due_date, due_date || null));
        }
        db.prepare(`
          UPDATE tasks
          SET due_date = ?, due_date_override = 1,
              timing_value = NULL, timing_direction = NULL, timing_anchor = NULL
          WHERE id = ?
        `).run(due_date || null, req.params.id);
      }
    } else {
      const resolvedDueDate = resolveTaskDueDate(transaction, {
        due_date: due_date !== undefined ? due_date : task.due_date,
        ...timing,
      });
      if (resolvedDueDate !== task.due_date) {
        changes.push(formatFieldChange('Deadline', task.due_date, resolvedDueDate));
      }
      db.prepare(`
        UPDATE tasks
        SET due_date = ?, timing_value = ?, timing_direction = ?, timing_anchor = ?
        WHERE id = ?
      `).run(
        resolvedDueDate,
        timing.timing_value,
        timing.timing_direction,
        timing.timing_anchor,
        req.params.id,
      );
    }
  }
  if (assigned_to !== undefined) {
    const beforeName = task.assigned_to
      ? db.prepare('SELECT name FROM users WHERE id = ?').get(task.assigned_to)?.name
      : 'Unassigned';
    const afterName = assigned_to
      ? db.prepare('SELECT name FROM users WHERE id = ?').get(assigned_to)?.name
      : 'Unassigned';
    if (String(task.assigned_to) !== String(assigned_to || '')) {
      changes.push(formatFieldChange('Assigned to', beforeName, afterName));
    }
    db.prepare('UPDATE tasks SET assigned_to = ? WHERE id = ?').run(assigned_to || null, req.params.id);
  }
  if (priority !== undefined && taskCategory(task) === 'admin') {
    const nextPriority = parseTaskPriority(priority, task.priority || 'normal');
    if (nextPriority !== task.priority) {
      changes.push(formatFieldChange('Priority', task.priority || 'normal', nextPriority));
      db.prepare('UPDATE tasks SET priority = ? WHERE id = ?').run(nextPriority, req.params.id);
    }
  }
  const actor = actorLabel(req.user);

  if (status && status !== task.status) {
    const completedAt = status === 'complete' ? new Date().toISOString() : null;
    db.prepare('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?')
      .run(status, completedAt, req.params.id);

    if (status === 'complete') {
      logActivity({
        transactionId: task.transaction_id,
        userId: req.user.id,
        eventType: 'task_complete',
        summary: `${actor} marked "${task.title}" complete`,
        taskId: task.id,
      });
    }
  } else if (changes.length > 0) {
    logActivity({
      transactionId: task.transaction_id,
      userId: req.user.id,
      eventType: 'task_updated',
      summary: `${actor} updated "${title || task.title}"`,
      detail: changes.join('\n'),
      taskId: task.id,
    });
  }

  const updated = db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(req.params.id);
  res.json({ task: enrich(updated) });
});

router.delete('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });

  // Detach activity references before deleting (FK: transaction_activity.task_id → tasks.id).
  db.transaction(() => {
    db.prepare('UPDATE transaction_activity SET task_id = NULL WHERE task_id = ?').run(task.id);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
  })();

  logActivity({
    transactionId: task.transaction_id,
    userId: req.user.id,
    eventType: 'task_deleted',
    summary: `${actorLabel(req.user)} deleted "${task.title}"`,
  });

  res.json({ ok: true });
});

export default router;
