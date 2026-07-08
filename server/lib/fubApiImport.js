import { derivePartnerName, resolveAssignedUserId } from './fubImport.js';

function trim(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function parseDate(v) {
  const s = trim(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function firstValue(arr, prop = 'value') {
  if (!Array.isArray(arr)) return null;
  const primary = arr.find((item) => item?.isPrimary);
  if (primary && trim(primary[prop])) return trim(primary[prop]);
  const first = arr.find((item) => trim(item?.[prop]));
  return trim(first?.[prop]);
}

function secondValue(arr, prop = 'value') {
  if (!Array.isArray(arr)) return null;
  const vals = arr.map((item) => trim(item?.[prop])).filter(Boolean);
  return vals[1] || null;
}

function pickAddress(person) {
  const addresses = Array.isArray(person.addresses) ? person.addresses : [];
  if (!addresses.length) return {};
  const primary = addresses.find((a) => a?.isPrimary) || addresses[0];
  return {
    street: trim(primary?.street),
    city: trim(primary?.city),
    state: trim(primary?.state),
    zip: trim(primary?.code),
    country: trim(primary?.country),
  };
}

function toLegacyRelationshipRow(person) {
  const row = {};
  const rel = Array.isArray(person.relationships) ? person.relationships : [];
  rel.slice(0, 4).forEach((r, idx) => {
    const i = idx + 1;
    row[`Relationship ${i} Type`] = trim(r?.type || r?.relationship || r?.label);
    row[`Relationship ${i} First Name`] = trim(r?.firstName) || trim(r?.name)?.split(' ')?.[0] || null;
    row[`Relationship ${i} Last Name`] = trim(r?.lastName)
      || (trim(r?.name)?.split(' ').slice(1).join(' ') || null);
  });
  return row;
}

function stageToPersonType(stage) {
  return /kids of closed clients/i.test(String(stage || '')) ? 'child' : 'contact';
}

function getCustom(person, keys) {
  const fields = person.customFields || {};
  for (const key of keys) {
    if (fields[key] != null && fields[key] !== '') return fields[key];
    if (person[key] != null && person[key] !== '') return person[key];
  }
  return null;
}

export const FUB_CONTACT_FIELDS = [
  'id', 'created', 'updated', 'firstName', 'lastName', 'name',
  'stage', 'source', 'assignedTo', 'assignedUserId', 'contacted',
  'price', 'timeframeId', 'lastActivity',
  'tags', 'emails', 'phones', 'addresses', 'relationships',
  'customFields', 'allCustom',
];

export function mapFubApiPerson(person, usersByName = {}) {
  const first = trim(person.firstName);
  const last = trim(person.lastName);
  const fullName = trim(person.name) || [first, last].filter(Boolean).join(' ') || 'Unknown';
  const tags = Array.isArray(person.tags) ? person.tags.filter(Boolean).join(', ') : trim(person.tags);
  const addr = pickAddress(person);
  const related = toLegacyRelationshipRow(person);
  const birthday = getCustom(person, ['Birthday', 'birthday', 'customBirthday']);
  const anniversary = getCustom(person, ['Anniversary', 'anniversary', 'customAnniversary']);
  const partnerBirthday = getCustom(person, ['Birthday - Partner', 'birthdayPartner', 'customBirthdayPartner']);
  const kidsNames = getCustom(person, ['Kids Names', 'kidsNames', 'customKidsNames']);
  const homeAnniversary = getCustom(person, ['Primary Home Purchase Date', 'primaryHomePurchaseDate', 'customPrimaryHomePurchaseDate']);
  const sphereSource = getCustom(person, ['Sphere Source', 'sphereSource', 'customSphereSource']);
  const referredBy = getCustom(person, ['Referred By', 'referredBy', 'customReferredBy']);

  const legacyRow = {
    Name: fullName,
    'First Name': first,
    'Last Name': last,
    ID: person.id != null ? String(person.id) : null,
    Stage: trim(person.stage),
    'Lead Source': trim(person.source),
    'Assigned To': trim(person.assignedTo),
    'Last Assigned': parseDate(person.updated),
    'Is Contacted': person.contacted ? 'true' : 'false',
    'Listing Price': parseNumber(person.price),
    Tags: tags,
    Timeframe: trim(person.timeframe) || trim(person.timeframeId),
    'Email 1': firstValue(person.emails),
    'Email 2': secondValue(person.emails),
    'Phone 1': firstValue(person.phones),
    'Phone 2': secondValue(person.phones),
    'Address 1 - Street': addr.street,
    'Address 1 - City': addr.city,
    'Address 1 - State': addr.state,
    'Address 1 - Zip': addr.zip,
    'Address 1 - Country': addr.country,
    'Property Address': getCustom(person, ['Property Address', 'propertyAddress', 'customPropertyAddress']),
    'Property City': getCustom(person, ['Property City', 'propertyCity', 'customPropertyCity']),
    'Property State': getCustom(person, ['Property State', 'propertyState', 'customPropertyState']),
    'Property Postal Code': getCustom(person, ['Property Postal Code', 'propertyPostalCode', 'customPropertyPostalCode']),
    'Property MLS Number': getCustom(person, ['Property MLS Number', 'propertyMlsNumber', 'customPropertyMlsNumber']),
    'Property Price': getCustom(person, ['Property Price', 'propertyPrice', 'customPropertyPrice']),
    'Date Added': parseDate(person.created),
    'Last Contacted': parseDate(person.lastActivity),
    Birthday: birthday,
    Anniversary: anniversary,
    'Birthday - Partner': partnerBirthday,
    'Kids Names': kidsNames,
    'Primary Home Purchase Date': homeAnniversary,
    Company: trim(person.company),
    'Sphere Source': sphereSource,
    'Referred By': referredBy,
    Message: trim(person.message),
    Description: trim(person.description),
    Notes: trim(person.notes),
    ...related,
  };

  return {
    external_id: legacyRow.ID,
    date_added: parseDate(legacyRow['Date Added']),
    first_name: first,
    last_name: last,
    name: fullName,
    stage: trim(legacyRow.Stage),
    lead_source: trim(legacyRow['Lead Source']),
    assigned_to_name: trim(legacyRow['Assigned To'])?.split('\n')[0]?.trim() || null,
    last_assigned: parseDate(legacyRow['Last Assigned']),
    is_contacted: legacyRow['Is Contacted'] ? 1 : 0,
    listing_price: parseNumber(legacyRow['Listing Price']),
    tags: legacyRow.Tags,
    timeframe: trim(legacyRow.Timeframe),
    email: trim(legacyRow['Email 1']),
    email_2: trim(legacyRow['Email 2']),
    phone: trim(legacyRow['Phone 1']),
    phone_2: trim(legacyRow['Phone 2']),
    street: trim(legacyRow['Address 1 - Street']),
    city: trim(legacyRow['Address 1 - City']),
    state: trim(legacyRow['Address 1 - State']),
    zip: trim(legacyRow['Address 1 - Zip']),
    country: trim(legacyRow['Address 1 - Country']),
    property_address: trim(legacyRow['Property Address']),
    property_city: trim(legacyRow['Property City']),
    property_state: trim(legacyRow['Property State']),
    property_zip: trim(legacyRow['Property Postal Code']),
    property_mls: trim(legacyRow['Property MLS Number']),
    property_price: parseNumber(legacyRow['Property Price']),
    last_contacted: parseDate(legacyRow['Last Contacted']),
    birthday: trim(legacyRow.Birthday) || parseDate(legacyRow.Birthday),
    anniversary: trim(legacyRow.Anniversary) || parseDate(legacyRow.Anniversary),
    partner_birthday: parseDate(legacyRow['Birthday - Partner']) || trim(legacyRow['Birthday - Partner']),
    partner_name: derivePartnerName(legacyRow),
    kids_names: trim(legacyRow['Kids Names']),
    person_type: stageToPersonType(legacyRow.Stage),
    home_anniversary: parseDate(legacyRow['Primary Home Purchase Date']) || trim(legacyRow['Primary Home Purchase Date']),
    company: trim(legacyRow.Company),
    sphere_source: trim(legacyRow['Sphere Source']),
    referred_by: trim(legacyRow['Referred By']),
    message: trim(legacyRow.Message),
    description: trim(legacyRow.Description),
    notes: trim(legacyRow.Notes),
    assigned_to: resolveAssignedUserId(legacyRow['Assigned To'], usersByName),
    status: trim(legacyRow.Stage) || 'prospect',
    raw_json: JSON.stringify(person),
  };
}
