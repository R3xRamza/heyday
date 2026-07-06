import { normalizeAddressFields } from './address.js';
import { clearTransactionData } from './transactionSeed.js';

const SALE_TYPE_TRADITIONAL = 'Traditional sale';
const SALE_TYPE_RENT_LEASE = 'Rent/lease';

const FIRST_NAME_TO_EMAIL = {
  meredith: 'meredith@theheydaygroup.com',
  tessa: 'tessa@theheydaygroup.com',
  adam: 'adam@theheydaygroup.com',
  margaret: 'margaret@theheydaygroup.com',
};

/** Brokermint MM/DD/YYYY → YYYY-MM-DD */
export function parseBrokermintDate(value) {
  if (!value || !String(value).trim()) return null;
  const m = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mo, da, yr] = m;
  return `${yr}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}`;
}

function parseNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function isRentLease(transactionType) {
  const t = String(transactionType || '').toLowerCase();
  return t.includes('rent') || t.includes('lease');
}

export function mapBrokermintRepresenting(representing, transactionType) {
  const rep = String(representing || '').trim().toLowerCase();
  const lease = isRentLease(transactionType);
  if (rep === 'both') return 'seller_and_buyer';
  if (lease) {
    if (rep === 'seller') return 'landlord';
    if (rep === 'buyer') return 'tenant';
  }
  if (rep === 'seller' || rep === 'buyer') return rep;
  return 'seller';
}

export function mapBrokermintSaleType(transactionType) {
  return isRentLease(transactionType) ? SALE_TYPE_RENT_LEASE : SALE_TYPE_TRADITIONAL;
}

export function mapBrokermintStage(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'closed') return 'closed';
  if (s === 'pending') return 'pending';
  if (s === 'active' || s === 'opportunity') return 'active';
  return null;
}

export function resolveBrokermintAgentId(usersByEmail, usersColumn, defaultAgentId) {
  const firstAgent = String(usersColumn || '').split(',')[0].trim().toLowerCase();
  if (!firstAgent) return defaultAgentId;
  const firstName = firstAgent.split(/\s+/)[0];
  const email = FIRST_NAME_TO_EMAIL[firstName];
  if (email && usersByEmail[email] != null) return usersByEmail[email];
  return defaultAgentId;
}

/**
 * Map one Brokermint CSV row → transaction insert fields.
 * Returns null when the row should be skipped (cancelled / unmapped status).
 */
export function mapBrokermintRow(row, { usersByEmail, defaultAgentId }) {
  const status = String(row.status || '').trim().toLowerCase();
  if (status === 'cancelled') return null;

  const stage = mapBrokermintStage(status);
  if (!stage) return null;

  const addr = normalizeAddressFields(row.full_address || '');
  if (!addr.address) return null;

  const representing = mapBrokermintRepresenting(row.representing, row.transaction_type);
  const ownerName = String(row.owner_name || '').trim() || null;
  const expiration = parseBrokermintDate(row.expiration_date);

  return {
    address: addr.address,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    value: parseNumber(row.price),
    owner_name: ownerName,
    client_name: ownerName,
    representing,
    listing_visibility: 'public',
    stage,
    important_date: expiration,
    important_date_label: expiration ? 'expires' : null,
    close_date: parseBrokermintDate(row.closing_date),
    listing_date: parseBrokermintDate(row.listing_date),
    acceptance_date: parseBrokermintDate(row.acceptance_date),
    option_end_date: parseBrokermintDate(row.option_end_date),
    workflow_status: 'active',
    transaction_name: String(row.custom_id || '').trim() || null,
    sale_type: mapBrokermintSaleType(row.transaction_type),
    gross_commission: parseNumber(row.total_gross_commission),
    buyer_agreement_date: parseBrokermintDate(row.buyer_agreement_date),
    buyer_expiration_date: parseBrokermintDate(row.buyer_expiration_date),
    agent_id: resolveBrokermintAgentId(usersByEmail, row.users, defaultAgentId),
    created_at: parseBrokermintDate(row.created_at),
  };
}

export const BROKERMINT_INSERT_COLUMNS = [
  'address', 'city', 'state', 'zip', 'value', 'owner_name', 'client_name',
  'representing', 'listing_visibility', 'stage', 'important_date', 'important_date_label',
  'close_date', 'listing_date', 'acceptance_date', 'option_end_date', 'workflow_status',
  'transaction_name', 'sale_type', 'gross_commission', 'buyer_agreement_date',
  'buyer_expiration_date', 'agent_id', 'created_at',
];

/**
 * Clear existing transactions and import Brokermint rows.
 * Closed deals get no checklists (historical import).
 */
export function runBrokermintImport(db, rawRows, { clearFirst = true } = {}) {
  const users = db.prepare('SELECT id, email, name FROM users').all();
  const usersByEmail = Object.fromEntries(users.map((u) => [u.email, u.id]));
  const meredith = usersByEmail['meredith@theheydaygroup.com'];
  const defaultAgentId = meredith ?? users[0]?.id ?? 1;

  const before = clearFirst
    ? {
      transactions: db.prepare('SELECT COUNT(*) as c FROM transactions').get().c,
      tasks: db.prepare('SELECT COUNT(*) as c FROM tasks').get().c,
    }
    : null;

  if (clearFirst) clearTransactionData(db);

  const placeholders = BROKERMINT_INSERT_COLUMNS.map(() => '?').join(', ');
  const insert = db.prepare(`
    INSERT INTO transactions (${BROKERMINT_INSERT_COLUMNS.join(', ')})
    VALUES (${placeholders})
  `);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  db.transaction(() => {
    for (const row of rawRows) {
      try {
        const mapped = mapBrokermintRow(row, { usersByEmail, defaultAgentId });
        if (!mapped) {
          skipped++;
          continue;
        }
        insert.run(...BROKERMINT_INSERT_COLUMNS.map((col) => mapped[col]));
        inserted++;
      } catch (e) {
        errors++;
        if (errors <= 5) console.error('Brokermint row error:', e.message);
      }
    }
  })();

  const byStage = db.prepare('SELECT stage, COUNT(*) as c FROM transactions GROUP BY stage ORDER BY stage').all();
  const total = db.prepare('SELECT COUNT(*) as c FROM transactions').get().c;

  return {
    before,
    inserted,
    skipped,
    errors,
    total,
    byStage: Object.fromEntries(byStage.map((r) => [r.stage, r.c])),
  };
}
