/**
 * Meredith (MPA) eXp commission plans.
 *
 * Anniversary year: Dec 1 → Nov 30 (not calendar year).
 *
 * Before cap — paid by agent:
 *   eXp split (20% of GCI until $16,000 anniversary-year cap),
 *   eXp Broker Review Fee $25,
 *   eXp Risk Management Fee $60 (anniversary-year total capped at $750),
 *   Tessa 4% of post-split, Margaret 3% of post-split,
 *   editable custom fees.
 *
 * After cap — paid by agent:
 *   agent keeps 100% of GCI (no eXp split),
 *   Capped Trans Fee $250 until $5,000 capped fees paid in anniversary year, then $75,
 *   Broker Review $25, Risk Management (same annual ceiling),
 *   Tessa 4%, Margaret 3%, custom fees.
 */

export const COMMISSION_SETTINGS = {
  capAmount: 16000,
  splitRate: 0.2,
  brokerReviewFee: 25,
  riskManagementFee: 60,
  riskManagementAnnualCap: 750,
  cappedTransactionFee: 250,
  cappedTransactionFeeReduced: 75,
  cappedFeesStepDownAt: 5000,
  tessaRate: 0.04,
  margaretRate: 0.03,
};

export function round2(n) {
  return Math.round(n * 100) / 100;
}

function parseYmd(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, mo, d };
}

function todayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

/**
 * Anniversary window containing dateStr (YYYY-MM-DD).
 * Dec 1 of startYear → Nov 30 of startYear+1.
 * Missing/invalid date → today.
 */
export function anniversaryWindowForDate(dateStr) {
  const parsed = parseYmd(dateStr) || parseYmd(todayYmd());
  const startYear = parsed.mo === 12 ? parsed.y : parsed.y - 1;
  return {
    start: `${startYear}-12-01`,
    end: `${startYear + 1}-11-30`,
    startYear,
  };
}

/** Anniversary year that ends Nov 30 of `endYear` (e.g. 2026 → 2025-12-01 … 2026-11-30). */
export function anniversaryWindowForEndYear(endYear) {
  const y = Number(endYear);
  return {
    start: `${y - 1}-12-01`,
    end: `${y}-11-30`,
    startYear: y - 1,
  };
}

export function parseCustomFees(raw) {
  if (raw == null || raw === '') return [];
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((f, i) => ({
    id: f?.id != null ? String(f.id) : `fee_${i}`,
    label: String(f?.label ?? '').trim(),
    amount: Math.max(0, Number(f?.amount) || 0),
    unit: f?.unit === 'percent' ? 'percent' : 'amount',
  }));
}

export function serializeCustomFees(fees) {
  return JSON.stringify(parseCustomFees(fees));
}

/** Resolve a custom fee to dollars. Percent fees are of GCI. */
export function customFeeDollars(fee, gci) {
  const n = Math.max(0, Number(fee?.amount) || 0);
  if (fee?.unit === 'percent') {
    return round2((Number(gci) || 0) * n / 100);
  }
  return round2(n);
}

/**
 * Resolve stored GCI input to a dollar amount.
 * Percent mode = % of sales price (transaction.value).
 */
export function resolveGrossCommission({
  mode,
  grossCommission,
  gciPercent,
  salesPrice,
} = {}) {
  if (mode === 'percent') {
    const pct = gciPercent == null || gciPercent === '' ? null : Number(gciPercent);
    const price = salesPrice == null || salesPrice === '' ? null : Number(salesPrice);
    if (pct == null || Number.isNaN(pct) || pct < 0) return null;
    if (price == null || Number.isNaN(price) || price < 0) return null;
    return round2(price * pct / 100);
  }
  if (grossCommission == null || grossCommission === '') return null;
  const gci = Number(grossCommission);
  if (Number.isNaN(gci) || gci < 0) return null;
  return round2(gci);
}

export function normalizeGciMode(mode) {
  return mode === 'percent' ? 'percent' : 'amount';
}

function normalizeYtd(startingYtd = {}) {
  if (typeof startingYtd === 'number') {
    return { capPaid: startingYtd, riskPaid: 0, cappedFeesPaid: 0 };
  }
  return {
    capPaid: Number(startingYtd.capPaid) || 0,
    riskPaid: Number(startingYtd.riskPaid) || 0,
    cappedFeesPaid: Number(startingYtd.cappedFeesPaid) || 0,
  };
}

/**
 * Compute one deal's commission breakdown.
 * Sliding scale takes 20% of GCI to eXp, but never more than remaining cap room.
 * Set overrides.applyPlanFees = false for non-Meredith agents (no eXp / team fees).
 */
