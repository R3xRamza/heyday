import { Router } from 'express';
import db from '../db.js';
import {
  computeYearCommissions,
  anniversaryWindowForEndYear,
  settingsProgressMeta,
  round2,
} from '../lib/commissionPlans.js';
import { parseAgentScope, agentScopeUserId } from '../lib/agentScope.js';
import {
  getTemplateSettings,
  getTemplateSettingsForAgentId,
  getTemplateMeta,
  listTemplates,
  saveTemplateSettings,
  createAgentTemplate,
  deleteAgentTemplate,
  TEMPLATE_AGENT_LABELS,
  agentKeyFromUserId,
} from '../lib/revenueTemplates.js';

const router = Router();

const DEAL_SELECT = `
  SELECT t.id, t.address, t.city, t.state, t.value, t.stage, t.representing, t.sale_type,
    t.close_date, t.gross_commission, t.commission_custom_fees, t.commission_fee_overrides, t.agent_id,
    t.client_name, u.name as agent_name
  FROM transactions t
  LEFT JOIN users u ON u.id = t.agent_id
`;

function splitMatchesRecipient(split, recipientUserId, recipientName) {
  if (recipientUserId == null) return false;
  if (split.userId != null && split.userId !== '') {
    return Number(split.userId) === Number(recipientUserId);
  }
  const label = String(split.label || '').trim().toLowerCase();
  const name = String(recipientName || '').trim().toLowerCase();
  return Boolean(label && name && label === name);
}

/** Pull incoming team-split credits for a recipient from computed source deals. */
function extractIncomingSplits(computedResults, recipientUserId, recipientName) {
  if (recipientUserId == null) return [];
  const rows = [];
  for (const deal of computedResults) {
    if (!deal.hasGci || !deal.breakdown?.teamSplitDetails?.length) continue;
    // Don't credit someone for splits on their own deal (already in their net as a deduction to another person)
    if (Number(deal.agent_id) === Number(recipientUserId)) continue;
    for (const split of deal.breakdown.teamSplitDetails) {
      if (!splitMatchesRecipient(split, recipientUserId, recipientName)) continue;
      const amount = round2(Number(split.amount) || 0);
      if (amount <= 0) continue;
      rows.push({
        transaction_id: deal.id,
        address: deal.address,
        city: deal.city,
        state: deal.state,
        close_date: deal.close_date,
        value: deal.value,
        client_name: deal.client_name,
        source_agent_id: deal.agent_id,
        source_agent_name: deal.agent_name,
        split_id: split.id,
        split_label: split.label,
        split_rate: split.rate,
        amount,
        stage: deal.stage,
      });
    }
  }
  rows.sort((a, b) => {
    const ad = a.close_date || '';
    const bd = b.close_date || '';
    if (ad !== bd) return ad < bd ? -1 : 1;
    return Number(a.transaction_id) - Number(b.transaction_id);
  });
  return rows;
}

function sumIncoming(rows) {
  return round2(rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0));
}

function ytdTotalsForAgent(deals, agentId) {
  const group = deals
    .filter((d) => Number(d.agent_id) === Number(agentId))
    .sort((a, b) => {
      const ad = a.close_date || '';
      const bd = b.close_date || '';
      if (ad !== bd) return ad < bd ? -1 : 1;
      return Number(a.id) - Number(b.id);
    });
  const settings = getTemplateSettingsForAgentId(db, agentId);
  const run = computeYearCommissions(group, 0, settings);
  return {
    capPaid: run.capPaid,
    riskPaid: run.riskPaid,
    cappedFeesPaid: run.cappedFeesPaid,
    settings,
  };
}

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

router.post('/templates', (req, res) => {
  try {
    const created = createAgentTemplate(db, {
      userId: req.body?.user_id,
      label: req.body?.label,
      agentKey: req.body?.agent_key,
    }, req.user?.id ?? null);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not create template' });
  }
});

