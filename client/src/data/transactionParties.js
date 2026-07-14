import {
  normalizeSaleType,
  SALE_TYPE_TRADITIONAL,
  SALE_TYPE_RENT_LEASE,
} from '../constants/transactionForm';

export const FIXED_PARTY_ROLES = {
  traditional: [
    { role: 'agent', label: 'Agent', is_team: true },
    { role: 'escrow_officer', label: 'Escrow', is_team: false },
    { role: 'cooperating_agent', label: 'Cooperating Agent', is_team: false },
    { role: 'client', label: 'Client', is_team: false },
    { role: 'lender', label: 'Lender', is_team: false },
  ],
  rent: [
    { role: 'agent', label: 'Agent', is_team: true },
    { role: 'client', label: 'Client', is_team: false },
  ],
};

const ALL_FIXED = new Set(FIXED_PARTY_ROLES.traditional.map((r) => r.role));

const LEGACY_LABELS = {
  listing_agent: 'Agent',
  office_administrator: 'office administrator',
  transaction_coordinator: 'transaction coordinator',
  escrow_officer: 'Escrow',
  cooperating_agent: 'Cooperating Agent',
  lender: 'Lender',
  client: 'Client',
  counterparty: 'Client',
  seller: 'Client',
  buyer: 'Client',
  agent: 'Agent',
};

export function normalizePartyRole(role) {
  if (!role) return role;
  if (role === 'listing_agent') return 'agent';
  if (role === 'counterparty' || role === 'seller' || role === 'buyer') return 'client';
  return role;
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
  if (isCustomPartyRole(role)) return customRoleLabel(role);
  if (LEGACY_LABELS[role]) return LEGACY_LABELS[role];
  const normalized = normalizePartyRole(role);
  if (LEGACY_LABELS[normalized]) return LEGACY_LABELS[normalized];
  return String(role || '').replace(/_/g, ' ');
}

export function isTraditionalSale(saleType, representing) {
  return normalizeSaleType(saleType, representing) === SALE_TYPE_TRADITIONAL;
}

export function fixedRolesForSaleType(saleType, representing) {
  return isTraditionalSale(saleType, representing)
    ? FIXED_PARTY_ROLES.traditional
    : FIXED_PARTY_ROLES.rent;
}

export function requiredPartyRoles(saleType, representing, intent) {
  const roles = ['agent', 'client'];
  if (intent === 'pending' && isTraditionalSale(saleType, representing)) {
    roles.push('escrow_officer', 'cooperating_agent', 'lender');
  }
  return roles;
}

export function validateParties(parties, saleType, representing, intent) {
  const required = requiredPartyRoles(saleType, representing, intent);
  const missing = [];
  for (const role of required) {
    const row = (parties || []).find((p) => normalizePartyRole(p.role) === role);
    const name = String(row?.name || '').trim();
    if (!name && !(role === 'agent' && row?.user_id)) {
      missing.push(labelForPartyRole(role));
    }
  }
  if (missing.length === 0) return { ok: true, missing: [] };
  const gate = intent === 'pending' ? 'pending' : 'active';
  return {
    ok: false,
    missing,
    message: `Required for ${gate}: ${missing.join(', ')}`,
  };
}

function findByRole(parties, role) {
  return (parties || []).find((p) => normalizePartyRole(p.role) === role);
}

/**
 * Compose display rows: fixed slots for sale type, then extras (custom / OA / TC / hidden traditional slots when rent).
 */
export function composePartyRows(transaction, parties = [], agentName = '') {
  const saleType = normalizeSaleType(transaction?.sale_type, transaction?.representing);
  const fixed = fixedRolesForSaleType(saleType, transaction?.representing);
  const fixedKeys = new Set(fixed.map((d) => d.role));
  const clientFallback = transaction?.client_name || transaction?.owner_name || '';

  const fixedRows = fixed.map((def, sort_order) => {
    const existing = findByRole(parties, def.role);
    let name = existing?.name || '';
    if (def.role === 'agent') {
      name = agentName || name;
    }
    if (def.role === 'client' && !String(name).trim()) {
      name = clientFallback;
    }
    return {
      role: def.role,
      label: def.label,
      is_team: def.is_team,
      is_fixed: true,
      name: name || '',
      user_id: def.role === 'agent' ? (existing?.user_id ?? transaction?.agent_id ?? null) : (existing?.user_id ?? null),
      sort_order,
    };
  });

  const used = new Set(fixedRows.map((r) => r.role));
  // Also treat legacy keys as consumed so we don't duplicate as extras
  for (const p of parties || []) {
    const n = normalizePartyRole(p.role);
    if (fixedKeys.has(n)) used.add(p.role);
  }

  const extras = (parties || [])
    .filter((p) => {
      const n = normalizePartyRole(p.role);
      if (fixedKeys.has(n)) return false;
      // Hide traditional-only slots on rent/lease UI (still stored)
      if (saleType === SALE_TYPE_RENT_LEASE && ALL_FIXED.has(n) && !fixedKeys.has(n)) {
        return false;
      }
      return true;
    })
    .map((p, i) => ({
      role: p.role,
      label: labelForPartyRole(p.role),
      is_team: Boolean(p.is_team),
      is_fixed: false,
      name: p.name || '',
      user_id: p.user_id ?? null,
      sort_order: fixedRows.length + i,
    }));

  return [...fixedRows, ...extras];
}

/** Fallback seed when API has no parties yet. */
export function buildFallbackParties(transaction, agentName = '') {
  return composePartyRows(transaction, [], agentName).map(({ role, name, user_id, label, is_team, is_fixed }) => ({
    role,
    name,
    user_id,
    label,
    is_team,
    is_fixed,
  }));
}

export { SALE_TYPE_TRADITIONAL, SALE_TYPE_RENT_LEASE };
