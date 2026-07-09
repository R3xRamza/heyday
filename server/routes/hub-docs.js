import { Router } from 'express';
import db from '../db.js';

const router = Router();

const SECTIONS = new Set(['feedback', 'hub_edits']);

function normalizeSection(section) {
  return SECTIONS.has(section) ? section : null;
}

function getItems(section) {
  return db.prepare(`
    SELECT i.*, u.name as updated_by_name
    FROM hub_doc_items i
    LEFT JOIN users u ON u.id = i.updated_by
    WHERE i.section = ?
    ORDER BY i.sort_order, i.id
  `).all(section);
}

function getItemOr404(id) {
  return db.prepare(`
    SELECT i.*, u.name as updated_by_name
    FROM hub_doc_items i
    LEFT JOIN users u ON u.id = i.updated_by
    WHERE i.id = ?
  `).get(id);
}

router.get('/', (req, res) => {
  const section = normalizeSection(req.query.section);
  if (!section) return res.status(400).json({ error: 'section must be feedback or hub_edits' });

  res.json({ items: getItems(section) });
});

router.post('/', (req, res) => {
  const section = normalizeSection(req.body.section);
  if (!section) return res.status(400).json({ error: 'section must be feedback or hub_edits' });

  const body = req.body.body != null ? req.body.body : '';

  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM hub_doc_items WHERE section = ?',
  ).get(section);

  const result = db.prepare(`
    INSERT INTO hub_doc_items (section, body, sort_order, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(section, body, maxOrder.m + 1, req.user.id, req.user.id);

  res.status(201).json({ item: getItemOr404(result.lastInsertRowid) });
});

router.patch('/:id', (req, res) => {
  const item = getItemOr404(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const body = req.body.body != null ? req.body.body : item.body;

  db.prepare(`
    UPDATE hub_doc_items
    SET body = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(body, req.user.id, item.id);

  res.json({ item: getItemOr404(item.id) });
});

router.delete('/:id', (req, res) => {
  const item = db.prepare('SELECT id FROM hub_doc_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  db.prepare('DELETE FROM hub_doc_items WHERE id = ?').run(item.id);
  res.json({ ok: true });
});

export default router;
