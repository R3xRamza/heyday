import { Router } from 'express';
import db from '../db.js';
import { syncLinkedTaskAssignees } from '../lib/taskAssignment.js';
import { deriveNickname } from '../lib/deriveNickname.js';

const router = Router();

const TIMING_ANCHORS = ['CLOSING', 'LISTING', 'ACCEPTANCE', 'OPTION END', 'CREATED'];

function getTasksForTemplate(templateId) {
  return db.prepare('SELECT * FROM template_tasks WHERE template_id = ? ORDER BY sort_order, id').all(templateId);
}

function getTemplateWithTasks(id) {
  const template = db.prepare('SELECT * FROM checklist_templates WHERE id = ?').get(id);
  if (!template) return null;
  return { ...template, tasks: getTasksForTemplate(id) };
}

function normalizeTemplateBody(body) {
  const name = body.name?.trim();
  if (!name) return { error: 'name is required' };
  return {
    name,
    category: body.category?.trim() || 'TRANSACTION',
    sort_order: body.sort_order != null ? Number(body.sort_order) : 0,
  };
}

function normalizeTaskBody(body, templateId, existingSortOrder) {
  const title = body.title?.trim();
  if (!title) return { error: 'title is required' };
  let sort_order = existingSortOrder;
  if (sort_order == null) {
    const row = db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) as m FROM template_tasks WHERE template_id = ?',
    ).get(templateId);
    sort_order = row.m + 1;
  }
  const anchor = TIMING_ANCHORS.includes(body.timing_anchor) ? body.timing_anchor : 'CLOSING';
  const calendar_nickname = body.calendar_nickname != null
    ? String(body.calendar_nickname).trim()
    : deriveNickname(title);
  return {
    title,
    timing_value: body.timing_value != null && body.timing_value !== '' ? Number(body.timing_value) : 0,
    timing_direction: body.timing_direction === 'B' ? 'B' : 'A',
    timing_anchor: anchor,
    sort_order,
    default_role: body.default_role?.trim() || 'operations',
    calendar_nickname,
  };
}

router.get('/', (_req, res) => {
  const templates = db.prepare('SELECT * FROM checklist_templates ORDER BY category, sort_order, name').all();
  res.json({
    templates: templates.map((t) => ({ ...t, tasks: getTasksForTemplate(t.id) })),
  });
});

router.get('/:id', (req, res) => {
  const template = getTemplateWithTasks(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  res.json({ template });
});

router.post('/', (req, res) => {
  const normalized = normalizeTemplateBody(req.body);
  if (normalized.error) return res.status(400).json({ error: normalized.error });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM checklist_templates').get();
  const sort_order = normalized.sort_order ?? maxOrder.m + 1;

  const result = db.prepare(
    'INSERT INTO checklist_templates (name, category, sort_order) VALUES (?, ?, ?)',
  ).run(normalized.name, normalized.category, sort_order);

  res.status(201).json({ template: getTemplateWithTasks(result.lastInsertRowid) });
});

router.put('/:id', (req, res) => {
  const current = db.prepare('SELECT * FROM checklist_templates WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Template not found' });

  const name = req.body.name != null ? req.body.name.trim() : current.name;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const category = req.body.category != null
    ? (req.body.category.trim() || 'TRANSACTION')
    : current.category;
  const sort_order = req.body.sort_order != null ? Number(req.body.sort_order) : current.sort_order;

  db.prepare('UPDATE checklist_templates SET name = ?, category = ?, sort_order = ? WHERE id = ?').run(
    name,
    category,
    sort_order,
    req.params.id,
  );

  res.json({ template: getTemplateWithTasks(req.params.id) });
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM checklist_templates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Template not found' });

  db.prepare('DELETE FROM template_tasks WHERE template_id = ?').run(req.params.id);
  db.prepare('DELETE FROM checklist_templates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/tasks', (req, res) => {
  const templateId = req.params.id;
  const template = db.prepare('SELECT id FROM checklist_templates WHERE id = ?').get(templateId);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const normalized = normalizeTaskBody(req.body, templateId);
  if (normalized.error) return res.status(400).json({ error: normalized.error });

  const result = db.prepare(`
    INSERT INTO template_tasks (template_id, title, timing_value, timing_direction, timing_anchor, sort_order, default_role, calendar_nickname)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    templateId,
    normalized.title,
    normalized.timing_value,
    normalized.timing_direction,
    normalized.timing_anchor,
    normalized.sort_order,
    normalized.default_role,
    normalized.calendar_nickname,
  );

  const task = db.prepare('SELECT * FROM template_tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ template: getTemplateWithTasks(templateId), task });
});

router.put('/:id/tasks/reorder', (req, res) => {
  const templateId = req.params.id;
  const order = req.body.order;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });

  const update = db.prepare('UPDATE template_tasks SET sort_order = ? WHERE id = ? AND template_id = ?');
  db.transaction(() => {
    order.forEach((taskId, index) => {
      update.run(index, taskId, templateId);
    });
  })();

  res.json({ template: getTemplateWithTasks(templateId) });
});

router.put('/:id/tasks/:taskId', (req, res) => {
  const templateId = req.params.id;
  const taskId = req.params.taskId;
  const task = db.prepare(
    'SELECT * FROM template_tasks WHERE id = ? AND template_id = ?',
  ).get(taskId, templateId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const title = req.body.title != null ? req.body.title.trim() : task.title;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const timing_value = req.body.timing_value != null ? Number(req.body.timing_value) : task.timing_value;
  const timing_direction = req.body.timing_direction != null
    ? (req.body.timing_direction === 'B' ? 'B' : 'A')
    : task.timing_direction;
  const timing_anchor = req.body.timing_anchor != null
    ? (TIMING_ANCHORS.includes(req.body.timing_anchor) ? req.body.timing_anchor : task.timing_anchor)
    : task.timing_anchor;
  const sort_order = req.body.sort_order != null ? Number(req.body.sort_order) : task.sort_order;
  const default_role = req.body.default_role != null
    ? (req.body.default_role.trim() || 'operations')
    : task.default_role;
  const calendar_nickname = req.body.calendar_nickname != null
    ? String(req.body.calendar_nickname).trim()
    : task.calendar_nickname;

  db.prepare(`
    UPDATE template_tasks
    SET title = ?, timing_value = ?, timing_direction = ?, timing_anchor = ?, sort_order = ?, default_role = ?, calendar_nickname = ?
    WHERE id = ? AND template_id = ?
  `).run(
    title,
    timing_value,
    timing_direction,
    timing_anchor,
    sort_order,
    default_role,
    calendar_nickname,
    taskId,
    templateId,
  );

  syncLinkedTaskAssignees(db, Number(taskId), default_role, title);

  res.json({ template: getTemplateWithTasks(templateId) });
});

router.delete('/:id/tasks/:taskId', (req, res) => {
  const result = db.prepare(
    'DELETE FROM template_tasks WHERE id = ? AND template_id = ?',
  ).run(req.params.taskId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });
  res.json({ template: getTemplateWithTasks(req.params.id) });
});

export default router;
