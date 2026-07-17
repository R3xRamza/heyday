import { Router } from 'express';
import { parse } from 'csv-parse/sync';
import db from '../db.js';
import { recalculateTransactionTasks, anchorDatesChanged } from '../lib/recalculateTasks.js';
import { logActivity, formatFieldChange, actorLabel } from '../lib/activity.js';
import {
  getPartiesForTransaction,
  saveParties,
  reshapePartiesForRepresenting,
  syncCounterpartyNamesFromTransaction,
  assertPartiesForIntent,
  isTraditionalSale,
  normalizeSaleType,
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
import { closePastDueTransactions, deriveStageFromCloseDate } from '../lib/transactionAutoClose.js';
import { CURRENT_LISTINGS_VIEW_SCOPE, ON_MARKET_LISTINGS_SCOPE, PRE_LISTINGS_SCOPE } from '../lib/transactionScopes.js';
import { parseAgentScope, transactionAgentScopeClause, assertTransactionInScope } from '../lib/agentScope.js';
import { runBrokermintImport, fixBrokermintAgentIds } from '../lib/brokermintImport.js';
import { parsePagination } from '../lib/pagination.js';
import {
  COMMISSION_SETTINGS,
  computeDealCommission,
  computeYearCommissions,
  anniversaryWindowForDate,
  parseCustomFees,
  serializeCustomFees,
  dealSortsBefore,
  resolveGrossCommission,
  normalizeGciMode,
} from '../lib/commissionPlans.js';

const router = Router();

const PORTFOLIO_SCOPE = "stage != 'closed'";
const PENDING_COUNT = "stage = 'pending' AND close_date IS NOT NULL";

const VIEW_MAP = {
  active_transactions: "stage IN ('active','pending')",
  all: '1=1',
  current_listings: CURRENT_LISTINGS_VIEW_SCOPE,
  coming_soon: PRE_LISTINGS_SCOPE,
  all_listings: PRE_LISTINGS_SCOPE,
  pending: PENDING_COUNT,
  closed: "stage = 'closed'",
};

/** Case-insensitive address / zip / client search predicate. `alias` e.g. 't' or '' for bare table. */
function transactionSearchClause(alias = 't') {
  const p = alias ? `${alias}.` : '';
  return `(LOWER(${p}address) LIKE ? OR LOWER(${p}city) LIKE ? OR LOWER(COALESCE(${p}state, '')) LIKE ? OR LOWER(COALESCE(${p}zip, '')) LIKE ? OR LOWER(COALESCE(${p}client_name, ${p}owner_name)) LIKE ?)`;
}

function transactionSearchParams(search) {
  const q = `%${search}%`;
  return [q, q, q, q, q];
}

function closedYtdStatsForSearch(db, agentScope, search) {
  const jan1 = `${new Date().getFullYear()}-01-01`;
  const { sql, params } = transactionAgentScopeClause(agentScope, '');
  let query = `
    SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as volume
    FROM transactions
    WHERE stage = 'closed' AND close_date >= ?${sql}
  `;
  const bind = [jan1, ...params];
  if (search) {
    query += ` AND ${transactionSearchClause('')}`;
    bind.push(...transactionSearchParams(search));
  }
  return db.prepare(query).get(...bind);
}

const TX_FIELDS = [
  'address', 'city', 'state', 'zip', 'value', 'owner_name', 'representing', 'listing_visibility', 'stage',
  'important_date', 'important_date_label', 'close_date', 'listing_date',
  'acceptance_date', 'option_end_date', 'workflow_status', 'transaction_name',
  'sale_type', 'gross_commission', 'commission_custom_fees',
  'commission_gci_mode', 'commission_gci_percent',
  'buyer_agreement_date', 'buyer_expiration_date',
  'client_name', 'owner_name', 'agent_id',
];

function todayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

function buildCommissionSummary(tx) {
  const dealDate = tx.close_date || todayYmd();
  const window = anniversaryWindowForDate(dealDate);
  const agentId = tx.agent_id != null ? Number(tx.agent_id) : null;

  let peers = [];
  if (agentId) {
    peers = db.prepare(`
      SELECT id, close_date, gross_commission, commission_custom_fees,
        stage, address, value
      FROM transactions
      WHERE agent_id = ?
        AND close_date IS NOT NULL
        AND close_date >= ? AND close_date <= ?
      ORDER BY close_date ASC, id ASC
    `).all(agentId, window.start, window.end);
  }

  const prior = peers.filter((p) => {
    if (Number(p.id) === Number(tx.id)) return false;
    return dealSortsBefore(p, tx, dealDate);
  });

  const priorRun = computeYearCommissions(prior);
  const gciMode = normalizeGciMode(tx.commission_gci_mode);
  const gciPercent = tx.commission_gci_percent != null && tx.commission_gci_percent !== ''
    ? Number(tx.commission_gci_percent)
    : null;
  const gci = resolveGrossCommission({
    mode: gciMode,
    grossCommission: tx.gross_commission,
    gciPercent,
    salesPrice: tx.value,
  });
  const hasGci = gci != null && !Number.isNaN(gci) && gci >= 0;

  const overrides = {
    customFees: tx.commission_custom_fees,
  };

  const ytdBefore = {
    capPaid: priorRun.capPaid,
    riskPaid: priorRun.riskPaid,
    cappedFeesPaid: priorRun.cappedFeesPaid,
  };

  const breakdown = hasGci
    ? computeDealCommission(gci, ytdBefore, overrides)
    : null;

  const capPaid = breakdown ? breakdown.capPaidAfter : priorRun.capPaid;
  const riskPaid = breakdown ? breakdown.riskPaidAfter : priorRun.riskPaid;
  const cappedFeesPaid = breakdown ? breakdown.cappedFeesPaidAfter : priorRun.cappedFeesPaid;
  const afterCap = capPaid >= COMMISSION_SETTINGS.capAmount
    || (breakdown ? breakdown.plan === 'after_cap' : priorRun.capPaid >= COMMISSION_SETTINGS.capAmount);

  // For rate display when after cap but this deal has no GCI yet:
  const displayCappedFeeRate = afterCap
    ? (priorRun.cappedFeesPaid >= COMMISSION_SETTINGS.cappedFeesStepDownAt
      ? COMMISSION_SETTINGS.cappedTransactionFeeReduced
      : COMMISSION_SETTINGS.cappedTransactionFee)
    : (breakdown?.cappedFee || 0);

  return {
    settings: COMMISSION_SETTINGS,
    anniversary: {
      start: window.start,
      end: window.end,
      startYear: window.startYear,
    },
    dealDate,
    hasGci,
    gci_mode: gciMode,
    gci_percent: gciMode === 'percent' && gciPercent != null && !Number.isNaN(gciPercent) ? gciPercent : null,
    gross_commission: hasGci ? gci : null,
    sales_price: tx.value != null ? Number(tx.value) : null,
    custom_fees: parseCustomFees(tx.commission_custom_fees),
    breakdown,
    progress: {
      capPaid,
      capAmount: COMMISSION_SETTINGS.capAmount,
      riskPaid,
      riskCap: COMMISSION_SETTINGS.riskManagementAnnualCap,
      cappedFeesPaid,
      cappedFeesStepDownAt: COMMISSION_SETTINGS.cappedFeesStepDownAt,
      cappedFeeRate: breakdown ? (breakdown.cappedFee || displayCappedFeeRate) : displayCappedFeeRate,
      plan: breakdown?.plan || (priorRun.capPaid >= COMMISSION_SETTINGS.capAmount ? 'after_cap' : 'before_cap'),
    },
    ytdBefore,
  };
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

const DATE_FIELD_BY_FILTER = {
  active_transactions: 'created_at',
  all: 'created_at',
  current_listings: 'listing_date',
  coming_soon: 'listing_date',
  all_listings: 'listing_date',
  pending: 'close_date',
  closed: 'close_date',
};

function transactionOrderClause(sortKey, sortDir, dateField) {
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
  switch (sortKey) {
    case 'address':
      return `LOWER(t.address) ${dir}, LOWER(t.city) ${dir}, t.id ${dir}`;
    case 'value':
      return `(t.value IS NULL), t.value ${dir}, t.id ${dir}`;
    case 'agent':
      return `(u.name IS NULL), LOWER(u.name) ${dir}, t.id ${dir}`;
    case 'type':
      return `t.stage ${dir}, COALESCE(t.listing_visibility, 'public') ${dir}, (t.listing_date IS NULL), t.listing_date ${dir}, t.id ${dir}`;
    case 'expiration':
      return `(t.important_date IS NULL), t.important_date ${dir}, t.id ${dir}`;
    case 'date':
    default:
      return `(t.${dateField} IS NULL), t.${dateField} ${dir}, t.id ${dir}`;
  }
}

router.get('/', (req, res) => {
  closePastDueTransactions(db);
  const filter = req.query.filter || 'all';
  const search = (req.query.search || '').trim().toLowerCase();
  const where = VIEW_MAP[filter] || VIEW_MAP.all;
  const { page, limit, offset } = parsePagination(req.query);
  const sortKey = req.query.sort || 'date';
  const sortDir = req.query.order === 'asc' ? 'asc' : 'desc';
  const dateField = DATE_FIELD_BY_FILTER[filter] || 'created_at';
  const agentScope = parseAgentScope(req.query);
  const { sql: scopeSql, params: scopeParams } = transactionAgentScopeClause(agentScope, 't');
  const { sql: scopeSqlBare, params: scopeParamsBare } = transactionAgentScopeClause(agentScope, '');

  let countSql = `SELECT COUNT(*) as c FROM transactions t WHERE ${where}${scopeSql}`;
  const params = [...scopeParams];
  if (search) {
    countSql += ` AND ${transactionSearchClause('t')}`;
    params.push(...transactionSearchParams(search));
  }
  const total = db.prepare(countSql).get(...params).c;

  let sql = `
    SELECT t.*, u.name as agent_name,
      (SELECT COUNT(*) FROM tasks tk WHERE tk.transaction_id = t.id AND tk.status != 'complete') as open_tasks,
      (SELECT COUNT(*) FROM tasks tk WHERE tk.transaction_id = t.id AND tk.status = 'complete') as done_tasks
    FROM transactions t
    LEFT JOIN users u ON u.id = t.agent_id
    WHERE ${where}${scopeSql}
  `;
  if (search) {
    sql += ` AND ${transactionSearchClause('t')}`;
  }
  sql += ` ORDER BY ${transactionOrderClause(sortKey, sortDir, dateField)} LIMIT ? OFFSET ?`;
  const transactions = db.prepare(sql).all(...params, limit, offset);

  let portfolioSql = `
    SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as volume,
      SUM(CASE WHEN ${ON_MARKET_LISTINGS_SCOPE} THEN 1 ELSE 0 END) as listings_count,
      SUM(CASE WHEN ${PRE_LISTINGS_SCOPE} THEN 1 ELSE 0 END) as pre_listings_count,
      SUM(CASE WHEN ${PENDING_COUNT} THEN 1 ELSE 0 END) as pending_count
    FROM transactions WHERE ${PORTFOLIO_SCOPE}${scopeSqlBare}
  `;
  const portfolioParams = [...scopeParamsBare];
  if (search) {
    portfolioSql += ` AND ${transactionSearchClause('')}`;
    portfolioParams.push(...transactionSearchParams(search));
  }
  const portfolioStats = db.prepare(portfolioSql).get(...portfolioParams);

  let filteredSql = `SELECT COUNT(*) as count, COALESCE(SUM(t.value), 0) as volume FROM transactions t WHERE ${where}${scopeSql}`;
  if (search) {
    filteredSql += ` AND ${transactionSearchClause('t')}`;
  }
  const filtered = db.prepare(filteredSql).get(...params);

  res.json({
    transactions,
    total,
    page,
    limit,
    stats: {
      ...portfolioStats,
      filtered,
      closedYtd: closedYtdStatsForSearch(db, agentScope, search),
    },
  });
});

/** Admin-only: import Brokermint data ({ csv } or { rows, clearFirst }). */
router.post('/import-brokermint', (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const clearFirst = req.body?.clearFirst !== false;
  let rawRows = req.body?.rows;

  if (!Array.isArray(rawRows)) {
    const content = req.body?.csv;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Body must include csv string or rows array' });
    }
    try {
      rawRows = parse(content, {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
      });
    } catch (e) {
      return res.status(400).json({ error: `Invalid CSV: ${e.message}` });
    }
  }

  const result = runBrokermintImport(db, rawRows, { clearFirst });
  res.json({ ok: true, ...result });
});

/** Admin-only: re-map agent_id from Brokermint users column ({ rows }). */
router.post('/fix-brokermint-agents', (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  if (!Array.isArray(req.body?.rows)) {
    return res.status(400).json({ error: 'Body must include rows array' });
  }
  const result = fixBrokermintAgentIds(db, req.body.rows);
  res.json({ ok: true, ...result });
});

router.get('/:id/activity', (req, res) => {
  if (!assertTransactionInScope(req, res, Number(req.params.id))) return;
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
  if (!assertTransactionInScope(req, res, Number(req.params.id))) return;
  const tx = db.prepare('SELECT id FROM transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Not found' });
  const parties = getPartiesForTransaction(db, tx.id);
  res.json({ parties });
});

