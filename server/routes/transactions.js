import { Router } from 'express';
import db from '../db.js';
import { recalculateTransactionTasks, anchorDatesChanged } from '../lib/recalculateTasks.js';
import { logActivity, formatFieldChange, actorLabel } from '../lib/activity.js';
import {
  getPartiesForTransaction,
  saveParties,
  reshapePartiesForRepresenting,
  syncCounterpartyNamesFromTransaction,
} from '../lib/transactionParties.js';
import { normalizeRepresenting } from '../lib/transactionValidation.js';
import { normalizeAddressFields } from '../lib/address.js';
import { applyChecklistsToTransaction, removeChecklistFromTransaction } from '../lib/applyChecklists.js';
import { getTransactionChecklists } from '../lib/transactionChecklists.js';
import {
  validateCreateTransaction,
  validateTransactionFields,
  shouldValidateSetupCompletion,
  mergeTransactionForValidation,
} from '../lib/transactionValidation.js';

const router = Router();

const LISTING_REPRESENTING = "representing IN ('seller','seller_and_buyer','landlord','both','seller_and_client','leasing')";

const PORTFOLIO_SCOPE = "stage != 'closed'";
const LISTINGS_COUNT = `${LISTING_REPRESENTING} AND stage != 'closed' AND listing_date IS NOT NULL AND listing_date <= date('now') AND acceptance_date IS NULL`;
const PRE_LISTINGS_COUNT = `${LISTING_REPRESENTING} AND stage != 'closed' AND listing_date IS NOT NULL AND listing_date > date('now')`;
const PENDING_COUNT = "stage = 'pending' AND close_date IS NOT NULL";

const VIEW_MAP = {
  active_transactions: "stage IN ('active','pending')",
  all: '1=1',
  current_listings: LISTINGS_COUNT,
  all_listings: LISTING_REPRESENTING,
  pending: PENDING_COUNT,
  closed: "stage = 'closed'",
};

const TX_FIELDS = [
  'address', 'city', 'state', 'zip', 'value', 'owner_name', 'representing', 'stage',
  'important_date', 'important_date_label', 'close_date', 'listing_date',
  'acceptance_date', 'option_end_date', 'workflow_status', 'transaction_name',
  'sale_type', 'gross_commission', 'buyer_agreement_date', 'buyer_expiration_date',
  'client_name', 'owner_name', 'agent_id',
];

/** Under contract: pending when close_date is set; closed is manual; else active. */
function deriveStageFromCloseDate(record) {
  if (record.stage === 'closed') return 'closed';
  if (record.close_date) return 'pending';
  return 'active';
}

function syncStageFromCloseDate(db, transactionId, beforeStage) {
  const row = db.prepare('SELECT stage, close_date FROM transactions WHERE id = ?').get(transactionId);
  const derived = deriveStageFromCloseDate(row);
  if (derived === row.stage) return { changed: false, stage: row.stage };
  db.prepare('UPDATE transactions SET stage = ? WHERE id = ?').run(derived, transactionId);
  return {
    changed: true,
    stage: derived,
    change: formatFieldChange('stage', beforeStage, derived),
  };
}

function requireField(body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') {
      return `${f} is required`;
    }
  }
  return null;
}

function emptyToNull(v) {
  if (v === '' || v === undefined) return null;
  return v;
}

function pickTransaction(id) {
  return db.prepare(`
    SELECT t.*, u.name as agent_name, ct.name as template_name
    FROM transactions t
    LEFT JOIN users u ON u.id = t.agent_id
    LEFT JOIN checklist_templates ct ON ct.id = t.checklist_template_id
    WHERE t.id = ?
  `).get(id);
}

