const BASE_REQUIRED = ['address', 'city', 'state', 'zip'];

const REQUIRED_BY_REPRESENTING = {
  seller: ['listing_date', 'important_date'],
  buyer: ['close_date', 'acceptance_date', 'option_end_date'],
  seller_and_buyer: [],
  landlord: ['listing_date'],
  tenant: ['acceptance_date', 'close_date'],
};

export const FIELD_LABELS = {
  address: 'Address',
  city: 'City',
  state: 'State',
  zip: 'ZIP',
  listing_date: 'Listing date',
  important_date: 'Expiry date',
  close_date: 'Closing date',
  acceptance_date: 'Acceptance date',
  option_end_date: 'Option end date',
  representing: 'Representing',
};

export function normalizeRepresenting(value) {
  if (value === 'private_listing') return 'seller';
  if (value === 'both' || value === 'seller_and_client') return 'seller_and_buyer';
  if (value === 'leasing') return 'landlord';
  if (value === 'renting') return 'tenant';
  return value || 'seller';
}

export function normalizeListingVisibility(value) {
  if (value === 'private') return 'private';
  if (value === 'coming_soon') return 'coming_soon';
  return 'public';
}

export function getRequiredTransactionFields(representing, listingVisibility) {
  if (normalizeListingVisibility(listingVisibility) === 'coming_soon') {
    return [...BASE_REQUIRED];
  }
  const r = normalizeRepresenting(representing);
  return [...BASE_REQUIRED, ...(REQUIRED_BY_REPRESENTING[r] || [])];
}

function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

export function validateTransactionFields(record) {
  const required = getRequiredTransactionFields(record.representing, record.listing_visibility);
  const missing = required.filter((key) => isEmpty(record[key]));
  if (missing.length === 0) {
    return { ok: true, missing: [] };
  }
  const labels = missing.map((k) => FIELD_LABELS[k] || k);
  return {
    ok: false,
    missing,
    message: `Required: ${labels.join(', ')}`,
  };
}

export function validateCreateTransaction(body) {
  const missing = BASE_REQUIRED.filter((key) => isEmpty(body[key]));
  if (missing.length === 0) return null;
  const labels = missing.map((k) => FIELD_LABELS[k] || k);
  return `Required: ${labels.join(', ')}`;
}

export function shouldValidateSetupCompletion(body, before) {
  return body.workflow_status === 'template' && before.workflow_status === 'details';
}

export function mergeTransactionForValidation(before, body) {
  const merged = { ...before };
  const keys = [
    'address', 'city', 'state', 'zip', 'representing', 'listing_visibility',
    'listing_date', 'important_date', 'close_date', 'acceptance_date', 'option_end_date',
  ];
  for (const key of keys) {
    if (key in body) {
      merged[key] = body[key] === '' || body[key] === undefined ? null : body[key];
    }
  }
  return merged;
}