router.get('/:id/checklists', (req, res) => {
  if (!assertTransactionInScope(req, res, Number(req.params.id))) return;
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

router.get('/:id/commission', (req, res) => {
  if (!assertTransactionInScope(req, res, Number(req.params.id))) return;
  const transaction = pickTransaction(req.params.id);
  if (!transaction) return res.status(404).json({ error: 'Not found' });
  res.json(buildCommissionSummary(transaction));
});

router.patch('/:id/commission', (req, res) => {
  if (!assertTransactionInScope(req, res, Number(req.params.id))) return;
  const before = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!before) return res.status(404).json({ error: 'Not found' });

  const sets = [];
  const values = [];
  const changes = [];

  let nextMode = normalizeGciMode(
    'gci_mode' in req.body || 'commission_gci_mode' in req.body
      ? (req.body.gci_mode ?? req.body.commission_gci_mode)
      : before.commission_gci_mode,
  );
  let nextPercent = before.commission_gci_percent;
  const salesPrice = before.value != null ? Number(before.value) : null;

  if ('gci_mode' in req.body || 'commission_gci_mode' in req.body) {
    const modeRaw = req.body.gci_mode ?? req.body.commission_gci_mode;
    nextMode = normalizeGciMode(modeRaw);
    if (normalizeGciMode(before.commission_gci_mode) !== nextMode) {
      changes.push(formatFieldChange('gci mode', before.commission_gci_mode || 'amount', nextMode));
    }
    sets.push('commission_gci_mode = ?');
    values.push(nextMode);
  }

  if ('gci_percent' in req.body || 'commission_gci_percent' in req.body) {
    const raw = 'gci_percent' in req.body ? req.body.gci_percent : req.body.commission_gci_percent;
    const value = raw === null || raw === '' || raw === undefined ? null : Number(raw);
    if (value !== null && (Number.isNaN(value) || value < 0)) {
      return res.status(400).json({ error: 'gci_percent must be a non-negative number' });
    }
    nextPercent = value;
    if (Number(before.commission_gci_percent) !== value) {
      changes.push(formatFieldChange('gci percent', before.commission_gci_percent, value));
    }
    sets.push('commission_gci_percent = ?');
    values.push(value);
  }

  if ('gross_commission' in req.body && nextMode === 'amount') {
    const raw = req.body.gross_commission;
    const value = raw === null || raw === '' || raw === undefined ? null : Number(raw);
    if (value !== null && (Number.isNaN(value) || value < 0)) {
      return res.status(400).json({ error: 'gross_commission must be a non-negative number' });
    }
    if (before.gross_commission !== value) {
      changes.push(formatFieldChange('gross commission', before.gross_commission, value));
    }
    sets.push('gross_commission = ?');
    values.push(value);
  }

  // Keep dollar GCI in sync when percent mode is active.
  const gciTouched = 'gross_commission' in req.body
    || 'gci_percent' in req.body
    || 'commission_gci_percent' in req.body
    || 'gci_mode' in req.body
    || 'commission_gci_mode' in req.body;
  if (gciTouched && nextMode === 'percent') {
    const resolved = resolveGrossCommission({
      mode: 'percent',
      gciPercent: nextPercent,
      salesPrice,
    });
    if (resolved !== null) {
      const gciSetIdx = sets.indexOf('gross_commission = ?');
      if (gciSetIdx >= 0) {
        values[gciSetIdx] = resolved;
      } else if (Number(before.gross_commission) !== resolved) {
        changes.push(formatFieldChange('gross commission', before.gross_commission, resolved));
        sets.push('gross_commission = ?');
        values.push(resolved);
      }
    }
  }

  if ('commission_custom_fees' in req.body || 'custom_fees' in req.body) {
    const raw = 'commission_custom_fees' in req.body ? req.body.commission_custom_fees : req.body.custom_fees;
    if (raw != null && !Array.isArray(raw) && typeof raw !== 'string') {
      return res.status(400).json({ error: 'custom_fees must be an array' });
    }
    const fees = parseCustomFees(raw);
    for (const fee of fees) {
      if (Number.isNaN(Number(fee.amount)) || Number(fee.amount) < 0) {
        return res.status(400).json({ error: 'custom fee amounts must be non-negative numbers' });
      }
    }
    const serialized = serializeCustomFees(fees);
    if (String(before.commission_custom_fees || '[]') !== serialized) {
      changes.push(formatFieldChange('custom fees', before.commission_custom_fees, serialized));
    }
    sets.push('commission_custom_fees = ?');
    values.push(serialized);
  }

  if (sets.length > 0) {
    values.push(req.params.id);
    db.prepare(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    if (changes.length) {
      logActivity({
        transactionId: Number(req.params.id),
        userId: req.user?.id,
        eventType: 'transaction_updated',
        summary: `Commission updated by ${actorLabel(req.user)}`,
        detail: changes.join('; '),
      });
    }
  }

  const transaction = pickTransaction(req.params.id);
  res.json(buildCommissionSummary(transaction));
});

router.get('/:id', (req, res) => {
  closePastDueTransactions(db);
  const transaction = pickTransaction(req.params.id);
  if (!transaction) return res.status(404).json({ error: 'Not found' });
  if (!assertTransactionInScope(req, res, transaction.id)) return;
  const parties = getPartiesForTransaction(db, transaction.id);
  res.json({ transaction, parties });
});

router.put('/:id/parties', (req, res) => {
  if (!assertTransactionInScope(req, res, Number(req.params.id))) return;
  const tx = db.prepare('SELECT id FROM transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Not found' });
  if (!Array.isArray(req.body.parties)) return res.status(400).json({ error: 'parties array required' });

  try {
    const parties = saveParties(db, req.params.id, req.body.parties);
    const transaction = pickTransaction(req.params.id);
    res.json({ transaction, parties });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message, missing: err.missing });
    }
    throw err;
  }
});

