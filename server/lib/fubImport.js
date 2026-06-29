/** Map Follow Up Boss CSV row → contacts table row */

const TEAM_NAME_MAP = {
  'meredith alderson': 'meredith@theheydaygroup.com',
  'tessa osborn': 'tessa@theheydaygroup.com',
  'adam walding': 'adam@theheydaygroup.com',
  'margaret analyst': 'margaret@theheydaygroup.com',
  'margaret manifold': 'margaret@theheydaygroup.com',
  'lisa harrell': null,
};

const PARTNER_RELATIONSHIP_TYPES = /^(spouse|partner|wife|husband|fiance|girlfriend)$/i;
const NON_PARTNER_RELATIONSHIP_TYPES = /^(child|son|daughter|daugther|dad|mom|father|mother|parent|mil|fil|brother)$/i;

function trim(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function parseBool(v) {
  if (!v) return 0;
  const s = String(v).trim().toLowerCase();
  return s === 'yes' || s === 'true' || s === '1' ? 1 : 0;
}

function parseDate(v) {
  const s = trim(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parsePrice(v) {
  const s = trim(v);
  if (!s) return null;
  const n = Number(String(s).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function relationshipName(row, index) {
  const name = [
    trim(row[`Relationship ${index} First Name`]),
    trim(row[`Relationship ${index} Last Name`]),
  ]
    .filter(Boolean)
    .join(' ');
  return name || null;
}

function hasPartnerBirthday(row) {
  return !!(parseDate(row['Birthday - Partner']) || trim(row['Birthday - Partner']));
}

export function resolveAssignedUserId(assignedName, usersByName) {
  const name = trim(assignedName);
  if (!name || name.includes('\n') || name.length > 80) return null;
  const key = name.toLowerCase();
  const email = TEAM_NAME_MAP[key];
  if (email && usersByName[email]) return usersByName[email];
  for (const [n, id] of Object.entries(usersByName)) {
    if (n.toLowerCase() === key) return id;
  }
  return null;
}

export function derivePartnerName(row) {
  for (let i = 1; i <= 4; i++) {
    const type = trim(row[`Relationship ${i} Type`]);
    if (!type || !PARTNER_RELATIONSHIP_TYPES.test(type)) continue;
    const name = relationshipName(row, i);
    if (name) return name;
  }

  if (!hasPartnerBirthday(row)) return null;

  for (let i = 1; i <= 4; i++) {
    const type = trim(row[`Relationship ${i} Type`]) || '';
    if (type && NON_PARTNER_RELATIONSHIP_TYPES.test(type)) continue;
    if (type && !PARTNER_RELATIONSHIP_TYPES.test(type)) continue;
    const name = relationshipName(row, i);
    if (name) return name;
  }

  for (let i = 1; i <= 4; i++) {
    const name = relationshipName(row, i);
    if (name) return name;
  }

  return null;
}

function derivePersonType(row) {
  const stage = trim(row.Stage) || '';
  return /kids of closed clients/i.test(stage) ? 'child' : 'contact';
}

export function mapFubRow(row, usersByName = {}) {
  const first = trim(row['First Name']);
  const last = trim(row['Last Name']);
  const name = trim(row.Name) || [first, last].filter(Boolean).join(' ') || 'Unknown';

  return {
    external_id: trim(row.ID),
    date_added: parseDate(row['Date Added']),
    first_name: first,
    last_name: last,
    name,
    stage: trim(row.Stage),
    lead_source: trim(row['Lead Source']),
    assigned_to_name: trim(row['Assigned To'])?.split('\n')[0]?.trim() || null,
    last_assigned: parseDate(row['Last Assigned']),
    is_contacted: parseBool(row['Is Contacted']),
    listing_price: parsePrice(row['Listing Price']),
    tags: trim(row.Tags),
    timeframe: trim(row.Timeframe),
    email: trim(row['Email 1']),
    email_2: trim(row['Email 2']),
    phone: trim(row['Phone 1']),
    phone_2: trim(row['Phone 2']),
    street: trim(row['Address 1 - Street']),
    city: trim(row['Address 1 - City']),
    state: trim(row['Address 1 - State']),
    zip: trim(row['Address 1 - Zip']),
    country: trim(row['Address 1 - Country']),
    property_address: trim(row['Property Address']),
    property_city: trim(row['Property City']),
    property_state: trim(row['Property State']),
    property_zip: trim(row['Property Postal Code']),
    property_mls: trim(row['Property MLS Number']),
    property_price: parsePrice(row['Property Price']),
    last_contacted: parseDate(row['Last Contacted']),
    birthday: trim(row.Birthday) || parseDate(row.Birthday),
    anniversary: trim(row.Anniversary) || parseDate(row.Anniversary),
    partner_birthday: parseDate(row['Birthday - Partner']) || trim(row['Birthday - Partner']),
    partner_name: derivePartnerName(row),
    kids_names: trim(row['Kids Names']),
    person_type: derivePersonType(row),
    home_anniversary: parseDate(row['Primary Home Purchase Date']) || trim(row['Primary Home Purchase Date']),
    company: trim(row.Company),
    sphere_source: trim(row['Sphere Source']),
    referred_by: trim(row['Referred By']),
    message: trim(row.Message),
    description: trim(row.Description),
    notes: trim(row.Notes),
    assigned_to: resolveAssignedUserId(row['Assigned To'], usersByName),
    status: trim(row.Stage) || 'prospect',
    raw_json: JSON.stringify(row),
  };
}

export const CONTACT_COLUMNS = [
  'external_id', 'date_added', 'first_name', 'last_name', 'name', 'stage', 'lead_source',
  'assigned_to_name', 'last_assigned', 'is_contacted', 'listing_price', 'tags', 'timeframe',
  'email', 'email_2', 'phone', 'phone_2', 'street', 'city', 'state', 'zip', 'country',
  'property_address', 'property_city', 'property_state', 'property_zip', 'property_mls',
  'property_price', 'last_contacted', 'birthday', 'anniversary', 'partner_birthday', 'partner_name',
  'kids_names', 'person_type', 'home_anniversary', 'company', 'sphere_source',
  'referred_by', 'message', 'description', 'notes', 'assigned_to', 'status', 'raw_json',
];
