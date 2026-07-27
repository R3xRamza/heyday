import { Router } from 'express';
import db from '../db.js';
import {
  defaultOpportunityTablePrefs,
  normalizeOpportunityTablePrefs,
} from '../lib/opportunityTablePrefs.js';

const router = Router();

function parseJson(raw, kind) {
  if (!raw) return defaultOpportunityTablePrefs(kind);
  try {
    return normalizeOpportunityTablePrefs(kind, JSON.parse(raw));
  } catch {
    return defaultOpportunityTablePrefs(kind);
  }
}

function getOrCreateRow(userId) {
  let row = db.prepare('SELECT * FROM user_ui_prefs WHERE user_id = ?').get(userId);
  if (!row) {
    db.prepare(`
      INSERT INTO user_ui_prefs (user_id, opportunities_buyers_json, opportunities_sellers_json)
      VALUES (?, NULL, NULL)
    `).run(userId);
    row = db.prepare('SELECT * FROM user_ui_prefs WHERE user_id = ?').get(userId);
  }
  return row;
}

router.get('/opportunities', (req, res) => {
  const row = getOrCreateRow(req.user.id);
  res.json({
    buyers: parseJson(row.opportunities_buyers_json, 'buyers'),
    sellers: parseJson(row.opportunities_sellers_json, 'sellers'),
  });
});

router.put('/opportunities', (req, res) => {
  const row = getOrCreateRow(req.user.id);
  let buyers = parseJson(row.opportunities_buyers_json, 'buyers');
  let sellers = parseJson(row.opportunities_sellers_json, 'sellers');

  if (req.body?.buyers != null) {
    buyers = normalizeOpportunityTablePrefs('buyers', req.body.buyers);
  }
  if (req.body?.sellers != null) {
    sellers = normalizeOpportunityTablePrefs('sellers', req.body.sellers);
  }

  db.prepare(`
    UPDATE user_ui_prefs
    SET opportunities_buyers_json = ?,
        opportunities_sellers_json = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(JSON.stringify(buyers), JSON.stringify(sellers), req.user.id);

  res.json({ buyers, sellers });
});

export default router;
