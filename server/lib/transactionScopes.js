/** Shared SQL scopes for transaction portfolio segments. */
export const LISTING_REPRESENTING = "representing IN ('seller','seller_and_buyer','landlord','both','seller_and_client','leasing')";

const LISTING_SIDE_OPEN = `${LISTING_REPRESENTING} AND stage != 'closed' AND acceptance_date IS NULL`;

/** On-market listings: listing-side, live listing date, not marked coming soon, no accepted offer, not closed. */
export const ACTIVE_LISTINGS_SCOPE = `${LISTING_SIDE_OPEN} AND COALESCE(listing_visibility, 'public') != 'coming_soon' AND listing_date IS NOT NULL AND listing_date <= date('now')`;

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

export function closedYtdStats(db) {
  const jan1 = `${new Date().getFullYear()}-01-01`;
  return db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as volume
    FROM transactions
    WHERE stage = 'closed' AND close_date >= ?
  `).get(jan1);
}

export function hubTransactionRows(db) {
  const comingSoon = db.prepare(`
    ${TX_HUB_SELECT}
    WHERE ${PRE_LISTINGS_SCOPE}
    ORDER BY t.listing_date ASC, t.id ASC
    LIMIT 20
  `).all();

  const listings = db.prepare(`
    ${TX_HUB_SELECT}
    WHERE ${ACTIVE_LISTINGS_SCOPE}
    ORDER BY t.listing_date DESC, t.id ASC
    LIMIT 20
  `).all();

  const pendingDeals = db.prepare(`
    ${TX_HUB_SELECT}
    WHERE ${PENDING_DEALS_SCOPE}
    ORDER BY (t.close_date IS NULL), t.close_date ASC, t.id ASC
    LIMIT 20
  `).all();

  return { comingSoon, listings, pendingDeals };
}
