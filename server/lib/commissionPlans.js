/**
 * eXp commission plans (anniversary year: Dec 1 → Nov 30).
 *
 * Settings use dynamic feeLines[] + teamSplits[]; legacy flat fields migrate on read.
 */

export function round2(n) {
  return Math.round(n * 100) / 100;
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Default eXp fee lines (Meredith + other seeded agents). */
export const DEFAULT_FEE_LINES = [
  {
    id: 'broker_review',
    label: 'eXp Broker Review Fee',
    amount: 25,
    unit: 'amount',
    apply: 'always',
    annualCap: null,
    stepDownAt: null,
    reducedAmount: null,
  },
  {
    id: 'risk_mgmt',
    label: 'eXp Risk Management Fee',
    amount: 60,
    unit: 'amount',
    apply: 'always',
    annualCap: 750,
    stepDownAt: null,
    reducedAmount: null,
  },
  {
    id: 'capped_trans',
    label: 'Capped Trans Fee',
    amount: 250,
    unit: 'amount',
    apply: 'after_cap',
    annualCap: null,
    stepDownAt: 5000,
    reducedAmount: 75,
  },
];

export const DEFAULT_TEAM_SPLITS_MEREDITH = [
  { id: 'split_tessa', label: 'Tessa', userId: null, rate: 0.04 },
  { id: 'split_margaret', label: 'Margaret', userId: null, rate: 0.03 },
];

/** Canonical default settings (Meredith-shaped). */
export const COMMISSION_SETTINGS = {
  capAmount: 16000,
  splitRate: 0.2,
  feeLines: DEFAULT_FEE_LINES.map((f) => ({ ...f })),
  teamSplits: DEFAULT_TEAM_SPLITS_MEREDITH.map((s) => ({ ...s })),
};

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

/** Anniversary year that ends Nov 30 of `endYear`. */
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

/** Deal-level dollar overrides for plan fee lines (keys like exp_split, fee_*, split_*). */
export function parseFeeAmounts(raw) {
  if (raw == null || raw === '') return {};
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === '' || value === undefined) continue;
    const n = Number(value);
    if (Number.isNaN(n) || n < 0) continue;
    out[String(key)] = round2(n);
  }
  return out;
}

export function serializeFeeAmounts(amounts) {
  return JSON.stringify(parseFeeAmounts(amounts));
}

/** Resolve a custom fee to dollars. Percent fees are of GCI. */
export function customFeeDollars(fee, gci) {
  const n = Math.max(0, Number(fee?.amount) || 0);
  if (fee?.unit === 'percent') {
    return round2((Number(gci) || 0) * n / 100);
  }
  return round2(n);
}

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

function num(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? x : fallback;
}

function asRate(v, fallback = 0) {
  let x = Number(v);
  if (!Number.isFinite(x) || x < 0) return fallback;
  if (x > 1) x /= 100;
  return Math.min(1, x);
}

/** Convert legacy flat settings → feeLines/teamSplits. */
export function migrateLegacyCommissionSettings(raw = {}) {
  if (Array.isArray(raw.feeLines) || Array.isArray(raw.teamSplits)) {
    return raw;
  }
  const feeLines = [
    {
      id: 'broker_review',
      label: 'eXp Broker Review Fee',
      amount: num(raw.brokerReviewFee, 25),
      unit: 'amount',
      apply: 'always',
      annualCap: null,
      stepDownAt: null,
      reducedAmount: null,
    },
    {
      id: 'risk_mgmt',
      label: 'eXp Risk Management Fee',
      amount: num(raw.riskManagementFee, 60),
      unit: 'amount',
      apply: 'always',
      annualCap: num(raw.riskManagementAnnualCap, 750),
      stepDownAt: null,
      reducedAmount: null,
    },
    {
      id: 'capped_trans',
      label: 'Capped Trans Fee',
      amount: num(raw.cappedTransactionFee, 250),
      unit: 'amount',
      apply: 'after_cap',
      annualCap: null,
      stepDownAt: num(raw.cappedFeesStepDownAt, 5000),
      reducedAmount: num(raw.cappedTransactionFeeReduced, 75),
    },
  ];
  const teamSplits = [];
  const tessa = asRate(raw.tessaRate, 0);
  const margaret = asRate(raw.margaretRate, 0);
  if (tessa > 0) {
    teamSplits.push({ id: 'split_tessa', label: 'Tessa', userId: null, rate: tessa });
  }
  if (margaret > 0) {
    teamSplits.push({ id: 'split_margaret', label: 'Margaret', userId: null, rate: margaret });
  }
  return {
    capAmount: num(raw.capAmount, 16000),
    splitRate: asRate(raw.splitRate, 0.2),
    feeLines,
    teamSplits,
  };
}