router.get('/', (req, res) => {
  const filter = req.query.filter || 'all';
  const search = (req.query.search || '').trim().toLowerCase();
  const where = VIEW_MAP[filter] || VIEW_MAP.all;
  let sql = `
    SELECT t.*, u.name as agent_name,
      (SELECT COUNT(*) FROM tasks tk WHERE tk.transaction_id = t.id AND tk.status != 'complete') as open_tasks,
      (SELECT COUNT(*) FROM tasks tk WHERE tk.transaction_id = t.id AND tk.status = 'complete') as done_tasks
    FROM transactions t
    LEFT JOIN users u ON u.id = t.agent_id
    WHERE ${where}
  `;
  const params = [];
  if (search) {
    sql += ` AND (LOWER(t.address) LIKE ? OR LOWER(t.city) LIKE ? OR LOWER(COALESCE(t.state, '')) LIKE ? OR LOWER(COALESCE(t.zip, '')) LIKE ? OR LOWER(COALESCE(t.client_name, t.owner_name)) LIKE ?)`;
    const q = `%${search}%`;
    params.push(q, q, q, q, q);
  }
  sql += ' ORDER BY t.created_at DESC';
  const transactions = db.prepare(sql).all(...params);

  const stats = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as volume,
      SUM(CASE WHEN ${LISTINGS_COUNT} THEN 1 ELSE 0 END) as listings_count,
      SUM(CASE WHEN ${PRE_LISTINGS_COUNT} THEN 1 ELSE 0 END) as pre_listings_count,
      SUM(CASE WHEN ${PENDING_COUNT} THEN 1 ELSE 0 END) as pending_count
    FROM transactions WHERE ${PORTFOLIO_SCOPE}
  `).get();

  res.json({ transactions, stats });
});

router.get('/:id/activity', (req, res) => {
  const activities = db.prepare(`
    SELECT a.*, u.name as user_name
    FROM transaction_activity a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.transaction_id = ?
    ORDER BY a.created_at DESC
  `).all(req.params.id);
  res.json({ activities });
});

router.post('/:id/activity', (req, res) => {
  const { comment } = req.body;
  if (!comment?.trim()) return res.status(400).json({ error: 'comment is required' });

  const actor = actorLabel(req.user);
  logActivity({
    transactionId: Number(req.params.id),
    userId: req.user.id,
    eventType: 'comment',
    summary: `${actor} added a comment`,
    detail: comment.trim(),
  });

  const row = db.prepare(`
    SELECT a.*, u.name as user_name FROM transaction_activity a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.id DESC LIMIT 1
  `).get();
  res.status(201).json({ activity: row });
});

router.get('/:id/parties', (req, res) => {
  const tx = db.prepare('SELECT id FROM transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Not found' });
  const parties = getPartiesForTransaction(db, tx.id);
  res.json({ parties });
});

router.get('/:id/checklists', (req, res) => {
  const tx = db.prepare('SELECT id FROM transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Not found' });
  const checklists = getTransactionChecklists(db, req.params.id);
  res.json({ checklists });
});

router.delete('/:id/checklists/:templateId', (req, res) => {
  const result = removeChecklistFromTransaction(db, req.params.id, req.params.templateId, req.user);
  if (result.error === 'not_found') return res.status(404).json({ error: 'Not found' });
  if (result.error === 'checklist_not_linked') return res.status(404).json({ error: 'Checklist not applied to this transaction' });
  if (result.error === 'template_not_found') return res.status(404).json({ error: 'Template not found' });
  if (result.error) return res.status(result.status || 400).json({ error: result.error });

  res.json(result);
});

router.get('/:id', (req, res) => {
  const transaction = pickTransaction(req.params.id);
  if (!transaction) return res.status(404).json({ error: 'Not found' });
  const parties = getPartiesForTransaction(db, transaction.id);
  res.json({ transaction, parties });
});

router.put('/:id/parties', (req, res) => {
  const tx = db.prepare('SELECT id FROM transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Not found' });
  if (!Array.isArray(req.body.parties)) return res.status(400).json({ error: 'parties array required' });

  const parties = saveParties(db, req.params.id, req.body.parties);
  const transaction = pickTransaction(req.params.id);
  res.json({ transaction, parties });
});

router.post('/', (req, res) => {
  const err = validateCreateTransaction(req.body);
  if (err) return res.status(400).json({ error: err });

  const name = (req.body.client_name || req.body.owner_name)?.trim() || null;
  const normalized = normalizeAddressFields(req.body);
  const meredith = db.prepare("SELECT id FROM users WHERE email = 'meredith@theheydaygroup.com'").get();
  const defaultAgentId = meredith?.id ?? req.user.id;
  const result = db.prepare(`
    INSERT INTO transactions (address, city, state, zip, value, owner_name, client_name, agent_id, workflow_status, stage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'details', 'active')
  `).run(
    normalized.address,
    normalized.city,
    normalized.state,
    normalized.zip,
    req.body.value ? Number(req.body.value) : null,
    name,
    name,
    defaultAgentId,
  );

  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
  const actor = actorLabel(req.user);
  logActivity({
    transactionId: transaction.id,
    userId: req.user.id,
    eventType: 'transaction_created',
    summary: `${actor} created the transaction`,
  });
  res.status(201).json({ transaction });
});

router.put('/:id', (req, res) => {
  const before = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!before) return res.status(404).json({ error: 'Not found' });

  if (shouldValidateSetupCompletion(req.body, before)) {
    const merged = mergeTransactionForValidation(before, req.body);
    const validation = validateTransactionFields(merged);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.message, missing: validation.missing });
    }
  }

  const sets = [];
  const values = [];
  const changes = [];

  for (const field of TX_FIELDS) {
    if (!(field in req.body)) continue;
    let val = req.body[field];
    if (field === 'value' || field === 'gross_commission') {
      val = val != null && val !== '' ? Number(val) : null;
    } else if (field === 'agent_id') {
      val = val != null && val !== '' ? Number(val) : null;
      if (val) {
        const agent = db.prepare('SELECT id FROM users WHERE id = ?').get(val);
        if (!agent) return res.status(400).json({ error: 'Invalid agent_id' });
      }
    } else if (field === 'client_name' && val != null && val !== '') {
      val = val.trim();
      if (!('owner_name' in req.body)) req.body.owner_name = val;
    } else if (typeof val === 'string') {
      val = emptyToNull(val.trim?.() ?? val);
    }
    if (before[field] !== val) {
      changes.push(formatFieldChange(field.replace(/_/g, ' '), before[field], val));
    }
    sets.push(`${field} = ?`);
    values.push(val);
  }

  if (sets.length === 0) {
    return res.json({ transaction: pickTransaction(req.params.id) });
  }

  values.push(req.params.id);
  db.prepare(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  let after = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);

  const stageSync = syncStageFromCloseDate(db, after.id, before.stage);
  if (stageSync.changed) {
    changes.push(stageSync.change);
    after = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  }

  if ('address' in req.body || 'city' in req.body || 'state' in req.body || 'zip' in req.body) {
    const normalized = normalizeAddressFields({
      address: 'address' in req.body ? req.body.address : after.address,
      city: 'city' in req.body ? req.body.city : after.city,
      state: 'state' in req.body ? req.body.state : after.state,
      zip: 'zip' in req.body ? req.body.zip : after.zip,
    });
    if (
      normalized.address !== after.address
      || normalized.city !== after.city
      || normalized.state !== after.state
      || normalized.zip !== after.zip
    ) {
      db.prepare('UPDATE transactions SET address = ?, city = ?, state = ?, zip = ? WHERE id = ?').run(
        normalized.address,
        normalized.city,
        normalized.state,
        normalized.zip,
        after.id,
      );
      after = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    }
  }

  if ('client_name' in req.body || 'owner_name' in req.body) {
    const external = (after.client_name || after.owner_name)?.trim();
    if (external) {
      syncCounterpartyNamesFromTransaction(db, after.id, external);
    }
  }

  let updatedParties = null;
  if (
    'representing' in req.body
    && normalizeRepresenting(before.representing) !== normalizeRepresenting(after.representing)
  ) {
    updatedParties = reshapePartiesForRepresenting(db, after.id);
    after = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  }

  let tasksRecalculated = 0;

  const actor = actorLabel(req.user);

  if (anchorDatesChanged(before, after)) {
    tasksRecalculated = recalculateTransactionTasks(after.id);
    logActivity({
      transactionId: after.id,
      userId: req.user.id,
      eventType: 'deadlines_changed',
      summary: `${actor} updated transaction dates`,
      detail: changes.filter((c) => /date|expiration|closing|listing|acceptance|option/i.test(c)).join('\n') || changes.join('\n'),
    });
  }

  if (changes.length > 0) {
    logActivity({
      transactionId: after.id,
      userId: req.user.id,
      eventType: 'transaction_updated',
      summary: `${actor} updated the transaction`,
      detail: changes.join('\n'),
    });
  }

  const payload = { transaction: pickTransaction(after.id), tasksRecalculated };
  if (updatedParties) payload.parties = updatedParties;
  res.json(payload);
});

router.delete('/:id', (req, res) => {
  const tx = db.prepare('SELECT id FROM transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Not found' });

  db.transaction(() => {
    db.prepare('DELETE FROM tasks WHERE transaction_id = ?').run(tx.id);
    db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
  })();

  res.json({ ok: true });
});

router.post('/:id/apply-checklist', (req, res) => {
  const { template_id, template_ids } = req.body;
  const ids = template_ids?.length
    ? template_ids
    : template_id
      ? [template_id]
      : [];

  const result = applyChecklistsToTransaction(db, req.params.id, ids, req.user);
  if (result.error === 'not_found') return res.status(404).json({ error: 'Not found' });
  if (result.error) return res.status(result.status || 400).json({ error: result.error });

  res.status(201).json({ tasks: result.tasks, applied: result.applied, checklists: result.checklists });
});

router.post('/:id/apply-checklists', (req, res) => {
  const { template_ids } = req.body;
  if (!Array.isArray(template_ids) || template_ids.length === 0) {
    return res.status(400).json({ error: 'template_ids array required' });
  }

  const result = applyChecklistsToTransaction(db, req.params.id, template_ids, req.user);
  if (result.error === 'not_found') return res.status(404).json({ error: 'Not found' });
  if (result.error) return res.status(result.status || 400).json({ error: result.error });

  res.status(201).json({ tasks: result.tasks, applied: result.applied, checklists: result.checklists });
});

router.post('/:id/complete-setup', (req, res) => {
  db.prepare("UPDATE transactions SET workflow_status = 'active' WHERE id = ?").run(req.params.id);
  const transaction = pickTransaction(req.params.id);
  res.json({ transaction });
});

export default router;