export function computeDealCommission(gci, startingYtd = {}, overrides = {}, settings = COMMISSION_SETTINGS) {
  const applyPlanFees = overrides.applyPlanFees !== false;
  const ytd = normalizeYtd(startingYtd);
  const capPaidBefore = applyPlanFees ? ytd.capPaid : 0;
  const riskPaidBefore = applyPlanFees ? ytd.riskPaid : 0;
  const cappedFeesPaidBefore = applyPlanFees ? ytd.cappedFeesPaid : 0;

  const customFees = parseCustomFees(overrides.customFees);
  const gciN = round2(Number(gci) || 0);
  const resolvedFees = customFees.map((fee) => ({
    ...fee,
    dollars: customFeeDollars(fee, gciN),
  }));
  const customSum = round2(resolvedFees.reduce((sum, f) => sum + f.dollars, 0));

  if (!applyPlanFees) {
    const lines = [];
    for (const fee of resolvedFees) {
      if (!fee.label && !(fee.dollars > 0)) continue;
      const pctLabel = fee.unit === 'percent' ? ` (${fee.amount}%)` : '';
      lines.push({
        key: `custom_${fee.id}`,
        label: `${fee.label || 'Custom fee'}${pctLabel}`,
        amount: -fee.dollars,
      });
    }
    return {
      plan: null,
      applyPlanFees: false,
      gci: gciN,
      expSplit: 0,
      postSplit: gciN,
      riskFee: 0,
      brokerReview: 0,
      cappedFee: 0,
      tessa: 0,
      margaret: 0,
      customSum,
      fixedFees: 0,
      teamSplits: 0,
      net: round2(gciN - customSum),
      capPaidAfter: 0,
      riskPaidAfter: 0,
      cappedFeesPaidAfter: 0,
      lines,
    };
  }

  const capRemaining = Math.max(0, round2(settings.capAmount - capPaidBefore));
  const beforeCap = capRemaining > 0;

  const expSplit = beforeCap ? Math.min(round2(gciN * settings.splitRate), capRemaining) : 0;
  const postSplit = round2(gciN - expSplit);

  const riskRoom = Math.max(0, round2(settings.riskManagementAnnualCap - riskPaidBefore));
  const riskFee = round2(Math.min(settings.riskManagementFee, riskRoom));
  const brokerReview = settings.brokerReviewFee;

  let cappedFee = 0;
  if (!beforeCap) {
    cappedFee = cappedFeesPaidBefore >= settings.cappedFeesStepDownAt
      ? settings.cappedTransactionFeeReduced
      : settings.cappedTransactionFee;
  }

  const tessa = round2(postSplit * settings.tessaRate);
  const margaret = round2(postSplit * settings.margaretRate);
  const teamSplits = round2(tessa + margaret);
  const fixedFees = round2(brokerReview + riskFee + cappedFee);
  const net = round2(postSplit - fixedFees - teamSplits - customSum);

  const lines = [
    {
      key: 'exp_split',
      label: beforeCap ? 'eXp split (sliding scale)' : 'eXp split (capped — 100% retained)',
      amount: -expSplit,
    },
  ];
  if (!beforeCap) {
    lines.push({
      key: 'capped_fee',
      label: cappedFee === settings.cappedTransactionFeeReduced
        ? 'Capped Trans Fee (reduced)'
        : 'Capped Trans Fee',
      amount: -cappedFee,
    });
  }
  lines.push(
    { key: 'broker_review', label: 'eXp Broker Review Fee', amount: -brokerReview },
    { key: 'risk_mgmt', label: 'eXp Risk Management Fee', amount: -riskFee },
    { key: 'tessa', label: 'Tessa 4% of post-split balance', amount: -tessa },
    { key: 'margaret', label: 'Margaret 3% of post-split balance', amount: -margaret },
  );
  for (const fee of resolvedFees) {
    if (!fee.label && !(fee.dollars > 0)) continue;
    const pctLabel = fee.unit === 'percent' ? ` (${fee.amount}%)` : '';
    lines.push({
      key: `custom_${fee.id}`,
      label: `${fee.label || 'Custom fee'}${pctLabel}`,
      amount: -fee.dollars,
    });
  }

  return {
    plan: beforeCap ? 'before_cap' : 'after_cap',
    applyPlanFees: true,
    gci: gciN,
    expSplit,
    postSplit,
    riskFee,
    brokerReview,
    cappedFee,
    tessa,
    margaret,
    customSum,
    fixedFees,
    teamSplits,
    net,
    capPaidAfter: round2(capPaidBefore + expSplit),
    riskPaidAfter: round2(riskPaidBefore + riskFee),
    cappedFeesPaidAfter: round2(cappedFeesPaidBefore + cappedFee),
    lines,
  };
}

/**
 * Run deals (ordered by close date) through anniversary-year accumulators.
 * Deals without a GCI are passed through flagged; they do not move totals.
 * `startingYtd` may be a number (legacy capPaid) or { capPaid, riskPaid, cappedFeesPaid }.
 */
export function computeYearCommissions(deals, startingYtd = 0, settings = COMMISSION_SETTINGS) {
  let ytd = normalizeYtd(startingYtd);
  const results = [];

  for (const deal of deals) {
    const gci = deal.gross_commission != null ? Number(deal.gross_commission) : null;
    if (gci == null || Number.isNaN(gci)) {
      results.push({ ...deal, hasGci: false, breakdown: null });
      continue;
    }
    const saleType = String(deal.sale_type || '').toLowerCase();
    const isReferral = saleType.includes('referral');
    const overrides = {
      customFees: deal.commission_custom_fees,
      applyPlanFees: !isReferral,
    };
    const breakdown = computeDealCommission(gci, ytd, overrides, settings);
    if (!isReferral) {
      ytd = {
        capPaid: breakdown.capPaidAfter,
        riskPaid: breakdown.riskPaidAfter,
        cappedFeesPaid: breakdown.cappedFeesPaidAfter,
      };
    }
    results.push({ ...deal, hasGci: true, breakdown });
  }

  return {
    results,
    capPaid: round2(ytd.capPaid),
    riskPaid: round2(ytd.riskPaid),
    cappedFeesPaid: round2(ytd.cappedFeesPaid),
  };
}

/** Whether deal A sorts before deal B for YTD accumulation (close_date, then id). */
export function dealSortsBefore(a, b, dealDateForCurrent) {
  const aDate = a.close_date || '';
  const bDate = b.close_date || dealDateForCurrent || '';
  if (aDate !== bDate) return aDate < bDate;
  return Number(a.id) < Number(b.id);
}
