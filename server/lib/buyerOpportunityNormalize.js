/** Server-side buyer status / preapproval / price normalization. */

const CANONICAL_STATUS = new Set(['active', 'pending', 'option_period', 'closed', 'on_hold']);
const CANONICAL_TIMING = new Set([
  'asap', 'near_term', 'mid_term', 'long_term', 'right_fit', 'casual',
]);
const CANONICAL_PRE = new Set(['y', 'n', 'cash']);

export function normalizeBuyerStatus(raw) {
  if (raw == null || raw === '') return 'active';
  const s = String(raw).trim();
  const lower = s.toLowerCase();
  if (CANONICAL_STATUS.has(lower)) return lower;
  if (lower === 'under_contract' || lower.includes('under contract') || lower.includes('leaseback')) {
    return 'pending';
  }
  if (lower.includes('pending')) return 'pending';
  if (lower.includes('option')) return 'option_period';
  if (/\bclosed\b/.test(lower) || lower === 'close') return 'closed';
  if (lower.includes('on hold') || lower.includes('paused') || lower.includes('unresponsive')) {
    return 'on_hold';
  }
  if (/(^|\s)hold(\s|$)/.test(lower)) return 'on_hold';
  if (lower.includes('tour')) return 'option_period';
  if (lower.includes('active')) return 'active';
  return 'active';
}

export function normalizeBuyerTiming(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  const lower = s.toLowerCase();
  if (CANONICAL_TIMING.has(lower)) return lower;
  if (lower === 'flexible') return 'right_fit';
  if (lower === 'lease_driven') return 'near_term';
  if (lower === 'on_hold') return 'casual';
  if (lower === '?' || lower === 'x') return 'right_fit';
  if (lower.includes('asap')) return 'asap';
  if (lower.includes('lease') || lower.includes('deadline') || lower.includes('must have') || lower.includes('before')) {
    return 'near_term';
  }
  if (lower.includes('casual')) return 'casual';
  if (
    lower.includes('flexible')
    || lower.includes('suitable')
    || lower.includes('not in a hurry')
    || lower.includes('not in a rush')
    || lower.includes('whenever')
    || lower.includes('right thing')
    || lower.includes('right fit')
    || lower.includes('send as we see')
    || lower.includes('hot & cold')
    || lower.includes('hot and cold')
  ) {
    return 'right_fit';
  }
  if (lower.includes('summer') || lower.includes('this month') || /\b\d{1,2}\/\d{1,2}/.test(lower)) {
    return 'near_term';
  }
  if (lower.includes('2026') || lower.includes('2027') || lower.includes('closes')) {
    return 'mid_term';
  }
  if (lower.includes('year') || lower.includes('12 month')) return 'long_term';
  return 'right_fit';
}

export function normalizePreapproval(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  const lower = s.toLowerCase();
  if (CANONICAL_PRE.has(lower)) return lower;
  if (lower.includes('cash')) return 'cash';
  if (/^(y|yes)\b/.test(lower) || lower === 'y' || lower.startsWith('yes')) return 'y';
  if (/^(n|no)\b/.test(lower) || lower === 'n' || lower === 'x' || lower.includes('not yet') || lower.startsWith('no')) {
    return 'n';
  }
  return null;
}

function scalePriceNumber(n, suffix) {
  if (n == null || Number.isNaN(n)) return null;
  const suf = (suffix || '').toLowerCase();
  if (suf === 'm') return Math.round(n * 1_000_000);
  if (suf === 'k') return Math.round(n * 1_000);
  if (n > 0 && n < 20) return Math.round(n * 1_000_000);
  if (n >= 20 && n < 10000) return Math.round(n * 1_000);
  return Math.round(n);
}

