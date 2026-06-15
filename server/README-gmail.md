# Gmail integration for HEYDAY CRM

Sync team Gmail inboxes into contact activity timelines.

## Mailboxes (default)

Configured via `GMAIL_SYNC_MAILBOXES` (comma-separated):

- `meredith@theheydaygroup.com`
- `tessa@theheydaygroup.com`
- `margaret@theheydaygroup.com`

## Google Cloud setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. **APIs & Services → Enable APIs** → enable **Gmail API**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:3001/api/gmail/callback`
     - `https://heyday-production-ce72.up.railway.app/api/gmail/callback` (production)
5. **OAuth consent screen**
   - For Workspace: set to **Internal** if all users are on your Google Workspace domain.
   - Add scopes: Gmail read-only, email, profile, openid.

## Environment variables

Add to `.env` in project root (or export before `npm run dev`):

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/gmail/callback
GMAIL_SYNC_MAILBOXES=meredith@theheydaygroup.com,tessa@theheydaygroup.com,margaret@theheydaygroup.com
CLIENT_URL=http://localhost:5173
```

## Connecting mailboxes

1. Log in as **admin** (`admin@heyday.com` / `admin123`) to connect all three mailboxes.
2. Open **CRM** → Gmail mailboxes section → **Connect Gmail** for each address.
3. Sign in with the **matching** Google account (e.g. connect `meredith@theheydaygroup.com` while signed into that inbox).

Agents with `*@heyday.com` logins can connect their mapped Workspace mailbox (see `HEYDAY_TO_GMAIL` in `server/lib/gmailPermissions.js`).

## Sync behavior

- Sync runs in the background after **login** and when the dashboard loads.
- Manual **Sync all now** on CRM page.
- Optional: every 10 minutes while the session is open.
- Incremental sync uses `after:YYYY/MM/DD` from `last_sync_at` (max ~150 messages per mailbox per run).

## Import contacts (separate)

```bash
npm run import-crm
# or
node server/scripts/import-fub-contacts.js /path/to/export.csv
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Google OAuth not configured" | Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` |
| Wrong account on connect | Sign out of Google or use incognito; must match mailbox address |
| No emails on contact | Contact email must appear in From/To/Cc of synced messages |
| Sync slow | Normal on first run; later syncs are incremental |