function normalizeFeeLine(f, i) {
  const apply = ['always', 'before_cap', 'after_cap'].includes(f?.apply) ? f.apply : 'always';
  const unit = f?.unit === 'percent' ? 'percent' : 'amount';
  let amount = num(f?.amount, 0);
  if (unit === 'percent' && amount > 1 && amount <= 100) {
    // stored as percent points in UI for fee % of GCI — keep as points (0–100)
  }
  const annualCap = f?.annualCap == null || f.annualCap === '' ? null : num(f.annualCap, 0);
  const stepDownAt = f?.stepDownAt == null || f.stepDownAt === '' ? null : num(f.stepDownAt, 0);
  const reducedAmount = f?.reducedAmount == null || f.reducedAmount === ''
    ? null
    : num(f.reducedAmount, 0);
  return {
    id: f?.id != null ? String(f.id) : newId(`fee${i}`),
    label: String(f?.label ?? '').trim() || `Fee ${i + 1}`,
    amount: round2(amount),
    unit,
    apply,
    annualCap: annualCap != null ? round2(annualCap) : null,
    stepDownAt: stepDownAt != null ? round2(stepDownAt) : null,
    reducedAmount: reducedAmount != null ? round2(reducedAmount) : null,
  };
}

function normalizeTeamSplit(s, i) {
  return {
    id: s?.id != null ? String(s.id) : newId(`split${i}`),
    label: String(s?.label ?? '').trim() || `Split ${i + 1}`,
    userId: s?.userId != null && s.userId !== '' ? Number(s.userId) : null,
    rate: asRate(s?.rate, 0),
  };
}

/** Normalize settings to feeLines/teamSplits shape + progress aliases. */
export function normalizeCommissionSettings(raw = {}) {
  const migrated = migrateLegacyCommissionSettings(raw || {});
  let splitRate = asRate(migrated.splitRate, COMMISSION_SETTINGS.splitRate);
  const feeLines = Array.isArray(migrated.feeLines)
    ? migrated.feeLines.map(normalizeFeeLine)
    : DEFAULT_FEE_LINES.map((f) => ({ ...f }));
  const teamSplits = Array.isArray(migrated.teamSplits)
    ? migrated.teamSplits.map(normalizeTeamSplit)
    : [];

  const settings = {
    capAmount: round2(num(migrated.capAmount, COMMISSION_SETTINGS.capAmount)),
    splitRate,
    feeLines,
    teamSplits,
  };

  // Progress / summary aliases derived from known fee lines
  const risk = feeLines.find((f) => f.id === 'risk_mgmt') || feeLines.find((f) => f.annualCap != null);
  const capped = feeLines.find((f) => f.id === 'capped_trans') || feeLines.find((f) => f.stepDownAt != null);
  settings.riskManagementAnnualCap = risk?.annualCap ?? null;
  settings.cappedFeesStepDownAt = capped?.stepDownAt ?? null;
  settings.cappedTransactionFee = capped?.amount ?? null;
  settings.cappedTransactionFeeReduced = capped?.reducedAmount ?? capped?.amount ?? null;
  settings.brokerReviewFee = feeLines.find((f) => f.id === 'broker_review')?.amount ?? null;
  settings.riskManagementFee = risk?.amount ?? null;
  // Legacy team rate aliases (first matching labels)
  const tessa = teamSplits.find((s) => /tessa/i.test(s.label));
  const margaret = teamSplits.find((s) => /margaret/i.test(s.label));
  settings.tessaRate = tessa?.rate ?? 0;
  settings.margaretRate = margaret?.rate ?? 0;

  return settings;
}

