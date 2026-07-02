/**
 * Meredith (MPA) eXp commission plans, mirrored from Brokermint.
 *
 * MPA eXp (before cap) — paid by agent:
 *   eXp split (sliding scale: 20% of GCI until the $16,000 annual cap),
 *   eXp Broker Review Fee $25, eXp Risk Management Fee $60,
 *   Tessa 4% of post-split balance, exp stock $0.
 *
 * MPA eXp (after cap) — paid by agent:
 *   agent keeps 100% of the balance, Capped Trans Fee $250,
 *   eXp Broker Review Fee $25, eXp Risk Management Fee $60,
 *   Tessa 4% of post-split balance, Margaret 3% of post-split balance,
 *   exp stock $0.
 */
export const COMMISSION_SETTINGS = {
  capAmount: 16000,
  splitRate: 0.2,
  brokerReviewFee: 25,
  riskManagementFee: 60,
  cappedTransactionFee: 250,
  tessaRate: 0.04,
  margaretRate: 0.03,
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Compute one deal's commission breakdown.
 * The sliding scale takes 20% of GCI to eXp, but never more than what is
 * left before the cap — a straddling deal only pays up to the cap.
 */
export function computeDealCommission(gci, capPaidBefore, settings = COMMISSION_SETTINGS) {
  const capRemaining = Math.max(0, round2(settings.capAmount - capPaidBefore));
  const beforeCap = capRemaining > 0;

  const expSplit = beforeCap ? Math.min(round2(gci * settings.splitRate), capRemaining) : 0;
  const postSplit = round2(gci - expSplit);
  const tessa = round2(postSplit * settings.tessaRate);
  const margaret = beforeCap ? 0 : round2(postSplit * settings.margaretRate);
  const cappedFee = beforeCap ? 0 : settings.cappedTransactionFee;
  const fixedFees = round2(settings.brokerReviewFee + settings.riskManagementFee + cappedFee);
  const teamSplits = round2(tessa + margaret);
  const net = round2(postSplit - fixedFees - teamSplits);

  const lines = beforeCap
    ? [
      { key: 'exp_split', label: 'eXp split (sliding scale)', amount: -expSplit },
      { key: 'broker_review', label: 'eXp Broker Review Fee', amount: -settings.brokerReviewFee },
      { key: 'risk_mgmt', label: 'eXp Risk Management Fee', amount: -settings.riskManagementFee },
      { key: 'tessa', label: 'Tessa 4% of post-split balance', amount: -tessa },
      { key: 'exp_stock', label: 'exp stock', amount: 0 },
    ]
    : [
      { key: 'exp_split', label: 'eXp split (capped — 100% retained)', amount: 0 },
      { key: 'capped_fee', label: 'Capped Trans Fee', amount: -settings.cappedTransactionFee },
      { key: 'broker_review', label: 'eXp Broker Review Fee', amount: -settings.brokerReviewFee },
      { key: 'risk_mgmt', label: 'eXp Risk Management Fee', amount: -settings.riskManagementFee },
      { key: 'tessa', label: 'Tessa 4% of post-split balance', amount: -tessa },
      { key: 'margaret', label: 'Margaret 3% of post-split balance', amount: -margaret },
      { key: 'exp_stock', label: 'exp stock', amount: 0 },
    ];

  return {
    plan: beforeCap ? 'before_cap' : 'after_cap',
    gci: round2(gci),
    expSplit,
    postSplit,
    tessa,
    margaret,
    fixedFees,
    teamSplits,
    net,
    capPaidAfter: round2(capPaidBefore + expSplit),
    lines,
  };
}

/**
 * Run deals (ordered by close date) through the cap accumulator.
 * Deals without a GCI are passed through flagged; they do not move the cap.
 */
export function computeYearCommissions(deals, startingCapPaid = 0, settings = COMMISSION_SETTINGS) {
  let capPaid = startingCapPaid;
  const results = [];

  for (const deal of deals) {
    const gci = deal.gross_commission != null ? Number(deal.gross_commission) : null;
    if (gci == null || Number.isNaN(gci)) {
      results.push({ ...deal, hasGci: false, breakdown: null });
      continue;
    }
    const breakdown = computeDealCommission(gci, capPaid, settings);
    capPaid = breakdown.capPaidAfter;
    results.push({ ...deal, hasGci: true, breakdown });
  }

  return { results, capPaid: round2(capPaid) };
}
