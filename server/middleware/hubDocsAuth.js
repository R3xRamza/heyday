import { timingSafeEqual } from 'crypto';
import { authMiddleware } from './auth.js';

function bearerToken(req) {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match ? match[1] : null;
}

function tokensMatch(provided, expected) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function asHubAgent(req) {
  req.hubAgent = true;
  req.user = { id: null, role: 'agent', name: 'Hub agent' };
}

/**
 * Logged-in users keep full access.
 * Anyone can list Feedback and mark a feedback bullet complete.
 * Creating, editing text, deleting, and hub_edits still require a login.
 */
export function hubDocsAuth(req, res, next) {
  const provided = bearerToken(req);
  const expected = process.env.HUB_AGENT_TOKEN?.trim();
  if (provided && expected && tokensMatch(provided, expected)) {
    asHubAgent(req);
    return next();
  }

  if (req.cookies?.token) return authMiddleware(req, res, next);

  const publicGet = req.method === 'GET' && String(req.query.section || '') === 'feedback';
  const publicPatch = req.method === 'PATCH';
  if (publicGet || publicPatch) {
    asHubAgent(req);
    return next();
  }

  return authMiddleware(req, res, next);
}
