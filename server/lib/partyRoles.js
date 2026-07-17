/** Shared party role keys, labels, and stage-gate validation. */

export const SALE_TYPE_TRADITIONAL = 'Traditional sale';
export const SALE_TYPE_RENT_LEASE = 'Rent/lease';
export const SALE_TYPE_REFERRAL = 'Referral';

export const FIXED_PARTY_ROLES = {
  traditional: [
    { role: 'agent', label: 'Agent', isTeam: true },
    { role: 'escrow_officer', label: 'Title', isTeam: false },
    { role: 'cooperating_agent', label: 'Cooperating Agent', isTeam: false },
    { role: 'client', label: 'Client', isTeam: false },
    { role: 'lender', label: 'Lender', isTeam: false },
  ],
  rent: [
    { role: 'agent', label: 'Agent', isTeam: true },
    { role: 'client', label: 'Client', isTeam: false },
  ],
};

const ALL_FIXED_ROLES = new Set(FIXED_PARTY_ROLES.traditional.map((r) => r.role));

const LEGACY_LABELS = {
  listing_agent: 'Agent',
  office_administrator: 'office administrator',
  transaction_coordinator: 'transaction coordinator',
  escrow_officer: 'Title',
  cooperating_agent: 'Cooperating Agent',
  lender: 'Lender',
  client: 'Client',
  counterparty: 'Client',
  seller: 'Client',
  buyer: 'Client',
  agent: 'Agent',
};

export function normalizeSaleType(value, representing) {
  if (value && String(value).trim()) {
    const lower = String(value).toLowerCase();
    if (lower.includes('rent') || lower.includes('lease')) return SALE_TYPE_RENT_LEASE;
    if (lower.includes('referral')) return SALE_TYPE_REFERRAL;
    return SALE_TYPE_TRADITIONAL;
  }
  const r = representing || 'seller';
  if (r === 'landlord' || r === 'tenant' || r === 'leasing' || r === 'renting') {
    return SALE_TYPE_RENT_LEASE;
  }
  return SALE_TYPE_TRADITIONAL;
}

export function isTraditionalSale(saleType, representing) {
  return normalizeSaleType(saleType, representing) === SALE_TYPE_TRADITIONAL;
}

/** Rent/lease and Referral use Agent + Client only. */
export function isSimplePartySale(saleType, representing) {
  const normalized = normalizeSaleType(saleType, representing);
  return normalized === SALE_TYPE_RENT_LEASE || normalized === SALE_TYPE_REFERRAL;
}

export function fixedRolesForSaleType(saleType, representing) {
  return isTraditionalSale(saleType, representing)
    ? FIXED_PARTY_ROLES.traditional
    : FIXED_PARTY_ROLES.rent;
}

/** Canonical role key for storage / lookups. */
export function normalizePartyRole(role) {
  if (!role) return role;
  if (role === 'listing_agent') return 'agent';
  if (role === 'counterparty' || role === 'seller' || role === 'buyer') return 'client';
  return role;
}

export function isFixedPartyRole(role) {
  return ALL_FIXED_ROLES.has(normalizePartyRole(role));
}

export function isCustomPartyRole(role) {
  return String(role || '').startsWith('custom:');
}

export function customRoleKey(label) {
  const clean = String(label || 'Party').trim() || 'Party';
  return `custom:${clean}`;
}

export function customRoleLabel(role) {
  if (!isCustomPartyRole(role)) return role;
  return String(role).slice('custom:'.length) || 'Party';
}

export function labelForPartyRole(role) {
  const normalized = normalizePartyRole(role);
  if (isCustomPartyRole(role)) return customRoleLabel(role);
  if (LEGACY_LABELS[role]) return LEGACY_LABELS[role];
  if (LEGACY_LABELS[normalized]) return LEGACY_LABELS[normalized];
  return String(role || '').replace(/_/g, ' ');
}

/** @param {'active' | 'pending'} intent */
export function requiredPartyRoles(saleType, representing, intent) {
  const roles = ['agent', 'client'];
  if (intent === 'pending' && isTraditionalSale(saleType, representing)) {
    roles.push('escrow_officer', 'cooperating_agent', 'lender');
  }
  return roles;
}

function partyNameForRole(parties, role) {
  const target = normalizePartyRole(role);
  const row = (parties || []).find((p) => normalizePartyRole(p.role) === target);
  if (!row) return '';
  return String(row.name || '').trim();
}

/**
 * @returns {{ ok: true } | { ok: false, missing: string[], message: string }}
 */
export function validateParties(parties, saleType, representing, intent) {
  const required = requiredPartyRoles(saleType, representing, intent);
  const missing = [];
  for (const role of required) {
    const name = partyNameForRole(parties, role);
    // Agent may be satisfied by user_id even if name briefly empty (caller should fill name).
    if (!name) {
      const row = (parties || []).find((p) => normalizePartyRole(p.role) === role);
      if (role === 'agent' && row?.user_id) continue;
      missing.push(labelForPartyRole(role));
    }
  }
  if (missing.length === 0) return { ok: true, missing: [] };
  if (intent === 'pending') {
    return {
      ok: false,
      missing,
      message: `Can't move this transaction to pending until these party fields are filled: ${missing.join(', ')}.`,
    };
  }
  return {
    ok: false,
    missing,
    message: `Can't activate this transaction until these party fields are filled: ${missing.join(', ')}.`,
  };
}
