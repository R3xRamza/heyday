const FUB_BASE_URL = 'https://api.followupboss.com/v1';
const PAGE_LIMIT = 100;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function basicAuthHeader(apiKey) {
  return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
}

function buildUrl(pathname, params = {}) {
  const cleanPath = String(pathname || '').replace(/^\/+/, '');
  const url = new URL(`${cleanPath}`, `${FUB_BASE_URL}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url;
}

async function fetchJson(url, apiKey, maxAttempts = 5) {
  let attempt = 0;
  let lastErr;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: basicAuthHeader(apiKey),
          Accept: 'application/json',
        },
      });

      if (res.ok) return res.json();

      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 500 * (2 ** (attempt - 1));
        await wait(delayMs);
        continue;
      }

      const text = await res.text();
      throw new Error(`FUB request failed (${res.status}): ${text}`);
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts) break;
      await wait(500 * (2 ** (attempt - 1)));
    }
  }

  throw lastErr || new Error('FUB request failed');
}

export async function fetchFubUsers(apiKey) {
  const url = buildUrl('/users', { limit: PAGE_LIMIT });
  const data = await fetchJson(url, apiKey);
  return data.users || [];
}

export function resolveFubUserId(users, fullName) {
  const target = String(fullName || '').trim().toLowerCase();
  if (!target) return null;
  const exact = users.find((u) => String(u.name || '').trim().toLowerCase() === target);
  if (exact) return exact.id;
  const fuzzy = users.find((u) => String(u.name || '').toLowerCase().includes(target));
  return fuzzy?.id || null;
}

export async function fetchAllPeopleForAssignedUser(apiKey, assignedUserId, fields) {
  let nextLink = null;
  let offset = 0;
  const people = [];
  let expectedTotal = null;

  while (true) {
    const url = nextLink
      ? new URL(nextLink)
      : buildUrl('/people', {
        assignedUserId,
        limit: PAGE_LIMIT,
        offset,
        fields: Array.isArray(fields) ? fields.join(',') : fields,
      });

    const data = await fetchJson(url, apiKey);
    const page = Array.isArray(data.people) ? data.people : [];
    people.push(...page);

    const meta = data._metadata || {};
    if (Number.isFinite(meta.total)) expectedTotal = meta.total;
    if (people.length > 0 && people.length % 1000 === 0) {
      console.log(`Fetched ${people.length} contacts from FUB...`);
    }

    if (meta.nextLink) {
      nextLink = meta.nextLink;
      continue;
    }

    if (meta.next) {
      nextLink = buildUrl('/people', { next: meta.next }).toString();
      continue;
    }

    if (page.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
  }

  return { people, expectedTotal };
}