/** Progress meta for UI bars. */
export function settingsProgressMeta(settings) {
  const s = normalizeCommissionSettings(settings);
  return {
    capAmount: s.capAmount,
    riskCap: s.riskManagementAnnualCap,
    cappedFeesStepDownAt: s.cappedFeesStepDownAt,
    cappedTransactionFee: s.cappedTransactionFee,
    cappedTransactionFeeReduced: s.cappedTransactionFeeReduced,
  };
}

function normalizeYtd(startingYtd = {}) {
  if (typeof startingYtd === 'number') {
    return { capPaid: startingYtd, riskPaid: 0, cappedFeesPaid: 0, feePaid: {} };
  }
  const feePaid = startingYtd.feePaid && typeof startingYtd.feePaid === 'object'
    ? { ...startingYtd.feePaid }
    : {};
  // Backfill known trackers into feePaid
  if (startingYtd.riskPaid != null && feePaid.risk_mgmt == null) {
    feePaid.risk_mgmt = Number(startingYtd.riskPaid) || 0;
  }
  if (startingYtd.cappedFeesPaid != null && feePaid.capped_trans == null) {
    feePaid.capped_trans = Number(startingYtd.cappedFeesPaid) || 0;
  }
  return {
    capPaid: Number(startingYtd.capPaid) || 0,
    riskPaid: Number(startingYtd.riskPaid) || 0,
    cappedFeesPaid: Number(startingYtd.cappedFeesPaid) || 0,
    feePaid,
  };
}

function feeLineDollars(fee, gciN, postSplit, paidBefore) {
  let base;
  if (fee.unit === 'percent') {
    // percent of GCI (same as deal custom fees)
    base = round2(gciN * (fee.amount / 100));
  } else {
    base = round2(fee.amount);
  }

  if (fee.stepDownAt != null && fee.reducedAmount != null && paidBefore >= fee.stepDownAt) {
    if (fee.unit === 'percent') {
      base = round2(gciN * (fee.reducedAmount / 100));
    } else {
      base = round2(fee.reducedAmount);
    }
  }

  if (fee.annualCap != null) {
    const room = Math.max(0, round2(fee.annualCap - paidBefore));
    base = round2(Math.min(base, room));
  }

  return base;
}

/**
 * Compute one deal's commission breakdown.
 * Set overrides.applyPlanFees = false to skip eXp/team template fees.
 */