export function parsePriceAmount(token) {
  if (token == null) return null;
  let s = String(token).trim().toLowerCase().replace(/[$,]/g, '');
  if (!s || s === '?' || s === 'x') return null;
  s = s.replace(/or less|max|upto|up to|under|about|approx|~|each/g, '').trim();
  s = s.replace(/million/g, 'm').replace(/thousand/g, 'k');
  const m = s.match(/^([<>]=?)?\s*(\d+(?:\.\d+)?)\s*([km])?$/i);
  if (!m) {
    const loose = s.match(/(\d+(?:\.\d+)?)\s*([km])?/i);
    if (!loose) return null;
    return scalePriceNumber(Number(loose[1]), loose[2]);
  }
  return scalePriceNumber(Number(m[2]), m[3]);
}

export function parseBuyerPriceText(raw) {
  if (raw == null || String(raw).trim() === '') return { min: null, max: null };
  const original = String(raw).trim();
  const lower = original.toLowerCase();
  if (lower === '?' || lower === 'x') return { min: null, max: null };

  const upTo = /^(up to|under|max|or less)/i.test(lower)
    || /\b(or less|max)\b/i.test(lower)
    || lower.startsWith('<');
  const atLeast = lower.startsWith('>') || lower.startsWith('≥') || /\bmin\b/i.test(lower);

  const rangeParts = original.split(/\s*(?:–|—|to)\s*|\s+-\s*|(?<=\d)\s*-\s*(?=\d)/i);
  if (rangeParts.length >= 2) {
    const a = parsePriceAmount(rangeParts[0].replace(/^[<>]=?\s*/, ''));
    const b = parsePriceAmount(rangeParts[1]);
    if (a != null && b != null) return { min: Math.min(a, b), max: Math.max(a, b) };
    if (a != null && b == null) return { min: a, max: null };
    if (a == null && b != null) return { min: null, max: b };
  }

  if (/[-\u2013\u2014]\s*$/.test(original)) {
    const min = parsePriceAmount(original.replace(/[-\u2013\u2014]\s*$/, '').replace(/^[<>]=?\s*/, ''));
    return { min, max: null };
  }

  const amount = parsePriceAmount(original.replace(/^[<>]=?\s*/, ''));
  if (amount == null) return { min: null, max: null };
  if (upTo) return { min: null, max: amount };
  if (atLeast) return { min: amount, max: null };
  return { min: amount, max: amount };
}

function formatCompactDollars(n) {
  if (n == null || Number.isNaN(Number(n))) return '';
  const v = Number(n);
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    const s = m % 1 === 0 ? String(m) : m.toFixed(1).replace(/\.0$/, '');
    return `$${s}M`;
  }
  if (v >= 1_000) {
    const k = v / 1_000;
    const s = k % 1 === 0 ? String(k) : k.toFixed(1).replace(/\.0$/, '');
    return `$${s}K`;
  }
  return `$${Math.round(v).toLocaleString()}`;
}

export function priceDisplayFromBounds(min, max) {
  const hasMin = min != null && !Number.isNaN(Number(min));
  const hasMax = max != null && !Number.isNaN(Number(max));
  if (hasMin && hasMax) {
    const a = Number(min);
    const b = Number(max);
    if (a === b) return formatCompactDollars(a);
    return `${formatCompactDollars(Math.min(a, b))}–${formatCompactDollars(Math.max(a, b))}`;
  }
  if (hasMin && !hasMax) return `${formatCompactDollars(Number(min))}+`;
  if (!hasMin && hasMax) return `Up to ${formatCompactDollars(Number(max))}`;
  return null;
}

export function resolveBuyerPriceFields({ price_min, price_max, price } = {}) {
  const hasMin = price_min !== undefined && price_min !== null && price_min !== '';
  const hasMax = price_max !== undefined && price_max !== null && price_max !== '';
  if (hasMin || hasMax) {
    let min = hasMin ? Number(price_min) : null;
    let max = hasMax ? Number(price_max) : null;
    if (min != null && Number.isNaN(min)) min = null;
    if (max != null && Number.isNaN(max)) max = null;
    if (min != null && max != null && min > max) {
      const t = min;
      min = max;
      max = t;
    }
    return {
      price_min: min,
      price_max: max,
      price: priceDisplayFromBounds(min, max),
    };
  }
  if (price != null && String(price).trim() !== '') {
    const parsed = parseBuyerPriceText(price);
    return {
      price_min: parsed.min,
      price_max: parsed.max,
      price: priceDisplayFromBounds(parsed.min, parsed.max) || String(price).trim(),
    };
  }
  return { price_min: null, price_max: null, price: null };
}

function parseRepExpiryDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(`${s.slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!m) return null;
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  const d = new Date(year, Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toYmd(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

/** @returns {{ signed: boolean, expires_on: string|null }} */
export function parseBuyerRep(rowOrSigned, maybeExpires) {
  let signedRaw;
  let expiresRaw;
  if (rowOrSigned != null && typeof rowOrSigned === 'object' && !Array.isArray(rowOrSigned)) {
    signedRaw = rowOrSigned.buyer_rep_signed;
    expiresRaw = rowOrSigned.buyer_rep_expires_on;
  } else {
    signedRaw = rowOrSigned;
    expiresRaw = maybeExpires;
  }

  let expires_on = null;
  if (expiresRaw != null && String(expiresRaw).trim() !== '') {
    const fromCol = parseRepExpiryDate(expiresRaw);
    if (fromCol) expires_on = toYmd(fromCol);
  }
  if (!expires_on && signedRaw != null) {
    const fromSigned = parseRepExpiryDate(signedRaw);
    if (fromSigned) expires_on = toYmd(fromSigned);
  }

  const s = String(signedRaw ?? '').trim();
  const lower = s.toLowerCase();
  const looksNo = !s
    || lower === 'n'
    || lower === 'no'
    || lower === '?'
    || lower === 'x'
    || /^n[\s\-.]/i.test(s);

  let signed = false;
  if (looksNo && !expires_on) {
    signed = false;
  } else if (
    /^y\b/i.test(s)
    || lower === 'y'
    || lower.includes('yes')
    || lower.includes('signed')
    || (expires_on && !looksNo)
  ) {
    signed = true;
  } else if (expires_on) {
    signed = true;
  } else if (s && !looksNo) {
    signed = true;
  }

  return { signed, expires_on };
}

export function encodeBuyerRepStorage({ signed, expires_on }) {
  if (!signed) {
    return { buyer_rep_signed: null, buyer_rep_expires_on: null };
  }
  let expires = null;
  if (expires_on != null && String(expires_on).trim() !== '') {
    const d = parseRepExpiryDate(expires_on);
    expires = d ? toYmd(d) : String(expires_on).trim().slice(0, 10);
  }
  return { buyer_rep_signed: 'Y', buyer_rep_expires_on: expires };
}

/** Resolve body fields for buyer rep (checkbox + date). Dropbox ignored. */
export function resolveBuyerRepFields(body = {}, existing = {}) {
  const hasSigned = Object.prototype.hasOwnProperty.call(body, 'buyer_rep_signed')
    || Object.prototype.hasOwnProperty.call(body, 'buyer_rep_is_signed');
  const hasExpires = Object.prototype.hasOwnProperty.call(body, 'buyer_rep_expires_on');

  if (!hasSigned && !hasExpires) {
    const parsed = parseBuyerRep(existing);
    return encodeBuyerRepStorage(parsed);
  }

  const base = parseBuyerRep(existing);
  let signed = base.signed;
  let expires_on = base.expires_on;

  if (hasExpires) {
    const raw = body.buyer_rep_expires_on;
    if (raw == null || String(raw).trim() === '') expires_on = null;
    else {
      const d = parseRepExpiryDate(raw);
      expires_on = d ? toYmd(d) : String(raw).trim().slice(0, 10);
    }
  }

  if (hasSigned) {
    const raw = body.buyer_rep_is_signed ?? body.buyer_rep_signed;
    if (typeof raw === 'boolean') signed = raw;
    else if (raw == null || raw === '') signed = false;
    else {
      const parsed = parseBuyerRep(raw, expires_on);
      signed = parsed.signed;
      if (!hasExpires && parsed.expires_on) expires_on = parsed.expires_on;
    }
  }

  if (!signed) expires_on = null;
  return encodeBuyerRepStorage({ signed, expires_on });
}

/** Normalize status/preapproval/timing and backfill price_min/max from legacy price text. */
export function normalizeBuyerOpportunityRows(db) {
  const cols = db.prepare('PRAGMA table_info(opportunity_buyers)').all().map((c) => c.name);
  const hasExpires = cols.includes('buyer_rep_expires_on');

  const rows = db.prepare(
    hasExpires
      ? 'SELECT id, status, preapproval, timing, price, price_min, price_max, buyer_rep_signed, buyer_rep_expires_on FROM opportunity_buyers'
      : 'SELECT id, status, preapproval, timing, price, price_min, price_max, buyer_rep_signed FROM opportunity_buyers',
  ).all();

  const update = hasExpires
    ? db.prepare(`
        UPDATE opportunity_buyers
        SET status = ?, preapproval = ?, timing = ?, price = ?, price_min = ?, price_max = ?,
            buyer_rep_signed = ?, buyer_rep_expires_on = ?, buyer_rep_dropbox = NULL
        WHERE id = ?
      `)
    : db.prepare(`
        UPDATE opportunity_buyers
        SET status = ?, preapproval = ?, timing = ?, price = ?, price_min = ?, price_max = ?
        WHERE id = ?
      `);

  let n = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      const status = normalizeBuyerStatus(row.status);
      const mappedPre = normalizePreapproval(row.preapproval);
      const preapproval = mappedPre != null
        ? mappedPre
        : (row.preapproval == null || String(row.preapproval).trim() === '' ? null : row.preapproval);

      const mappedTiming = normalizeBuyerTiming(row.timing);
      const timing = mappedTiming != null
        ? mappedTiming
        : (row.timing == null || String(row.timing).trim() === '' ? null : row.timing);

      let priceMin = row.price_min;
      let priceMax = row.price_max;
      let price = row.price;
      if ((priceMin == null && priceMax == null) && price) {
        const parsed = parseBuyerPriceText(price);
        priceMin = parsed.min;
        priceMax = parsed.max;
        const display = priceDisplayFromBounds(priceMin, priceMax);
        if (display) price = display;
      } else if (priceMin != null || priceMax != null) {
        const display = priceDisplayFromBounds(priceMin, priceMax);
        if (display) price = display;
      }

      if (hasExpires) {
        const rep = encodeBuyerRepStorage(parseBuyerRep(row));
        const changed = status !== row.status
          || (mappedPre != null && mappedPre !== row.preapproval)
          || (mappedTiming != null && mappedTiming !== row.timing)
          || priceMin !== row.price_min
          || priceMax !== row.price_max
          || price !== row.price
          || rep.buyer_rep_signed !== row.buyer_rep_signed
          || rep.buyer_rep_expires_on !== row.buyer_rep_expires_on;
        if (changed) {
          update.run(
            status, preapproval, timing, price, priceMin, priceMax,
            rep.buyer_rep_signed, rep.buyer_rep_expires_on, row.id,
          );
          n += 1;
        }
      } else {
        const changed = status !== row.status
          || (mappedPre != null && mappedPre !== row.preapproval)
          || (mappedTiming != null && mappedTiming !== row.timing)
          || priceMin !== row.price_min
          || priceMax !== row.price_max
          || price !== row.price;
        if (changed) {
          update.run(status, preapproval, timing, price, priceMin, priceMax, row.id);
          n += 1;
        }
      }
    }
  });
  tx();
  if (n > 0) {
    console.log(`[opportunities] Normalized ${n} buyer row(s)`);
  }
}
