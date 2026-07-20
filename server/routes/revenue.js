import { Router } from 'express';
import db from '../db.js';
import {
  computeYearCommissions,
  anniversaryWindowForEndYear,
} from '../lib/commissionPlans.js';
import { parseAgentScope, transactionAgentScopeClause, agentScopeUserId } from '../lib/agentScope.js';
import {
  getTemplateSettings,
  getTemplateSettingsForAgentId,
  listTemplates,
  saveTemplateSettings,
  TEMPLATE_AGENT_KEYS,
  TEMPLATE_AGENT_LABELS,
  agentKeyFromUserId,
} from '../lib/revenueTemplates.js';

const router = Router();

const DEAL_SELECT = `
  SELECT t.id, t.address, t.city, t.state, t.value, t.stage, t.representing, t.sale_type,
    t.close_date, t.gross_commission, t.commission_custom_fees, t.agent_id,
    t.client_name, u.name as agent_name
  FROM transactions t
  LEFT JOIN users u ON u.id = t.agent_id
`;

/** Run deals through each agent's own template + YTD (caps are per agent). */
function computeByAgentTemplates(deals) {
  const groups = new Map();
  for (const deal of deals) {
    const key = deal.agent_id != null ? String(deal.agent_id) : 'none';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(deal);
  }

  const results = [];
  let capPaid = 0;
  let riskPaid = 0;
  let cappedFeesPaid = 0;
  let singleSettings = null;
  let agentCount = 0;

  for (const [, group] of groups) {
    group.sort((a, b) => {
      const ad = a.close_date || '';
      const bd = b.close_date || '';
      if (ad !== bd) return ad < bd ? -1 : 1;
      return Number(a.id) - Number(b.id);
    });
    const agentId = group[0]?.agent_id;
    const settings = getTemplateSettingsForAgentId(db, agentId);
    const run = computeYearCommissions(group, 0, settings);
    results.push(...run.results);
    capPaid += run.capPaid;
    riskPaid += run.riskPaid;
    cappedFeesPaid += run.cappedFeesPaid;
    singleSettings = settings;
    agentCount += 1;
  }

  results.sort((a, b) => {
    const ad = a.close_date || '';
    const bd = b.close_date || '';
    if (ad !== bd) return ad < bd ? -1 : 1;
    return Number(a.id) - Number(b.id);
  });

  return {
    results,
    capPaid: Math.round(capPaid * 100) / 100,
    riskPaid: Math.round(riskPaid * 100) / 100,
    cappedFeesPaid: Math.round(cappedFeesPaid * 100) / 100,
    settings: agentCount === 1 ? singleSettings : null,
    multiAgent: agentCount > 1,
  };
}

/** Pipeline continues each agent's closed YTD separately. */
function computePipelineByAgent(pendingDeals, closedByAgentYtd) {
  const groups = new Map();
  for (const deal of pendingDeals) {
    const key = deal.agent_id != null ? String(deal.agent_id) : 'none';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(deal);
  }

  const results = [];
  let capPaid = 0;
  let riskPaid = 0;
  let cappedFeesPaid = 0;
  let singleSettings = null;
  let agentCount = 0;

  for (const [agentKey, group] of groups) {
    group.sort((a, b) => {
      const ad = a.close_date || '';
      const bd = b.close_date || '';
      if (ad !== bd) return ad < bd ? -1 : 1;
      return Number(a.id) - Number(b.id);
    });
    const agentId = group[0]?.agent_id;
    const settings = getTemplateSettingsForAgentId(db, agentId);
    const ytd = closedByAgentYtd.get(agentKey) || { capPaid: 0, riskPaid: 0, cappedFeesPaid: 0 };
    const run = computeYearCommissions(group, ytd, settings);
    results.push(...run.results);
    capPaid += run.capPaid;
    riskPaid += run.riskPaid;
    cappedFeesPaid += run.cappedFeesPaid;
    singleSettings = settings;
    agentCount += 1;
  }

  results.sort((a, b) => {
    const ad = a.close_date || '';
    const bd = b.close_date || '';
    if (ad !== bd) return ad < bd ? -1 : 1;
    return Number(a.id) - Number(b.id);
  });

  return {
    results,
    capPaid: Math.round(capPaid * 100) / 100,
    riskPaid: Math.round(riskPaid * 100) / 100,
    cappedFeesPaid: Math.round(cappedFeesPaid * 100) / 100,
    settings: agentCount === 1 ? singleSettings : null,
    multiAgent: agentCount > 1,
  };
}

function closedYtdByAgent(deals) {
  const map = new Map();
  const groups = new Map();
  for (const deal of deals) {
    const key = deal.agent_id != null ? String(deal.agent_id) : 'none';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(deal);
  }
  for (const [key, group] of groups) {
    const settings = getTemplateSettingsForAgentId(db, group[0]?.agent_id);
    const run = computeYearCommissions(group, 0, settings);
    map.set(key, {
      capPaid: run.capPaid,
      riskPaid: run.riskPaid,
      cappedFeesPaid: run.cappedFeesPaid,
    });
  }
  return map;
}

router.get('/templates', (_req, res) => {
  res.json({ templates: listTemplates(db) });
});

