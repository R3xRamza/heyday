/** Parse "Austin, TX 78746" into separate parts */
export function parseLegacyCityLine(line) {
  if (!line?.trim()) return { city: null, state: null, zip: null };
  const trimmed = line.trim();
  const m = trimmed.match(/^([^,]+),\s*([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/);
  if (m) {
    return { city: m[1].trim(), state: m[2].toUpperCase(), zip: m[3] || null };
  }
  return { city: trimmed, state: null, zip: null };
}

/**
 * Normalize transaction address fields from body or legacy combined city string.
 */
export function normalizeAddressFields(addressOrBody, cityArg, stateArg, zipArg) {
  let street = '';
  let city = '';
  let state = '';
  let zip = '';

  if (typeof addressOrBody === 'object' && addressOrBody !== null) {
    street = addressOrBody.address?.trim() || '';
    city = addressOrBody.city?.trim() || '';
    state = addressOrBody.state?.trim() || '';
    zip = addressOrBody.zip?.trim() || '';
  } else {
    street = addressOrBody?.trim() || '';
    city = cityArg?.trim() || '';
    state = stateArg?.trim() || '';
    zip = zipArg?.trim() || '';
  }

  if (!city && !state && !zip && street.includes(',')) {
    const comma = street.indexOf(',');
    const legacy = parseLegacyCityLine(street.slice(comma + 1).trim());
    street = street.slice(0, comma).trim();
    city = legacy.city || '';
    state = legacy.state || '';
    zip = legacy.zip || '';
  } else if (city && !state && city.includes(',')) {
    const legacy = parseLegacyCityLine(city);
    city = legacy.city || city;
    state = legacy.state || state;
    zip = legacy.zip || zip;
  }

  return {
    address: street,
    city: city || null,
    state: state ? state.toUpperCase() : null,
    zip: zip || null,
  };
}

export function splitCombinedAddresses(db) {
  const rows = db.prepare(`
    SELECT id, address, city, state, zip FROM transactions
  `).all();

  const update = db.prepare(
    'UPDATE transactions SET address = ?, city = ?, state = ?, zip = ? WHERE id = ?',
  );
  let count = 0;

  db.transaction(() => {
    for (const row of rows) {
      const normalized = normalizeAddressFields({
        address: row.address,
        city: row.city,
        state: row.state,
        zip: row.zip,
      });
      if (
        normalized.address !== row.address
        || normalized.city !== row.city
        || normalized.state !== row.state
        || normalized.zip !== row.zip
      ) {
        update.run(
          normalized.address,
          normalized.city,
          normalized.state,
          normalized.zip,
          row.id,
        );
        count += 1;
      }
    }
  })();

  return count;
}
