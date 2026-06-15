/** Configured team mailboxes for Gmail sync */
export const GMAIL_MAILBOXES = (
  process.env.GMAIL_SYNC_MAILBOXES ||
  'meredith@theheydaygroup.com,tessa@theheydaygroup.com,margaret@theheydaygroup.com'
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'openid',
  'email',
  'profile',
];

export async function getOAuthClientAsync() {
  const { google } = await import('googleapis');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/gmail/callback';
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}
