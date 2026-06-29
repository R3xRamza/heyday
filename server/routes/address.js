import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  normalizePlaceId,
  parsePlacesAddressComponents,
  placesApiKey,
  placesConfigured,
} from '../lib/placesAddress.js';

const router = Router();

const PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACES_BASE_URL = 'https://places.googleapis.com/v1/places';

/** Prefer greater Austin metro (bias, not hard restriction). */
const AUSTIN_LOCATION_BIAS = {
  circle: {
    center: { latitude: 30.2672, longitude: -97.7431 },
    radius: 50000,
  },
};

const lookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many address lookup requests. Try again in a minute.' },
});

router.use(lookupLimiter);

router.get('/status', (_req, res) => {
  res.json({ configured: placesConfigured() });
});

router.get('/autocomplete', async (req, res) => {
  const apiKey = placesApiKey();
  if (!apiKey) {
    return res.status(503).json({ error: 'Address lookup not configured' });
  }

  const q = String(req.query.q || '').trim();
  const session = String(req.query.session || '').trim();
  if (q.length < 3) {
    return res.json({ suggestions: [] });
  }
  if (!session) {
    return res.status(400).json({ error: 'session token required' });
  }

  try {
    const response = await fetch(PLACES_AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        input: q,
        includedRegionCodes: ['us'],
        includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
        locationBias: AUSTIN_LOCATION_BIAS,
        sessionToken: session,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Places autocomplete error:', data);
      return res.status(response.status >= 500 ? 502 : 400).json({
        error: data.error?.message || 'Address lookup failed',
      });
    }

    const suggestions = (data.suggestions || [])
      .map((item) => {
        const prediction = item.placePrediction;
        if (!prediction) return null;
        const placeId = normalizePlaceId(prediction.placeId || prediction.place);
        const label = prediction.text?.text
          || [prediction.structuredFormat?.mainText?.text, prediction.structuredFormat?.secondaryText?.text]
            .filter(Boolean)
            .join(', ');
        if (!placeId || !label) return null;
        return { placeId, label };
      })
      .filter(Boolean);

    res.json({ suggestions });
  } catch (err) {
    console.error('Places autocomplete fetch failed:', err);
    res.status(502).json({ error: 'Address lookup unavailable' });
  }
});

router.get('/place/:placeId', async (req, res) => {
  const apiKey = placesApiKey();
  if (!apiKey) {
    return res.status(503).json({ error: 'Address lookup not configured' });
  }

  const placeId = normalizePlaceId(req.params.placeId);
  const session = String(req.query.session || '').trim();
  if (!placeId) {
    return res.status(400).json({ error: 'placeId required' });
  }
  if (!session) {
    return res.status(400).json({ error: 'session token required' });
  }

  try {
    const response = await fetch(`${PLACES_BASE_URL}/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'addressComponents,formattedAddress',
        'X-Goog-Session-Token': session,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Places details error:', data);
      return res.status(response.status >= 500 ? 502 : 400).json({
        error: data.error?.message || 'Could not load address details',
      });
    }

    const fields = parsePlacesAddressComponents(data.addressComponents || []);
    res.json({
      ...fields,
      formattedAddress: data.formattedAddress || null,
    });
  } catch (err) {
    console.error('Places details fetch failed:', err);
    res.status(502).json({ error: 'Address lookup unavailable' });
  }
});

export default router;
