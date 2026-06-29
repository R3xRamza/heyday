export const TEAM_ROLES = ['operations', 'marketing', 'analyst', 'owner_lead'];

export function resolveTaskRole(title) {
  const t = title;
  const upper = title.toUpperCase();

  if (/Meredith/i.test(t) || /^Agent to /i.test(t) || /Agent final review/i.test(t)) {
    return 'owner_lead';
  }

  if (
    upper.includes('MARKETING')
    || upper.includes('SOCIAL POST')
    || /^POST /i.test(t)
    || /Re-post|Re-post/i.test(t)
    || /carousel/i.test(t)
    || /walk through|walkthrough tour|video tour/i.test(t)
    || /Heyday website|property website|property carousel/i.test(t)
    || /FB\/IG|FB groups|Instagram|Clubhouse|Workplace|Zenlist|ALN/i.test(t)
    || /Just Listed|Coming Soon on FB|sold social post|under contract social/i.test(t)
    || /Bifold|Open House planning|current listing carousel|listings reel/i.test(t)
    || /90 Day Plan|90 days on market|guess the price|detail shots|Neighborhood highlight/i.test(t)
    || /Remove "JUST LISTED"|syndicated sites|FLEX in MLS/i.test(t)
  ) {
    return 'marketing';
  }

  if (
    /Track Appraisal|Track Financing/i.test(t)
    || /\bCDA\b/i.test(t)
    || /commission received|Settlement Statement|Confirm Funding/i.test(t)
    || /Wire info|wire instructions/i.test(t)
    || /compliance in Skyslope/i.test(t)
    || /\bInvoice\b|\bW9\b/i.test(t)
    || /credit\/background check|Verify rental history|Summarize qualified applications/i.test(t)
    || /Confirm appraisal made value|Determine Appraisal due date/i.test(t)
    || /Homestead reminder/i.test(t)
  ) {
    return 'analyst';
  }

  return 'operations';
}

export function resolveTaskPriority(title, role) {
  if (/Track |Review inspection|Remind Meredith|Overdue/i.test(title)) return 'high';
  if (role === 'marketing' && /Social Post|MARKETING:/i.test(title)) return 'high';
  if (role === 'owner_lead') return 'high';
  return 'normal';
}

export function getUsersByRole(db) {
  const map = {};
  db.prepare("SELECT id, role FROM users WHERE email != 'admin@theheydaygroup.com'").all().forEach((u) => {
    map[u.role] = u.id;
  });
  return map;
}

export function resolveAssigneeId(db, title, defaultRole) {
  const role = defaultRole || resolveTaskRole(title);
  const usersByRole = getUsersByRole(db);
  return usersByRole[role] ?? null;
}

/** Push template default_role to all transaction tasks spawned from this template row. */
export function syncLinkedTaskAssignees(db, templateTaskId, defaultRole, title) {
  const assignedTo = resolveAssigneeId(db, title, defaultRole);
  db.prepare('UPDATE tasks SET assigned_to = ? WHERE template_task_id = ?').run(assignedTo, templateTaskId);
}

export function syncAllTaskAssigneesFromTemplates(db) {
  const rows = db.prepare('SELECT id, title, default_role FROM template_tasks').all();
  db.transaction(() => {
    for (const row of rows) {
      syncLinkedTaskAssignees(db, row.id, row.default_role, row.title);
    }
  })();
}

export function reassignAllTasksByRole(db) {
  const usersByRole = getUsersByRole(db);
  if (Object.keys(usersByRole).length === 0) return;

  const tasks = db.prepare(`
    SELECT t.id, t.title, tt.default_role
    FROM tasks t
    LEFT JOIN template_tasks tt ON tt.id = t.template_task_id
  `).all();
  const update = db.prepare('UPDATE tasks SET assigned_to = ? WHERE id = ?');
  db.transaction(() => {
    for (const task of tasks) {
      const role = task.default_role || resolveTaskRole(task.title);
      const userId = usersByRole[role];
      if (userId) update.run(userId, task.id);
    }
  })();
}
