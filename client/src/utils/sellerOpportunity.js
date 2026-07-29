/** Seller opportunity helpers (client). */

import { formatBuyerPrice } from './buyerOpportunity';

export const SELLER_STATUS = 'Leads';

/** Compose one display/storage line: street, city, STATE ZIP */
export function composeFullAddressLine({ address, city, state, zip } = {}) {
  const street = String(address || '').trim();
  const c = String(city || '').trim();
  const st = String(state || '').trim();
  const z = String(zip || '').trim();
  const stateZip = [st, z].filter(Boolean).join(' ');
  return [street, c, stateZip].filter(Boolean).join(', ');
}

/** Compact price label — same rules as buyer budget; falls back to legacy price_range. */
export function formatSellerPrice(row) {
  if (row == null || typeof row !== 'object') return formatBuyerPrice(row);
  return formatBuyerPrice({
    price_min: row.price_min,
    price_max: row.price_max,
    price: row.price_range ?? row.price,
  });
}
