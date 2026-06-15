import db from '../db.js';
import { getOAuthClientAsync } from './gmailConfig.js';
import { buildContactEmailIndex, extractEmailsFromHeaders } from './contactEmailIndex.js';

const MAX_MESSAGES_PER_SYNC = 150;
const SYNC_TIMEOUT_MS = 120000;

function headerValue(headers, name) {
  const h = headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

function parseEmailAddress(header) {
  const match = header?.match(/<([^>]+)>/) || header?.match(/([\w.+-]+@[\w.-]+\.\w+)/i);
  return (match?.[1] || header || '').trim().toLowerCase();
}

export async function getGmailClientForMailbox(gmailAddress) {
  const account = db.prepare('SELECT * FROM gmail_accounts WHERE gmail_address = ?').get(gmailAddress.toLowerCase());
  if (!account?.refresh_token) throw new Error(`Mailbox not connected: ${gmailAddress}`);

  const oauth2 = await getOAuthClientAsync();
  if (!oauth2) throw new Error('Google OAuth not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)');

  oauth2.setCredentials({
    refresh_token: account.refresh_token,
    access_token: account.access_token,
    expiry_date: account.token_expiry,
  });

  oauth2.on('tokens', (tokens) => {
    if (tokens.access_token) {
      db.prepare(`
        UPDATE gmail_accounts SET access_token = ?, token_expiry = ? WHERE gmail_address = ?
      `).run(tokens.access_token, tokens.expiry_date || null, gmailAddress.toLowerCase());
    }
  });

  const { google } = await import('googleapis');
  return google.gmail({ version: 'v1', auth: oauth2 });
}

/**
 * Match Gmail message participants to a contact.
 * Prefer primary email; if multiple matches, use lowest priority number from index.
 */
export function matchContactId(emailIndex, participantEmails, mailboxAddress) {
  const mailbox = mailboxAddress?.toLowerCase();
  const candidates = [];

  for (const email of participantEmails) {
    if (email === mailbox) continue;
    const id = emailIndex.get(email);
    if (id) candidates.push(id);
  }

  if (candidates.length === 0) return null;
  return candidates[0];
}

export function inferDirection(from, mailboxAddress) {
  const fromEmail = parseEmailAddress(from);
  if (fromEmail === mailboxAddress?.toLowerCase()) return 'outbound';
  return 'inbound';
}

export async function syncMailbox(gmailAddress, options = {}) {
  const started = Date.now();
  const stats = { mailbox: gmailAddress, imported: 0, skipped: 0, unmatched: 0, errors: 0 };

  try {
    const gmail = await getGmailClientForMailbox(gmailAddress);
    const emailIndex = buildContactEmailIndex();
    const mailbox = gmailAddress.toLowerCase();

    const account = db.prepare('SELECT last_sync_at FROM gmail_accounts WHERE gmail_address = ?').get(mailbox);
    let q = '';
    if (account?.last_sync_at && !options.full) {
      const d = new Date(account.last_sync_at);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      q = `after:${y}/${m}/${day}`;
    } else if (!options.full) {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      q = `after:${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    }

    const insert = db.prepare(`
      INSERT INTO contact_activity (
        contact_id, user_id, event_type, summary, body, subject, occurred_at,
        direction, mailbox, external_id, thread_id, metadata
      ) VALUES (?, ?, 'email', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(external_id) DO NOTHING
    `);

    let pageToken = null;
    let processed = 0;

    do {
      if (Date.now() - started > SYNC_TIMEOUT_MS) break;

      const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: q || undefined,
        maxResults: 50,
        pageToken: pageToken || undefined,
      });

      const messages = listRes.data.messages || [];
      if (messages.length === 0) break;

      for (const msg of messages) {
        if (processed >= MAX_MESSAGES_PER_SYNC) break;
        if (Date.now() - started > SYNC_TIMEOUT_MS) break;

        try {
          const full = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date'],
          });

          const headers = full.data.payload?.headers || [];
          const from = headerValue(headers, 'From');
          const to = headerValue(headers, 'To');
          const cc = headerValue(headers, 'Cc');
          const subject = headerValue(headers, 'Subject');
          const date = headerValue(headers, 'Date');
          const participants = extractEmailsFromHeaders(from, to, cc);

          const contactId = matchContactId(emailIndex, participants, mailbox);
          if (!contactId) {
            stats.unmatched++;
            processed++;
            continue;
          }

          const occurredAt = date ? new Date(date).toISOString() : new Date(Number(full.data.internalDate)).toISOString();
          const direction = inferDirection(from, mailbox);
          const snippet = full.data.snippet || '';

          const result = insert.run(
            contactId,
            null,
            subject || '(No subject)',
            snippet,
            subject || null,
            occurredAt,
            direction,
            mailbox,
            `gmail:${msg.id}`,
            full.data.threadId || null,
            JSON.stringify({ from, to, cc: cc || null })
          );

          if (result.changes > 0) stats.imported++;
          else stats.skipped++;
        } catch (e) {
          stats.errors++;
        }
        processed++;
      }

      pageToken = listRes.data.nextPageToken;
    } while (pageToken && processed < MAX_MESSAGES_PER_SYNC);

    db.prepare(`
      UPDATE gmail_accounts SET last_sync_at = CURRENT_TIMESTAMP, last_sync_error = NULL WHERE gmail_address = ?
    `).run(mailbox);

    stats.processed = processed;
    return stats;
  } catch (err) {
    db.prepare(`
      UPDATE gmail_accounts SET last_sync_error = ? WHERE gmail_address = ?
    `).run(err.message, gmailAddress.toLowerCase());
    throw err;
  }
}

const syncInProgress = new Set();

export async function triggerGmailSyncForUser(user) {
  const { mailboxesForSync } = await import('./gmailPermissions.js');
  const mailboxes = mailboxesForSync(user);
  const results = [];

  for (const mailbox of mailboxes) {
    const key = mailbox;
    if (syncInProgress.has(key)) continue;
    syncInProgress.add(key);
    try {
      const stats = await syncMailbox(mailbox);
      results.push({ ok: true, ...stats });
    } catch (e) {
      results.push({ ok: false, mailbox, error: e.message });
    } finally {
      syncInProgress.delete(key);
    }
  }

  return results;
}

export function triggerGmailSyncBackground(user) {
  setImmediate(() => {
    triggerGmailSyncForUser(user).catch((e) => console.error('[gmail sync]', e.message));
  });
}
