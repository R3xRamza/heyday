import bcrypt from 'bcrypt';
import { CHECKLIST_TEMPLATES, CHECKLIST_TEMPLATE_SORT_ORDER, defaultRoleForChecklistTemplate } from './lib/checklist-templates.js';
import { deriveNickname } from './lib/deriveNickname.js';
import { dedupeChecklistTasksForTemplate } from './lib/checklistTaskCleanup.js';

export { CHECKLIST_TEMPLATES };

export const SEED_TRANSACTIONS = [
  { address: '1245 Skyline Ridge Dr', city: 'Austin, TX 78746', mls: 'ACT1234567', value: 3450000, owner: 'Benjamin Sterling', representing: 'seller', stage: 'active', label: 'expires', important: '2026-08-31', status: 'active' },
  { address: '450 Park Ave', city: 'Austin, TX 78701', mls: 'ACT1122334', value: 2450000, owner: 'The Steiner Family', representing: 'seller', stage: 'active', label: 'closes', important: '2026-06-15', status: 'active' },
  { address: '98 Riverside Drive', city: 'Austin, TX 78704', mls: 'ACT2233445', value: 1875000, owner: 'Adam Mitchell', representing: 'buyer', stage: 'pending', label: 'closes', important: '2026-05-30', status: 'active' },
  { address: 'The Chelsea Penthouse', city: 'Austin, TX 78702', mls: 'ACT3344556', value: 3200000, owner: 'L. Guggenheim', representing: 'buyer', stage: 'pending', label: 'closes', important: '2026-05-28', status: 'active' },
  { address: '22 West 12th St', city: 'Austin, TX 78701', mls: 'ACT4455667', value: 1650000, owner: 'Meredith Brooks', representing: 'seller', stage: 'active', label: 'expires', important: '2026-08-31', status: 'active' },
];

export const TEAM_MEMBERS = [
  { name: 'Tessa', email: 'tessa@theheydaygroup.com', role: 'operations' },
  { name: 'Adam', email: 'adam@theheydaygroup.com', role: 'marketing' },
  { name: 'Margaret', email: 'margaret@theheydaygroup.com', role: 'analyst' },
  { name: 'Meredith', email: 'meredith@theheydaygroup.com', role: 'owner_lead' },
];

/** Seed bundled templates only when the DB has none (first install). */
export function seedChecklistTemplatesIfEmpty(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM checklist_templates').get().c;
  if (count > 0) return false;

  insertChecklistTemplatesFromSeed(db);
  console.log(`Seeded ${CHECKLIST_TEMPLATES.length} checklist templates (${CHECKLIST_TEMPLATES.reduce((n, t) => n + t.tasks.length, 0)} tasks)`);
  return true;
}

/**
 * Replace tasks for named templates from checklist-templates.js (preserves other templates).
 */
export function resyncNamedChecklistTemplates(db, names) {
  const unlink = db.prepare(
    'UPDATE tasks SET template_task_id = NULL WHERE template_task_id IN (SELECT id FROM template_tasks WHERE template_id = ?)',
  );
  const del = db.prepare('DELETE FROM template_tasks WHERE template_id = ?');
  const insert = db.prepare(`
    INSERT INTO template_tasks (template_id, title, timing_value, timing_direction, timing_anchor, sort_order, default_role, calendar_nickname)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const name of names) {
    const template = CHECKLIST_TEMPLATES.find((t) => t.name === name);
    if (!template) {
      console.error(`Template not found in seed: ${name}`);
      continue;
    }
    const row = db.prepare('SELECT id FROM checklist_templates WHERE name = ?').get(name);
    if (!row) {
      console.error(`Template not in DB: ${name}`);
      continue;
    }
    const templateId = row.id;
    const defaultRole = defaultRoleForChecklistTemplate(name);

    db.transaction(() => {
      unlink.run(templateId);
      del.run(templateId);
      template.tasks.forEach((task, i) => {
        insert.run(
          templateId,
          task.title,
          task.v,
          task.d,
          task.anchor,
          i,
          defaultRole,
          deriveNickname(task.title),
        );
      });
    })();

    const { relinked, deleted } = dedupeChecklistTasksForTemplate(db, templateId);
    const dedupeNote = (relinked || deleted) ? ` (relinked ${relinked}, removed ${deleted} duplicate/stale)` : '';
    console.log(`Synced "${name}": ${template.tasks.length} tasks${dedupeNote}`);
  }
}

/**
 * Wipe and re-import from checklist-templates.js.
 * For admin scripts only — never call on routine server startup.
 */
export function forceResyncChecklistTemplates(db) {
  db.exec('PRAGMA foreign_keys = OFF');
  db.prepare('UPDATE transactions SET checklist_template_id = NULL').run();
  db.prepare('UPDATE tasks SET template_task_id = NULL').run();
  db.prepare('DELETE FROM template_tasks').run();
  db.prepare('DELETE FROM checklist_templates').run();

  insertChecklistTemplatesFromSeed(db);

  db.exec('PRAGMA foreign_keys = ON');
  console.log(`Force-synced ${CHECKLIST_TEMPLATES.length} checklist templates (${CHECKLIST_TEMPLATES.reduce((n, t) => n + t.tasks.length, 0)} tasks)`);
}

/** @deprecated Use forceResyncChecklistTemplates — kept for explicit admin scripts */
export function syncChecklistTemplatesOnly(db) {
  forceResyncChecklistTemplates(db);
}

export function seedBrokermintData(db) {
  seedChecklistTemplatesIfEmpty(db);
  seedTeamMembers(db);
}

function insertChecklistTemplatesFromSeed(db) {
  CHECKLIST_TEMPLATES.forEach((template) => {
    const sortOrder = CHECKLIST_TEMPLATE_SORT_ORDER[template.name] ?? 99;
    const templateDefaultRole = defaultRoleForChecklistTemplate(template.name);
    const r = db.prepare('INSERT INTO checklist_templates (name, category, sort_order) VALUES (?, ?, ?)')
      .run(template.name, template.category, sortOrder);
    template.tasks.forEach((task, i) => {
      const calendarNickname = deriveNickname(task.title);
      db.prepare(`
        INSERT INTO template_tasks (template_id, title, timing_value, timing_direction, timing_anchor, sort_order, default_role, calendar_nickname)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r.lastInsertRowid, task.title, task.v, task.d, task.anchor, i, templateDefaultRole, calendarNickname);
    });
  });
}

function seedTeamMembers(db) {
  const hash = bcrypt.hashSync('heyday123', 12);
  const insert = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
  const updateRole = db.prepare('UPDATE users SET role = ? WHERE email = ?');

  for (const member of TEAM_MEMBERS) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(member.email);
    if (existing) {
      updateRole.run(member.role, member.email);
    } else {
      insert.run(member.name, member.email, hash, member.role);
    }
  }
}