export function computeDealCommission(gci, startingYtd = {}, overrides = {}, rawSettings = COMMISSION_SETTINGS) {
  const settings = normalizeCommissionSettings(rawSettings);
  const applyPlanFees = overrides.applyPlanFees !== false;
  const ytd = normalizeYtd(startingYtd);
  const capPaidBefore = applyPlanFees ? ytd.capPaid : 0;

  const customFees = parseCustomFees(overrides.customFees);
  const gciN = round2(Number(gci) || 0);
  const resolvedCustom = customFees.map((fee) => ({
    ...fee,
    dollars: customFeeDollars(fee, gciN),
  }));
  const referralCustom = resolvedCustom.filter((fee) => /referral/i.test(String(fee.label || '')));
  const nonReferralCustom = resolvedCustom.filter((fee) => !/referral/i.test(String(fee.label || '')));
  const referralFee = round2(referralCustom.reduce((sum, f) => sum + f.dollars, 0));
  const nonReferralCustomSum = round2(nonReferralCustom.reduce((sum, f) => sum + f.dollars, 0));
  const customSum = round2(referralFee + nonReferralCustomSum);
  // Referral fee comes off the top before split/fees/team calculations.
  const commissionBase = round2(Math.max(0, gciN - referralFee));

  if (!applyPlanFees) {
    const lines = [];
    for (const fee of [...referralCustom, ...nonReferralCustom]) {
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
      referralFee,
      commissionBase,
      expSplit: 0,
      postSplit: commissionBase,
      riskFee: 0,
      brokerReview: 0,
      cappedFee: 0,
      tessa: 0,
      margaret: 0,
      customSum,
      fixedFees: 0,
      teamSplits: 0,
      teamSplitDetails: [],
      net: round2(commissionBase - nonReferralCustomSum),
      capPaidAfter: 0,
      riskPaidAfter: 0,
      cappedFeesPaidAfter: 0,
      feePaidAfter: {},
      lines,
      expFeeLines: [],
      teamSplitLines: [],
      customLines: lines,
      expFeesTotal: 0,
    };
  }

  const capRemaining = Math.max(0, round2(settings.capAmount - capPaidBefore));
  const beforeCap = capRemaining > 0;
  const expSplit = beforeCap ? Math.min(round2(commissionBase * settings.splitRate), capRemaining) : 0;
  const postSplit = round2(commissionBase - expSplit);
  const splitPct = round2(settings.splitRate * 100);

  const lines = [];
  for (const fee of referralCustom) {
    if (!fee.label && !(fee.dollars > 0)) continue;
    const pctLabel = fee.unit === 'percent' ? ` (${fee.amount}%)` : '';
    lines.push({
      key: `custom_${fee.id}`,
      label: `${fee.label || 'Custom fee'}${pctLabel}`,
      amount: -fee.dollars,
    });
  }
  lines.push({
    key: 'exp_split',
    label: beforeCap
      ? `eXp split (${splitPct}% sliding scale)`
      : 'eXp split (capped)',
    amount: -expSplit,
  });

  const feePaidAfter = { ...ytd.feePaid };
  let fixedFees = 0;
  let riskFee = 0;
  let brokerReview = 0;
  let cappedFee = 0;

  for (const fee of settings.feeLines) {
    const applies = fee.apply === 'always'
      || (fee.apply === 'before_cap' && beforeCap)
      || (fee.apply === 'after_cap' && !beforeCap);
    if (!applies) continue;

    const paidBefore = Number(feePaidAfter[fee.id]) || 0;
    const dollars = feeLineDollars(fee, commissionBase, postSplit, paidBefore);
    if (!(dollars > 0) && !fee.label) continue;

    feePaidAfter[fee.id] = round2(paidBefore + dollars);
    fixedFees = round2(fixedFees + dollars);

    if (fee.id === 'risk_mgmt') riskFee = dollars;
    if (fee.id === 'broker_review') brokerReview = dollars;
    if (fee.id === 'capped_trans') cappedFee = dollars;

    let label = fee.label || 'Fee';
    if (fee.stepDownAt != null && fee.reducedAmount != null && paidBefore >= fee.stepDownAt) {
      label = `${label} (reduced)`;
    }
    if (fee.unit === 'percent') {
      label = `${label} (${fee.amount}%)`;
    }
    lines.push({
      key: `fee_${fee.id}`,
      label,
      amount: -dollars,
    });
  }

  const teamSplitDetails = [];
  let teamSplitsTotal = 0;
  let tessa = 0;
  let margaret = 0;
  for (const split of settings.teamSplits) {
    const amount = round2(postSplit * split.rate);
    teamSplitsTotal = round2(teamSplitsTotal + amount);
    const pct = round2(split.rate * 100);
    const userId = split.userId != null && split.userId !== '' ? Number(split.userId) : null;
    teamSplitDetails.push({
      id: split.id,
      label: split.label,
      userId: Number.isFinite(userId) ? userId : null,
      rate: split.rate,
      amount,
    });
    if (/tessa/i.test(split.label)) tessa = amount;
    if (/margaret/i.test(split.label)) margaret = amount;
    lines.push({
      key: `split_${split.id}`,
      label: `${split.label} ${pct}%`,
      amount: -amount,
    });
  }

  for (const fee of nonReferralCustom) {
    if (!fee.label && !(fee.dollars > 0)) continue;
    const pctLabel = fee.unit === 'percent' ? ` (${fee.amount}%)` : '';
    lines.push({
      key: `custom_${fee.id}`,
      label: `${fee.label || 'Custom fee'}${pctLabel}`,
      amount: -fee.dollars,
    });
  }

  // Deal-level amount overrides (positive dollars → deducted as negative lines)
  const feeAmounts = parseFeeAmounts(overrides.feeAmounts);
  for (const line of lines) {
    if (String(line.key).startsWith('custom_')) continue;
    if (!(line.key in feeAmounts)) continue;
    line.amount = -feeAmounts[line.key];
    line.overridden = true;
  }

  // Recompute aggregates + YTD fee paid from (possibly overridden) lines
  let expSplitOut = 0;
  let fixedFeesOut = 0;
  let teamSplitsOut = 0;
  let tessaOut = 0;
  let margaretOut = 0;
  const teamSplitDetailsOut = [];
  const feePaidRecomputed = { ...ytd.feePaid };
  for (const line of lines) {
    const dollars = Math.abs(Number(line.amount) || 0);
    if (line.key === 'exp_split') {
      expSplitOut = dollars;
    } else if (String(line.key).startsWith('fee_')) {
      fixedFeesOut = round2(fixedFeesOut + dollars);
      const feeId = String(line.key).slice(4);
      const paidBefore = Number(ytd.feePaid[feeId]) || 0;
      feePaidRecomputed[feeId] = round2(paidBefore + dollars);
      if (line.key === 'fee_risk_mgmt') riskFee = dollars;
      if (line.key === 'fee_broker_review') brokerReview = dollars;
      if (line.key === 'fee_capped_trans') cappedFee = dollars;
    } else if (String(line.key).startsWith('split_')) {
      teamSplitsOut = round2(teamSplitsOut + dollars);
      const detail = teamSplitDetails.find((d) => `split_${d.id}` === line.key);
      if (detail) {
        teamSplitDetailsOut.push({ ...detail, amount: dollars });
        if (/tessa/i.test(detail.label)) tessaOut = dollars;
        if (/margaret/i.test(detail.label)) margaretOut = dollars;
      }
    }
  }
  Object.assign(feePaidAfter, feePaidRecomputed);

  const postSplitOut = round2(commissionBase - expSplitOut);
  const net = round2(postSplitOut - fixedFeesOut - teamSplitsOut - nonReferralCustomSum);
  const riskPaidAfter = round2(feePaidAfter.risk_mgmt || 0);
  const cappedFeesPaidAfter = round2(feePaidAfter.capped_trans || 0);

  const expFeeLines = lines.filter((l) => l.key === 'exp_split' || String(l.key).startsWith('fee_'));
  const teamSplitLines = lines.filter((l) => String(l.key).startsWith('split_'));
  const customLines = lines.filter((l) => String(l.key).startsWith('custom_'));
  const expFeesTotal = round2(expSplitOut + fixedFeesOut);

  return {
    plan: beforeCap ? 'before_cap' : 'after_cap',
    applyPlanFees: true,
    gci: gciN,
    referralFee,
    commissionBase,
    expSplit: expSplitOut,
    postSplit: postSplitOut,
    riskFee,
    brokerReview,
    cappedFee,
    tessa: tessaOut,
    margaret: margaretOut,
    customSum,
    fixedFees: fixedFeesOut,
    teamSplits: teamSplitsOut,
    teamSplitDetails: teamSplitDetailsOut.length ? teamSplitDetailsOut : teamSplitDetails,
    net,
    capPaidAfter: round2(capPaidBefore + expSplitOut),
    riskPaidAfter,
    cappedFeesPaidAfter,
    feePaidAfter,
    lines,
    expFeeLines,
    teamSplitLines,
    customLines,
    expFeesTotal,
  };
}

/**
 * Run deals (ordered by close date) through anniversary-year accumulators.
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
      feeAmounts: deal.commission_fee_overrides,
      applyPlanFees: !isReferral,
    };
    const breakdown = computeDealCommission(gci, ytd, overrides, settings);
    if (!isReferral) {
      ytd = {
        capPaid: breakdown.capPaidAfter,
        riskPaid: breakdown.riskPaidAfter,
        cappedFeesPaid: breakdown.cappedFeesPaidAfter,
        feePaid: breakdown.feePaidAfter || {},
      };
    }
    results.push({ ...deal, hasGci: true, breakdown });
  }

  return {
    results,
    capPaid: round2(ytd.capPaid),
    riskPaid: round2(ytd.riskPaid),
    cappedFeesPaid: round2(ytd.cappedFeesPaid),
    feePaid: { ...ytd.feePaid },
  };
}

/** Whether deal A sorts before deal B for YTD accumulation (close_date, then id). */
export function dealSortsBefore(a, b, dealDateForCurrent) {
  const aDate = a.close_date || '';
  const bDate = b.close_date || dealDateForCurrent || '';
  if (aDate !== bDate) return aDate < bDate;
  return Number(a.id) < Number(b.id);
}
