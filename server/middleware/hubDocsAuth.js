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

/** Cookie session, or HUB_AGENT_TOKEN for the feedback list only. */
export function hubDocsAuth(req, res, next) {
  const provided = bearerToken(req);
  if (!provided) return authMiddleware(req, res, next);

  const expected = process.env.HUB_AGENT_TOKEN?.trim();
  if (!expected || !tokensMatch(provided, expected)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.hubAgent = true;
  req.user = { id: null, role: 'agent', name: 'Hub agent' };
  return next();
}
