# Heyday Hub

Internal operations platform for **The Heyday Group**.

The team uses Hub for CRM, transactions, tasks, marketing, and revenue. Production lives at [hub.theheydaygroup.com](https://hub.theheydaygroup.com).

Access is limited to team members. Do not publish login credentials in this repository or anywhere else in git.

## Product

| Area | What it covers |
|------|----------------|
| Team Hub | Team operations home: stats, listings, expirations, messages |
| Task Hub | Team workload, per-person transaction tasks, admin tasks, and projects |
| CRM | Contacts, vendors, weekly touch-base (Closed and Under Contract), contact activity |
| Transactions | Listings and deals, parties, checklists, activity, commission |
| Opportunities | Buyer and seller pipelines, scoped to the selected agent |
| Marketing Calendar | Social posts, tasks, milestones, and birthday planning |
| Revenue | Commission analytics and per-agent eXp anniversary dates |
| Checklists | Shared template editor applied to transactions |
| Feedback | Shared team notes |

## Stack

- **API:** Node (ESM), Express, SQLite (`better-sqlite3`), JWT cookie auth
- **Client:** React 18, React Router, Vite, Tailwind
- **Hosting:** Railway, with a persistent volume for the database

## Local development

```bash
npm install
npm install --prefix client
npm run dev
```

- API: [http://localhost:3001](http://localhost:3001)
- Client: [http://localhost:5173](http://localhost:5173) (`/api` is proxied)

Use an existing team account. If you need access, ask an admin — never add passwords to this README or commit them to git.

The local database is `heyday.db` in the project root (gitignored). Migrations run when the server starts.

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | API (nodemon) + Vite client |
| `npm run build` | Production client build |
| `npm start` | Production server (serves `client/dist`) |
| `npm run import-crm` | Import Follow Up Boss contacts from a file |
| `npm run sync-crm-fub` | Sync Follow Up Boss contacts into Hub |
| `npm run seed-sample-transactions` | Load sample transactions (local only) |
| `npm run clear-transactions` | Clear transactions (local only) |
| `npm run backup:prod` | Back up the production database |

## Production

Config is in `railway.toml`:

- **Build:** `npm install && npm install --prefix client && npm run build`
- **Start:** `npm start`

Attach a Railway **Volume** at `/data` so the SQLite file survives redeploys. Set `DATABASE_PATH=/data/heyday.db`.

### Environment

Set these in Railway (or a local `.env`). Never commit real values.

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `production` in Railway |
| `JWT_SECRET` | Long random secret for auth cookies |
| `CLIENT_URL` | Full origin, e.g. `https://hub.theheydaygroup.com` |
| `DATABASE_PATH` | `/data/heyday.db` in production |
| `FUB_API_KEY` | Follow Up Boss API key |
| `FUB_ASSIGNED_USER_ID` | Optional FUB user id override |
| `FUB_DAILY_SYNC` | Set `0` to disable the daily FUB sync |
| `HUB_AGENT_TOKEN` | Optional. Listing Feedback and marking a bullet complete need no login |

Gmail OAuth variables are documented in [`server/README-gmail.md`](server/README-gmail.md).

## Follow Up Boss

Hub pulls contacts from Follow Up Boss. It does not write back.

- Scope: Meredith’s assigned contacts, excluding Trash and the Vendors stage
- Vendors in Hub (`/crm/vendors`) are a separate directory and are not modified by this sync
- In production, sync runs daily at 2:00 AM CST when `FUB_API_KEY` is set

```bash
npm run sync-crm-fub
```

## Commission, cap year, tasks, weekly picks

- **Referral fee** is always on the deal commission screen. It defaults to $0 and can be a percent or a dollar amount. It comes off gross first. Agent gross is what remains, and the eXp split is calculated from agent gross. A custom fee whose name contains “referral” and whose amount is greater than $0 is saved as that referral fee instead of disappearing.
- **eXp anniversary** is edited per agent on Revenue → Edit Split Templates. Meredith and Tessa are December 1. Margaret is January 1. Adam is blank, which keeps December 1–November 30 until a date is set. Each agent’s $16,000 cap uses the anniversary window that contains the deal’s close date.
- **New tasks** require a person. A transaction cannot launch from setup while a task has no person. On Team Task Hub, a row with no name can be assigned or deleted.
- **Weekly picks** on CRM Hub are five of Meredith’s Closed and Under Contract contacts. A new five is drawn every Sunday at 6:00 PM CST. The checkmark marks someone reached. The dice draws a replacement into that card. Reached people stay off the draw for six months and remain on the Contacted list. Hub does not write that reach back to Follow Up Boss.

## Repository layout

```
heyday/
├── client/                 React app
├── server/                 Express API, migrations, integrations
├── railway.toml            Railway build and start
└── heyday.db               Local SQLite (gitignored)
```
