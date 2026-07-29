/** Seller opportunity helpers (client). */

import { formatBuyerPrice } from './buyerOpportunity';

export const SELLER_STATUS = 'Leads';

function trimStr(v) {
  return v == null ? '' : String(v).trim();
}

/** Split street vs optional apt (# / Apt / Unit / Ste). */
export function splitStreetAndApt(streetRaw) {
  const streetPart = trimStr(streetRaw);
  if (!streetPart) return { street: '', apt: '' };
  const m = streetPart.match(/^(.*?)(?:\s+)(?:#|apt\.?\s*|apartment\s*|unit\s*|ste\.?\s*|suite\s*)(.+)$/i);
  if (!m) return { street: streetPart, apt: '' };
  const street = trimStr(m[1]);
  let apt = trimStr(m[2]);
  apt = apt.replace(/^#\s*/, '');
  return { street: street || streetPart, apt };
}

/**
 * Compose one storage/display line from multi-field address.
 * Apt is appended to street as `#…`. State included when present (from search).
 */
export function composeSellerAddressLine({ street, apt, city, state, zip } = {}) {
  const { street: baseStreet } = splitStreetAndApt(street);
  let streetLine = trimStr(baseStreet) || trimStr(street);
  const a = trimStr(apt);
  if (a) {
    const aptPart = a.startsWith('#') ? a : `#${a}`;
    streetLine = streetLine ? `${streetLine} ${aptPart}` : aptPart;
  }
  const c = trimStr(city);
  const st = trimStr(state);
  const z = trimStr(zip);
  const stateZip = [st, z].filter(Boolean).join(' ');
  return [streetLine, c, stateZip].filter(Boolean).join(', ');
}

/** @deprecated use composeSellerAddressLine */
export function composeFullAddressLine(fields = {}) {
  return composeSellerAddressLine({
    street: fields.address ?? fields.street,
    apt: fields.apt,
    city: fields.city,
    state: fields.state,
    zip: fields.zip,
  });
}

/** Parse legacy/single-line `property_address` into form fields. */
export function parseSellerAddressLine(raw) {
  const s = trimStr(raw);
  if (!s) return { street: '', apt: '', city: '', state: '', zip: '' };

  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  let streetPart = parts[0] || s;
  let city = '';
  let state = '';
  let zip = '';

  if (parts.length >= 3) {
    city = parts[1];
    const tail = parts.slice(2).join(' ').trim();
    const m = tail.match(/^(?:([A-Za-z]{2})\s+)?(\d{5}(?:-\d{4})?)?$/);
    if (m) {
      state = m[1] || '';
      zip = m[2] || '';
    } else {
      city = parts.slice(1).join(', ');
    }
  } else if (parts.length === 2) {
    const tail = parts[1];
    const zipOnly = tail.match(/^(\d{5}(?:-\d{4})?)$/);
    const stateZip = tail.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (zipOnly) {
      zip = zipOnly[1];
    } else if (stateZip) {
      state = stateZip[1];
      zip = stateZip[2];
    } else {
      city = tail;
    }
  }

  const { street, apt } = splitStreetAndApt(streetPart);
  return { street, apt, city, state, zip };
}

/** Table/card label: street + apt only (no city / state / ZIP). */
export function formatSellerAddressDisplay(raw) {
  const { street, apt } = parseSellerAddressLine(raw);
  if (!street && !apt) {
    const fallback = trimStr(raw);
    return fallback || '—';
  }
  if (apt) {
    const aptPart = apt.startsWith('#') ? apt : `#${apt}`;
    return street ? `${street} ${aptPart}` : aptPart;
  }
  return street;
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
