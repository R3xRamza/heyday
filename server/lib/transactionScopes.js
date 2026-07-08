/** Shared SQL scopes for transaction portfolio segments. */
import { transactionAgentScopeClause } from './agentScope.js';

export const LISTING_REPRESENTING = "representing IN ('seller','seller_and_buyer','landlord','both','seller_and_client','leasing')";

const LISTING_SIDE_OPEN = `${LISTING_REPRESENTING} AND stage != 'closed' AND acceptance_date IS NULL`;

const LISTING_DATE_LIVE = "COALESCE(listing_visibility, 'public') != 'coming_soon' AND listing_date IS NOT NULL AND listing_date <= date('now')";

/** Transactions Current Listings tab — includes under-contract listings still on the listing side. */
export const CURRENT_LISTINGS_VIEW_SCOPE = `${LISTING_SIDE_OPEN} AND ${LISTING_DATE_LIVE}`;

/** Team Hub Listings panel + on-market KPI — excludes pending / under contract. */
export const ON_MARKET_LISTINGS_SCOPE = `${CURRENT_LISTINGS_VIEW_SCOPE} AND stage != 'pending' AND close_date IS NULL`;

/** @deprecated Use CURRENT_LISTINGS_VIEW_SCOPE or ON_MARKET_LISTINGS_SCOPE */
export const ACTIVE_LISTINGS_SCOPE = CURRENT_LISTINGS_VIEW_SCOPE;

/** Coming soon: visibility flag or future listing date. */
export const PRE_LISTINGS_SCOPE = `${LISTING_SIDE_OPEN} AND (
  COALESCE(listing_visibility, 'public') = 'coming_soon'
  OR (listing_date IS NOT NULL AND listing_date > date('now'))
)`;

/** Under contract with a close date set. */
export const PENDING_DEALS_SCOPE = "stage = 'pending' AND close_date IS NOT NULL";

const TX_HUB_SELECT = `
  SELECT t.id, t.address, t.city, t.state, t.value, t.close_date, t.listing_date,
    COALESCE(t.client_name, t.owner_name) as client_name, u.name as agent_name
  FROM transactions t
  LEFT JOIN users u ON u.id = t.agent_id
`;

export function closedYtdStats(db, agentScope = 'all') {
  const jan1 = `${new Date().getFullYear()}-01-01`;
  const { sql, params } = transactionAgentScopeClause(agentScope, '');
  return db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as volume
    FROM transactions
    WHERE stage = 'closed' AND close_date >= ?${sql}
  `).get(jan1, ...params);
}

export function hubTransactionRows(db, agentScope = 'all') {
  const { sql, params } = transactionAgentScopeClause(agentScope, 't');

  const comingSoon = db.prepare(`
    ${TX_HUB_SELECT}
    WHERE ${PRE_LISTINGS_SCOPE}${sql}
    ORDER BY t.listing_date ASC, t.id ASC
    LIMIT 20
  `).all(...params);

  const listings = db.prepare(`
    ${TX_HUB_SELECT}
    WHERE ${ON_MARKET_LISTINGS_SCOPE}${sql}
    ORDER BY t.listing_date DESC, t.id ASC
    LIMIT 20
  `).all(...params);

  const pendingDeals = db.prepare(`
    ${TX_HUB_SELECT}
    WHERE ${PENDING_DEALS_SCOPE}${sql}
    ORDER BY (t.close_date IS NULL), t.close_date ASC, t.id ASC
    LIMIT 20
  `).all(...params);

  return { comingSoon, listings, pendingDeals };
}
