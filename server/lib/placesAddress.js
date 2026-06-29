import { normalizeAddressFields } from './address.js';

function componentText(component) {
  return component?.longText || component?.shortText || '';
}

function findComponent(components, type) {
  return components.find((c) => c.types?.includes(type));
}

/**
 * Parse Google Places API (New) addressComponents into HEYDAY transaction fields.
 */
export function parsePlacesAddressComponents(components = []) {
  const streetNumber = componentText(findComponent(components, 'street_number'));
  const route = componentText(findComponent(components, 'route'));
  const address = [streetNumber, route].filter(Boolean).join(' ');

  const city = componentText(findComponent(components, 'locality'))
    || componentText(findComponent(components, 'sublocality'))
    || componentText(findComponent(components, 'administrative_area_level_3'))
    || '';

  const state = findComponent(components, 'administrative_area_level_1')?.shortText
    || findComponent(components, 'administrative_area_level_1')?.longText
    || '';

  const zip = componentText(findComponent(components, 'postal_code'));

  return normalizeAddressFields({ address, city, state, zip });
}

export function placesApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || '';
}

export function placesConfigured() {
  return Boolean(placesApiKey());
}

export function normalizePlaceId(placeId) {
  return String(placeId || '').replace(/^places\//, '');
}
