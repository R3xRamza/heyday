/** Representing / transaction type — stored value + UI label */
export const REPRESENTING_OPTIONS = [
  { value: 'seller', label: 'Seller' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller_and_buyer', label: 'Seller and Buyer' },
  { value: 'landlord', label: 'Landlord' },
  { value: 'tenant', label: 'Tenant' },
];

export const LISTING_VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'coming_soon', label: 'Coming Soon' },
];

export function normalizeListingVisibility(value) {
  if (value === 'private') return 'private';
  if (value === 'coming_soon') return 'coming_soon';
  return 'public';
}

export function isPrivateListing(tx) {
  return normalizeListingVisibility(tx?.listing_visibility) === 'private';
}

export function isComingSoonListing(tx) {
  return normalizeListingVisibility(tx?.listing_visibility) === 'coming_soon';
}

export function representingLabel(value) {
  return REPRESENTING_OPTIONS.find((o) => o.value === value)?.label
    || (value === 'both' || value === 'seller_and_client' ? 'Seller and Buyer' : value === 'leasing' ? 'Landlord' : value === 'renting' ? 'Tenant' : value);
}

export const TRANSACTION_STAGE_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'closed', label: 'Closed' },
];

const TRANSACTION_STAGE_LABELS = Object.fromEntries(
  TRANSACTION_STAGE_OPTIONS.map((o) => [o.value, o.label]),
);

export function transactionStageLabel(stage) {
  return TRANSACTION_STAGE_LABELS[stage] || stage || 'Active';
}

function isUnderContract(tx) {
  if (!tx || tx.stage === 'closed') return false;
  return tx.stage === 'pending' || Boolean(tx.close_date);
}

/** Label for counterparty name field(s) in setup / forms */
export function counterpartyNameLabel(representing) {
  return `${representingLabel(representing)} name`;
}

export function isDualCounterpartyRepresenting(representing) {
  return normalizeRepresenting(representing) === 'seller_and_buyer';
}

export const SALE_TYPE_TRADITIONAL = 'Traditional sale';
export const SALE_TYPE_RENT_LEASE = 'Rent/lease';

export const SALE_TYPE_OPTIONS = [
  { value: SALE_TYPE_TRADITIONAL, label: 'Traditional sale' },
  { value: SALE_TYPE_RENT_LEASE, label: 'Rent/lease' },
];

/** Sale type from representing: buyer/seller → traditional; landlord/tenant → rent/lease */
export function saleTypeForRepresenting(representing) {
  const r = normalizeRepresenting(representing);
  if (r === 'landlord' || r === 'tenant') return SALE_TYPE_RENT_LEASE;
  return SALE_TYPE_TRADITIONAL;
}

export function normalizeSaleType(value, representing) {
  if (!value || !String(value).trim()) {
    return saleTypeForRepresenting(representing);
  }
  const lower = String(value).toLowerCase();
  if (lower.includes('rent') || lower.includes('lease')) return SALE_TYPE_RENT_LEASE;
  return SALE_TYPE_TRADITIONAL;
}

/** Map legacy DB values to current selects */
export function normalizeRepresenting(value) {
  if (value === 'private_listing') return 'seller';
  if (value === 'both' || value === 'seller_and_client') return 'seller_and_buyer';
  if (value === 'leasing') return 'landlord';
  if (value === 'renting') return 'tenant';
  return value || 'seller';
}

export function isListingSideRepresenting(representing) {
  const r = normalizeRepresenting(representing);
  return r === 'seller' || r === 'seller_and_buyer' || r === 'landlord';
}

function portfolioTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Portfolio table type — distinct from transactionStageLabel (detail view). */
export function transactionPortfolioType(tx) {
  if (!tx) return 'Active';
  if (tx.stage === 'closed') return 'Closed';
  if (isUnderContract(tx)) return 'Pending';

  const today = portfolioTodayStr();
  const representing = normalizeRepresenting(tx.representing);
  const isListingSide = isListingSideRepresenting(representing);

  if (isListingSide && isComingSoonListing(tx)) {
    return 'Coming Soon';
  }

  if (isListingSide && tx.listing_date && tx.listing_date > today) {
    return 'Coming Soon';
  }

  if (isListingSide && tx.listing_date && tx.listing_date <= today && !tx.acceptance_date) {
    return 'Active listing';
  }

  return 'Active';
}

/** All date fields that may appear on a transaction timeline */
export const TIMELINE_DATE_KEYS = [
  'listing_date',
  'acceptance_date',
  'option_end_date',
  'close_date',
  'important_date',
];

export const TIMELINE_BY_REPRESENTING = {
  seller: [
    { key: 'listing_date', label: 'Listing date', icon: 'event_available' },
    { key: 'acceptance_date', label: 'Acceptance date', icon: 'verified' },
    { key: 'option_end_date', label: 'Option period end date', icon: 'pending_actions' },
    { key: 'close_date', label: 'Closing date', icon: 'key' },
    { key: 'important_date', label: 'Expiration date', icon: 'event_busy' },
  ],
  buyer: [
    { key: 'acceptance_date', label: 'Acceptance date', icon: 'verified' },
    { key: 'option_end_date', label: 'Option period end date', icon: 'pending_actions' },
    { key: 'close_date', label: 'Closing date', icon: 'key' },
  ],
  landlord: [
    { key: 'listing_date', label: 'Listing date', icon: 'event_available' },
    { key: 'acceptance_date', label: 'Acceptance date', icon: 'verified' },
    { key: 'close_date', label: 'Closing date', icon: 'key' },
  ],
  tenant: [
    { key: 'acceptance_date', label: 'Acceptance date', icon: 'verified' },
    { key: 'close_date', label: 'Closing date', icon: 'key' },
  ],
};

/** Critical dates timeline steps for the transaction dashboard */
export function getTimelineSteps(representing) {
  const r = normalizeRepresenting(representing);
  if (r === 'seller_and_buyer') return TIMELINE_BY_REPRESENTING.seller;
  return TIMELINE_BY_REPRESENTING[r] || TIMELINE_BY_REPRESENTING.seller;
}

export function getTimelineDateKeys(representing) {
  return getTimelineSteps(representing).map((s) => s.key);
}

/** Clear timeline date fields that do not apply to the new representing type */
export function datesToClearOnRepresentingChange(form, newRepresenting) {
  const allowed = new Set(getTimelineDateKeys(newRepresenting));
  const updates = {};
  const patch = {};
  for (const key of TIMELINE_DATE_KEYS) {
    if (!allowed.has(key) && form[key]) {
      updates[key] = null;
      patch[key] = '';
    }
  }
  return { updates, patch };
}

/** Timeline includes option period end (seller, buyer, etc.) */
export function showsOptionEndDate(representing) {
  return getTimelineDateKeys(representing).includes('option_end_date');
}

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
  important_date: 'Expiration date',
  close_date: 'Closing date',
  acceptance_date: 'Acceptance date',
  option_end_date: 'Option end date',
  representing: 'Representing',
  listing_visibility: 'Listing visibility',
};

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

export function validateTransactionFields(form) {
  const required = getRequiredTransactionFields(form.representing, form.listing_visibility);
  const missing = required.filter((key) => isEmpty(form[key]));
  if (missing.length === 0) {
    return { ok: true, missing: [] };
  }
  const labels = missing.map((k) => FIELD_LABELS[k] || k);
  return {
    ok: false,
    missing,
    message: `Please fill in required fields: ${labels.join(', ')}`,
  };
}