router.put('/templates/:agentKey', (req, res) => {
  const agentKey = String(req.params.agentKey || '').toLowerCase();
  try {
    const settings = saveTemplateSettings(db, agentKey, req.body?.settings ?? req.body, req.user?.id ?? null);
    const meta = getTemplateMeta(db, agentKey);
    res.json({
      agent_key: agentKey,
      label: meta.label,
      user_id: meta.user_id,
      seeded: meta.seeded,
      settings,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not save template' });
  }
});

router.delete('/templates/:agentKey', (req, res) => {
  const agentKey = String(req.params.agentKey || '').toLowerCase();
  try {
    deleteAgentTemplate(db, agentKey);
    res.json({ ok: true });
  } catch (err) {
    const status = err.message === 'Not found' ? 404 : 400;
    res.status(status).json({ error: err.message || 'Could not delete template' });
  }
});

router.get('/', (req, res) => {
  const year = Math.min(2100, Math.max(2000, parseInt(req.query.year, 10) || new Date().getFullYear()));
  const { start: yearStart, end: yearEnd } = anniversaryWindowForEndYear(year);
  const agentScope = parseAgentScope(req.query);
  const scopeUserId = agentScopeUserId(agentScope);

  // Full anniversary ledger (all agents) so recipient splits can be attributed.
  const allClosedDeals = db.prepare(`
    ${DEAL_SELECT}
    WHERE t.stage = 'closed'
      AND t.close_date >= ? AND t.close_date <= ?
    ORDER BY t.close_date ASC, t.id ASC
  `).all(yearStart, yearEnd);

  const allClosed = computeByAgentTemplates(allClosedDeals);
  const closedYtdMap = closedYtdByAgent(allClosedDeals);

  const allPendingDeals = db.prepare(`
    ${DEAL_SELECT}
    WHERE t.stage = 'pending' AND t.close_date IS NOT NULL
      AND t.close_date >= ? AND t.close_date <= ?
    ORDER BY t.close_date ASC, t.id ASC
  `).all(yearStart, yearEnd);

  const allPipeline = computePipelineByAgent(allPendingDeals, closedYtdMap);

  const closedResults = scopeUserId != null
    ? allClosed.results.filter((d) => Number(d.agent_id) === Number(scopeUserId))
    : allClosed.results;
  const pipelineResults = scopeUserId != null
    ? allPipeline.results.filter((d) => Number(d.agent_id) === Number(scopeUserId))
    : allPipeline.results;

  const recipientName = scopeUserId != null
    ? (db.prepare('SELECT name FROM users WHERE id = ?').get(scopeUserId)?.name || null)
    : null;

  // Incoming team-split income only for a single person (All would double-count).
  const incomingSplits = scopeUserId != null
    ? extractIncomingSplits(allClosed.results, scopeUserId, recipientName)
    : [];
  const pipelineIncomingSplits = scopeUserId != null
    ? extractIncomingSplits(allPipeline.results, scopeUserId, recipientName)
    : [];

  const sum = (rows, fn) => round2(rows.reduce((acc, r) => acc + (r.hasGci ? fn(r.breakdown) : 0), 0));

  const scopeAgentKey = scopeUserId != null ? agentKeyFromUserId(db, scopeUserId) : null;
  const agentYtd = scopeUserId != null ? ytdTotalsForAgent(allClosedDeals, scopeUserId) : null;
  const settings = scopeAgentKey
    ? getTemplateSettings(db, scopeAgentKey)
    : (allClosed.settings || getTemplateSettings(db, 'meredith'));
  const progressMeta = settingsProgressMeta(settings);
  const multiAgent = agentScope === 'all' || (scopeUserId == null && allClosed.multiAgent);
  const agentLabel = scopeAgentKey
    ? (getTemplateMeta(db, scopeAgentKey).label)
    : (agentScope === 'all' ? 'All agents' : 'Agent');

  const directNet = sum(closedResults, (b) => b.net);
  const incomingTeamSplitIncome = sumIncoming(incomingSplits);
  const net = scopeUserId != null ? round2(directNet + incomingTeamSplitIncome) : directNet;

  const pipelineDirectNet = sum(pipelineResults, (b) => b.net);
  const pipelineIncomingTeamSplitIncome = sumIncoming(pipelineIncomingSplits);
  const pipelineNet = scopeUserId != null
    ? round2(pipelineDirectNet + pipelineIncomingTeamSplitIncome)
    : pipelineDirectNet;

  const closedVolume = closedResults.reduce((acc, d) => acc + (Number(d.value) || 0), 0);

  const summary = {
    year,
    anniversaryStart: yearStart,
    anniversaryEnd: yearEnd,
    agent_key: scopeAgentKey,
    agent_label: agentLabel,
    multi_agent: multiAgent,
    closedCount: closedResults.length,
    closedVolume,
    gci: sum(closedResults, (b) => b.gci),
    directNet,
    incomingTeamSplitIncome,
    net,
    expSplit: sum(closedResults, (b) => b.expSplit),
    tessa: sum(closedResults, (b) => b.tessa),
    margaret: sum(closedResults, (b) => b.margaret),
    teamSplits: sum(closedResults, (b) => b.teamSplits),
    fees: sum(closedResults, (b) => b.fixedFees + (b.customSum || 0)),
    missingGci: closedResults.filter((r) => !r.hasGci).length,
    capPaid: multiAgent ? null : (agentYtd?.capPaid ?? allClosed.capPaid),
    riskPaid: multiAgent ? null : (agentYtd?.riskPaid ?? allClosed.riskPaid),
    cappedFeesPaid: multiAgent ? null : (agentYtd?.cappedFeesPaid ?? allClosed.cappedFeesPaid),
    capAmount: multiAgent ? null : progressMeta.capAmount,
    riskCap: multiAgent ? null : progressMeta.riskCap,
    cappedFeesStepDownAt: multiAgent ? null : progressMeta.cappedFeesStepDownAt,
    capped: multiAgent ? false : (agentYtd?.capPaid ?? 0) >= (progressMeta.capAmount || 0),
    settings,
    pipelineGci: sum(pipelineResults, (b) => b.gci),
    pipelineDirectNet,
    pipelineIncomingTeamSplitIncome,
    pipelineNet,
    pipelineCount: pipelineResults.length,
    incomingSplitCount: incomingSplits.length,
    pipelineIncomingSplitCount: pipelineIncomingSplits.length,
  };

  const monthly = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    gci: 0,
    net: 0,
    directNet: 0,
    incomingSplit: 0,
    count: 0,
  }));
  for (const r of closedResults) {
    if (!r.hasGci || !r.close_date) continue;
    const m = Number(String(r.close_date).slice(5, 7));
    if (m >= 1 && m <= 12) {
      monthly[m - 1].gci = round2(monthly[m - 1].gci + r.breakdown.gci);
      monthly[m - 1].directNet = round2(monthly[m - 1].directNet + r.breakdown.net);
      monthly[m - 1].net = round2(monthly[m - 1].net + r.breakdown.net);
      monthly[m - 1].count += 1;
    }
  }
  for (const split of incomingSplits) {
    if (!split.close_date) continue;
    const m = Number(String(split.close_date).slice(5, 7));
    if (m >= 1 && m <= 12) {
      monthly[m - 1].incomingSplit = round2(monthly[m - 1].incomingSplit + split.amount);
      monthly[m - 1].net = round2(monthly[m - 1].net + split.amount);
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
    deals: closedResults,
    pipeline: pipelineResults,
    incomingSplits,
    pipelineIncomingSplits,
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
