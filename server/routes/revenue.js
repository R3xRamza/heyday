import { Router } from 'express';
import db from '../db.js';
import { COMMISSION_SETTINGS, computeYearCommissions } from '../lib/commissionPlans.js';
import { parseAgentScope, transactionAgentScopeClause } from '../lib/agentScope.js';

const router = Router();

const DEAL_SELECT = `
  SELECT t.id, t.address, t.city, t.state, t.value, t.stage, t.representing,
    t.close_date, t.gross_commission, t.client_name, u.name as agent_name
  FROM transactions t
  LEFT JOIN users u ON u.id = t.agent_id
`;

router.get('/', (req, res) => {
  const year = Math.min(2100, Math.max(2000, parseInt(req.query.year, 10) || new Date().getFullYear()));
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const agentScope = parseAgentScope(req.query);
  const { sql: agentFilter, params: agentParams } = transactionAgentScopeClause(agentScope, 't');

  const closedDeals = db.prepare(`
    ${DEAL_SELECT}
    WHERE t.stage = 'closed'
      AND t.close_date >= ? AND t.close_date <= ?
      ${agentFilter}
    ORDER BY t.close_date ASC, t.id ASC
  `).all(yearStart, yearEnd, ...agentParams);

  const closed = computeYearCommissions(closedDeals, 0);

  // Pipeline: under contract, projected with the cap where the closed year left off.
  const pendingDeals = db.prepare(`
    ${DEAL_SELECT}
    WHERE t.stage = 'pending' AND t.close_date IS NOT NULL
      ${agentFilter}
    ORDER BY t.close_date ASC, t.id ASC
  `).all(...agentParams);

  const currentYear = new Date().getFullYear();
  const pipelineCapStart = year === currentYear ? closed.capPaid : 0;
  const pipeline = computeYearCommissions(pendingDeals, pipelineCapStart);

  const sum = (rows, fn) => Math.round(rows.reduce((acc, r) => acc + (r.hasGci ? fn(r.breakdown) : 0), 0) * 100) / 100;

  const summary = {
    year,
    closedCount: closedDeals.length,
    closedVolume: closedDeals.reduce((acc, d) => acc + (Number(d.value) || 0), 0),
    gci: sum(closed.results, (b) => b.gci),
    net: sum(closed.results, (b) => b.net),
    expSplit: sum(closed.results, (b) => b.expSplit),
    tessa: sum(closed.results, (b) => b.tessa),
    margaret: sum(closed.results, (b) => b.margaret),
    fees: sum(closed.results, (b) => b.fixedFees),
    missingGci: closed.results.filter((r) => !r.hasGci).length,
    capPaid: closed.capPaid,
    capAmount: COMMISSION_SETTINGS.capAmount,
    capped: closed.capPaid >= COMMISSION_SETTINGS.capAmount,
    pipelineGci: sum(pipeline.results, (b) => b.gci),
    pipelineNet: sum(pipeline.results, (b) => b.net),
    pipelineCount: pendingDeals.length,
  };

  // Net + GCI by close month for the earnings chart.
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
