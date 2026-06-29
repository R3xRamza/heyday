import db from '../db.js';
import { GMAIL_MAILBOXES } from './gmailConfig.js';

/** Adam uses Margaret's Workspace inbox for Gmail sync */
export const HEYDAY_TO_GMAIL = {
  'adam@theheydaygroup.com': 'margaret@theheydaygroup.com',
};

export function isAdmin(user) {
  return user?.role === 'admin';
}

export function gmailForHeydayUser(user) {
  return HEYDAY_TO_GMAIL[user?.email?.toLowerCase()] || user?.email?.toLowerCase();
}

/** Agent may connect mailbox if it matches their HEYDAY/Workspace email or they are assigned */
export function canManageMailbox(user, mailbox) {
  const addr = mailbox?.trim()?.toLowerCase();
  if (!addr || !GMAIL_MAILBOXES.includes(addr)) return false;
  if (isAdmin(user)) return true;

  const userEmail = user.email?.toLowerCase();
  if (userEmail === addr || gmailForHeydayUser(user) === addr) return true;

  const row = db.prepare('SELECT heyday_user_id FROM gmail_accounts WHERE gmail_address = ?').get(addr);
  if (row?.heyday_user_id === user.id) return true;

  return false;
}

/** Mailboxes this user is allowed to sync */
export function mailboxesForSync(user) {
  const linked = db.prepare(`
    SELECT gmail_address FROM gmail_accounts WHERE sync_enabled = 1 AND refresh_token IS NOT NULL
  `).all();

  if (isAdmin(user)) {
    return linked.map((r) => r.gmail_address);
  }

  return linked
    .map((r) => r.gmail_address)
    .filter((addr) => canManageMailbox(user, addr));
}
