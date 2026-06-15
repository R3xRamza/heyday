import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { GMAIL_MAILBOXES, GMAIL_SCOPES, getOAuthClientAsync } from '../lib/gmailConfig.js';
import { canManageMailbox, isAdmin, mailboxesForSync } from '../lib/gmailPermissions.js';
import { syncMailbox, triggerGmailSyncForUser, triggerGmailSyncBackground } from '../lib/gmailSync.js';

const router = Router();

const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many sync requests. Try again in a minute.' },
});

const pendingOAuth = new Map();

function sanitizeAccount(row) {
  if (!row) return null;
  const { refresh_token, access_token, ...safe } = row;
  return safe;
}

router.get('/status', authMiddleware, (req, res) => {
  const accounts = db.prepare('SELECT * FROM gmail_accounts').all();
  const byEmail = Object.fromEntries(accounts.map((a) => [a.gmail_address, sanitizeAccount(a)]));

  const mailboxes = GMAIL_MAILBOXES.map((address) => {
    const acc = byEmail[address];
    const canConnect = canManageMailbox(req.user, address);
    return {
      address,
      connected: Boolean(acc?.refresh_token),
      last_sync_at: acc?.last_sync_at || null,
      last_sync_error: acc?.last_sync_error || null,
      canConnect,
      canDisconnect: canConnect && Boolean(acc),
    };
  });

  const syncing = mailboxesForSync(req.user).length;

  res.json({
    mailboxes,
    configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    allowedToSync: syncing,
  });
});

router.get('/connect', authMiddleware, async (req, res) => {
  const mailbox = (req.query.mailbox || '').trim().toLowerCase();
  if (!GMAIL_MAILBOXES.includes(mailbox)) {
    return res.status(400).json({ error: 'Invalid mailbox' });
  }
  if (!canManageMailbox(req.user, mailbox)) {
    return res.status(403).json({ error: 'Not allowed to connect this mailbox' });
  }

  const oauth2 = await getOAuthClientAsync();
  if (!oauth2) {
    return res.status(503).json({ error: 'Google OAuth not configured. See server/README-gmail.md' });
  }

  const state = `${req.user.id}:${mailbox}:${Date.now()}`;
  pendingOAuth.set(state, { userId: req.user.id, mailbox });

  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state,
  });

  res.json({ url });
});

router.get('/callback', async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${clientUrl}/crm?gmail=error&message=${encodeURIComponent(error)}`);
  }

  const pending = pendingOAuth.get(state);
  pendingOAuth.delete(state);
  if (!pending || !code) {
    return res.redirect(`${clientUrl}/crm?gmail=error&message=invalid_state`);
  }

  try {
    const oauth2 = await getOAuthClientAsync();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    const { google } = await import('googleapis');
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
    const profile = await oauth2Api.userinfo.get();
    const googleEmail = profile.data.email?.toLowerCase();

    if (googleEmail !== pending.mailbox) {
      return res.redirect(
        `${clientUrl}/crm?gmail=error&message=${encodeURIComponent(`Signed in as ${googleEmail}, expected ${pending.mailbox}`)}`
      );
    }

    const existing = db.prepare('SELECT id FROM gmail_accounts WHERE gmail_address = ?').get(pending.mailbox);
    if (existing) {
      db.prepare(`
        UPDATE gmail_accounts SET
          refresh_token = ?, access_token = ?, token_expiry = ?,
          connected_by_user_id = ?, connected_at = CURRENT_TIMESTAMP,
          sync_enabled = 1, last_sync_error = NULL
        WHERE gmail_address = ?
      `).run(
        tokens.refresh_token,
        tokens.access_token,
        tokens.expiry_date,
        pending.userId,
        pending.mailbox
      );
    } else {
      db.prepare(`
        INSERT INTO gmail_accounts (
          gmail_address, heyday_user_id, refresh_token, access_token, token_expiry,
          connected_by_user_id, sync_enabled
        ) VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(
        pending.mailbox,
        pending.userId,
        tokens.refresh_token,
        tokens.access_token,
        tokens.expiry_date,
        pending.userId
      );
    }

    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(pending.userId);
    if (user) triggerGmailSyncBackground(user);

    res.redirect(`${clientUrl}/crm?gmail=connected&mailbox=${encodeURIComponent(pending.mailbox)}`);
  } catch (e) {
    console.error('[gmail callback]', e);
    res.redirect(`${clientUrl}/crm?gmail=error&message=${encodeURIComponent(e.message)}`);
  }
});

router.post('/disconnect', authMiddleware, (req, res) => {
  const mailbox = (req.body.mailbox || '').trim().toLowerCase();
  if (!canManageMailbox(req.user, mailbox)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  db.prepare('DELETE FROM gmail_accounts WHERE gmail_address = ?').run(mailbox);
  res.json({ ok: true });
});

router.post('/sync', authMiddleware, syncLimiter, async (req, res) => {
  try {
    const results = await triggerGmailSyncForUser(req.user);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export { triggerGmailSyncBackground };
export default router;