router.put('/templates/:agentKey', (req, res) => {
  const agentKey = String(req.params.agentKey || '').toLowerCase();
  if (!TEMPLATE_AGENT_KEYS.includes(agentKey)) {
    return res.status(400).json({ error: 'Invalid agent_key' });
  }
  try {
    const settings = saveTemplateSettings(db, agentKey, req.body?.settings ?? req.body, req.user?.id ?? null);
    res.json({
      agent_key: agentKey,
      label: TEMPLATE_AGENT_LABELS[agentKey],
      settings,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not save template' });
  }
});

router.get('/', (req, res) => {
  const year = Math.min(2100, Math.max(2000, parseInt(req.query.year, 10) || new Date().getFullYear()));
  const { start: yearStart, end: yearEnd } = anniversaryWindowForEndYear(year);
  const agentScope = parseAgentScope(req.query);
  const { sql: agentFilter, params: agentParams } = transactionAgentScopeClause(agentScope, 't');

  const closedDeals = db.prepare(`
    ${DEAL_SELECT}
    WHERE t.stage = 'closed'
      AND t.close_date >= ? AND t.close_date <= ?
      ${agentFilter}
    ORDER BY t.close_date ASC, t.id ASC
  `).all(yearStart, yearEnd, ...agentParams);

  const closed = computeByAgentTemplates(closedDeals);
  const closedYtdMap = closedYtdByAgent(closedDeals);

  const pendingDeals = db.prepare(`
    ${DEAL_SELECT}
    WHERE t.stage = 'pending' AND t.close_date IS NOT NULL
      AND t.close_date >= ? AND t.close_date <= ?
      ${agentFilter}
    ORDER BY t.close_date ASC, t.id ASC
  `).all(yearStart, yearEnd, ...agentParams);

  const pipeline = computePipelineByAgent(pendingDeals, closedYtdMap);

  const sum = (rows, fn) => Math.round(rows.reduce((acc, r) => acc + (r.hasGci ? fn(r.breakdown) : 0), 0) * 100) / 100;

  const scopeUserId = agentScopeUserId(agentScope);
  const scopeAgentKey = scopeUserId != null ? agentKeyFromUserId(db, scopeUserId) : null;
  const settings = scopeAgentKey
    ? getTemplateSettings(db, scopeAgentKey)
    : (closed.settings || getTemplateSettings(db, 'meredith'));
  const multiAgent = agentScope === 'all' || closed.multiAgent;
  const agentLabel = scopeAgentKey
    ? TEMPLATE_AGENT_LABELS[scopeAgentKey]
    : (agentScope === 'all' ? 'All agents' : 'Agent');

  const summary = {
    year,
    anniversaryStart: yearStart,
    anniversaryEnd: yearEnd,
    agent_key: scopeAgentKey,
    agent_label: agentLabel,
    multi_agent: multiAgent,
    closedCount: closedDeals.length,
    closedVolume: closedDeals.reduce((acc, d) => acc + (Number(d.value) || 0), 0),
    gci: sum(closed.results, (b) => b.gci),
    net: sum(closed.results, (b) => b.net),
    expSplit: sum(closed.results, (b) => b.expSplit),
    tessa: sum(closed.results, (b) => b.tessa),
    margaret: sum(closed.results, (b) => b.margaret),
    fees: sum(closed.results, (b) => b.fixedFees + (b.customSum || 0)),
    missingGci: closed.results.filter((r) => !r.hasGci).length,
    capPaid: multiAgent ? null : closed.capPaid,
    riskPaid: multiAgent ? null : closed.riskPaid,
    cappedFeesPaid: multiAgent ? null : closed.cappedFeesPaid,
    capAmount: multiAgent ? null : settings.capAmount,
    riskCap: multiAgent ? null : settings.riskManagementAnnualCap,
    cappedFeesStepDownAt: multiAgent ? null : settings.cappedFeesStepDownAt,
    capped: multiAgent ? false : closed.capPaid >= settings.capAmount,
    settings,
    pipelineGci: sum(pipeline.results, (b) => b.gci),
    pipelineNet: sum(pipeline.results, (b) => b.net),
    pipelineCount: pendingDeals.length,
  };

  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, gci: 0, net: 0, count: 0 }));
  for (const r of closed.results) {
    if (!r.hasGci || !r.close_date) continue;
    const m = Number(String(r.close_date).slice(5, 7));
    if (m >= 1 && m <= 12) {
      monthly[m - 1].gci = Math.round((monthly[m - 1].gci + r.breakdown.gci) * 100) / 100;
      monthly[m - 1].net = Math.round((monthly[m - 1].net + r.breakdown.net) * 100) / 100;
      monthly[m - 1].count += 1;
    }
  }

  const currentYear = new Date().getFullYear();
  const years = db.prepare(`
    SELECT DISTINCT CAST(strftime('%Y', close_date) AS INTEGER) as y
    FROM transactions
    WHERE stage = 'closed' AND close_date IS NOT NULL
    ORDER BY y DESC
  `).all().map((r) => r.y).filter(Boolean);
  if (!years.includes(currentYear)) years.unshift(currentYear);
  if (!years.includes(year)) {
    years.push(year);
    years.sort((a, b) => b - a);
  }

  res.json({
    summary,
    deals: closed.results,
    pipeline: pipeline.results,
    monthly,
    years,
  });
});

/** Set GCI on a deal straight from the revenue page. */
router.patch('/deals/:id/gci', (req, res) => {
  const tx = db.prepare('SELECT id FROM transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Not found' });

  const raw = req.body.gross_commission;
  const value = raw === null || raw === '' || raw === undefined ? null : Number(raw);
  if (value !== null && (Number.isNaN(value) || value < 0)) {
    return res.status(400).json({ error: 'gross_commission must be a non-negative number' });
  }

  db.prepare('UPDATE transactions SET gross_commission = ? WHERE id = ?').run(value, req.params.id);
  res.json({ ok: true, gross_commission: value });
});

export default router;
