import {
  normalizeRepresenting,
  representingLabel,
} from '../constants/transactionForm';

/** Team / vendor roles (mirrors server PARTY_ROLES) */
export const PARTY_ROLE_DEFS = [
  { role: 'listing_agent', label: 'listing agent', is_team: true, defaultName: 'Meredith Alderson' },
  { role: 'office_administrator', label: 'office administrator', is_team: true, defaultName: 'Tessa Osborn' },
  { role: 'transaction_coordinator', label: 'transaction coordinator', is_team: true, defaultName: 'Adam Walding' },
  { role: 'escrow_officer', label: 'escrow officer', is_team: false, defaultName: '' },
];

function counterpartyDefs(representing) {
  const r = normalizeRepresenting(representing);
  if (r === 'seller_and_buyer') {
    return [
      { role: 'seller', label: 'seller', is_team: false },
      { role: 'buyer', label: 'buyer', is_team: false },
    ];
  }
  const label = representingLabel(representing).toLowerCase();
  return [{ role: 'counterparty', label, is_team: false }];
}

export function buildFallbackParties(transaction) {
  const externalName = transaction?.client_name || transaction?.owner_name || '';
  const team = PARTY_ROLE_DEFS.map((def, sort_order) => ({
    role: def.role,
    label: def.label,
    is_team: def.is_team,
    name: def.defaultName,
    user_id: null,
    sort_order,
  }));

  const counterparty = counterpartyDefs(transaction?.representing).map((def, i) => ({
    role: def.role,
    label: def.label,
    is_team: false,
    name: def.role === 'buyer' ? '' : externalName,
    user_id: null,
    sort_order: PARTY_ROLE_DEFS.length + i,
  }));

  return [...team, ...counterparty];
}