router.post('/', (req, res) => {
  const err = validateCreateTransaction(req.body);
  if (err) return res.status(400).json({ error: err });

  const name = (req.body.client_name || req.body.owner_name)?.trim() || null;
  const normalized = normalizeAddressFields(req.body);
  const agentId = Number(req.body.agent_id);
  const agent = db.prepare('SELECT id FROM users WHERE id = ?').get(agentId);
  if (!agent) return res.status(400).json({ error: 'Invalid agent_id' });

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
    agentId,
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
  if (!assertTransactionInScope(req, res, Number(req.params.id))) return;
  const before = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!before) return res.status(404).json({ error: 'Not found' });

  if (shouldValidateSetupCompletion(req.body, before)) {
    const merged = mergeTransactionForValidation(before, req.body);
    const validation = validateTransactionFields(merged);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.message, missing: validation.missing });
    }
  }

  const nextCloseDate = 'close_date' in req.body
    ? (req.body.close_date === '' || req.body.close_date == null ? null : req.body.close_date)
    : before.close_date;
  const nextSaleType = 'sale_type' in req.body ? req.body.sale_type : before.sale_type;
  const nextRepresenting = 'representing' in req.body ? req.body.representing : before.representing;
  const nextWorkflow = 'workflow_status' in req.body ? req.body.workflow_status : before.workflow_status;
  const derivedStage = deriveStageFromCloseDate({
    stage: before.stage === 'closed' ? 'closed' : 'active',
    close_date: nextCloseDate,
  });

  if (nextWorkflow === 'active' && before.workflow_status !== 'active') {
    const partyCheck = assertPartiesForIntent(db, before.id, 'active');
    if (!partyCheck.ok) {
      return res.status(400).json({ error: partyCheck.message, missing: partyCheck.missing });
    }
  }

  const closeDateChanging = 'close_date' in req.body
    && String(req.body.close_date || '') !== String(before.close_date || '');
  if (closeDateChanging && nextCloseDate && derivedStage === 'pending') {
    const intent = isTraditionalSale(nextSaleType, nextRepresenting) ? 'pending' : 'active';
    const partyCheck = assertPartiesForIntent(db, before.id, intent);
    if (!partyCheck.ok) {
      return res.status(400).json({ error: partyCheck.message, missing: partyCheck.missing });
    }
  }

  const sets = [];
  const values = [];
  const changes = [];

  for (const field of TX_FIELDS) {
    if (!(field in req.body)) continue;
    let val = req.body[field];
    if (field === 'value' || field === 'gross_commission' || field === 'commission_gci_percent') {
      val = val != null && val !== '' ? Number(val) : null;
    } else if (field === 'commission_gci_mode') {
      val = normalizeGciMode(val);
    } else if (field === 'commission_custom_fees') {
      val = serializeCustomFees(val);
    } else if (field === 'agent_id') {
      val = val != null && val !== '' ? Number(val) : null;
      if (val) {
        const agent = db.prepare('SELECT id FROM users WHERE id = ?').get(val);
        if (!agent) return res.status(400).json({ error: 'Invalid agent_id' });
      }
    } else if (field === 'client_name' && val != null && val !== '') {
      val = val.trim();
      if (!('owner_name' in req.body)) req.body.owner_name = val;
    } else if (field === 'listing_visibility') {
      val = val === 'private' ? 'private' : val === 'coming_soon' ? 'coming_soon' : 'public';
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

  if (
    'value' in req.body
    && normalizeGciMode(after.commission_gci_mode) === 'percent'
    && after.commission_gci_percent != null
  ) {
    const resolved = resolveGrossCommission({
      mode: 'percent',
      gciPercent: after.commission_gci_percent,
      salesPrice: after.value,
    });
    if (resolved != null && Number(after.gross_commission) !== resolved) {
      db.prepare('UPDATE transactions SET gross_commission = ? WHERE id = ?').run(resolved, after.id);
      changes.push(formatFieldChange('gross commission', after.gross_commission, resolved));
      after = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    }
  }

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
    ('representing' in req.body
      && normalizeRepresenting(before.representing) !== normalizeRepresenting(after.representing))
    || ('sale_type' in req.body
      && normalizeSaleType(before.sale_type, before.representing)
        !== normalizeSaleType(after.sale_type, after.representing))
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

  try {
    db.transaction(() => {
      // Detach activity from tasks before delete (FK: transaction_activity.task_id → tasks.id).
      db.prepare(`
        UPDATE transaction_activity SET task_id = NULL
        WHERE transaction_id = ?
           OR task_id IN (SELECT id FROM tasks WHERE transaction_id = ?)
      `).run(tx.id, tx.id);
      db.prepare('DELETE FROM tasks WHERE transaction_id = ?').run(tx.id);
      db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
    })();
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete transaction failed:', err);
    res.status(500).json({ error: 'Could not delete transaction' });
  }
});

router.post('/:id/apply-checklist', (req, res) => {
  if (!assertTransactionInScope(req, res, Number(req.params.id))) return;
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
  if (!assertTransactionInScope(req, res, Number(req.params.id))) return;
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
  if (!assertTransactionInScope(req, res, Number(req.params.id))) return;
  const partyCheck = assertPartiesForIntent(db, req.params.id, 'active');
  if (!partyCheck.ok) {
    return res.status(400).json({ error: partyCheck.message, missing: partyCheck.missing });
  }
  db.prepare("UPDATE transactions SET workflow_status = 'active' WHERE id = ?").run(req.params.id);
  const transaction = pickTransaction(req.params.id);
  res.json({ transaction });
});

export default router;
