# HEYDAY

Real estate operations platform — Express/SQLite API + React/Vite SPA.

## Status (updated 2026-06-15)

**Production:** Live on [Railway](https://railway.app) at `https://heyday-production-ce72.up.railway.app`  
**Source:** [github.com/R3xRamza/heyday](https://github.com/R3xRamza/heyday)  
**Stage:** Team is starting real use. Persistent DB via Railway Volume + `DATABASE_PATH`.

### What works

| Area | Status |
|------|--------|
| Auth (JWT cookie) | ✅ |
| CRM / contacts | ✅ |
| Tasks (team + per-user) | ✅ |
| Transactions + checklists | ✅ |
| Marketing Calendar | ✅ |
| Revenue / Team ops | ✅ |
| Gmail CRM sync | Optional (OAuth env vars) |

### Default logins (seeded on fresh DB)

| User | Email | Password | Role |
|------|-------|----------|------|
| Admin | `admin@heyday.com` | `admin123` | admin |
| Tessa | `tessa@heyday.com` | `heyday123` | operations |
| Adam | `adam@heyday.com` | `heyday123` | marketing |
| Margaret | `margaret@heyday.com` | `heyday123` | analyst |
| Meredith | `meredith@heyday.com` | `heyday123` | owner_lead |

Change these before broader production use.

## Local development

```bash
npm install
npm install --prefix client
npm run dev
```

- API: http://localhost:3001  
- Client: http://localhost:5173  
- Login: `admin@heyday.com` / `admin123`

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | API (nodemon) + Vite client |
| `npm run build` | Production client build |
| `npm start` | Production server (serves `client/dist`) |
| `npm run import-crm` | Import FUB contacts |
| `npm run seed-sample-transactions` | Sample transactions |
| `npm run clear-transactions` | Clear transactions |

## Railway deployment

Config in `railway.toml`:

- **Build:** `npm install && npm install --prefix client && npm run build`
- **Start:** `npm start`

### Required env vars

| Variable | Example |
|----------|---------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | long random string |
| `CLIENT_URL` | `https://heyday-production-ce72.up.railway.app` |
| `DATABASE_PATH` | `/data/heyday.db` (with Volume mounted at `/data`) |

Optional Gmail: see `server/README-gmail.md`.

### Data persistence

SQLite defaults to `heyday.db` in the project root locally. On Railway, attach a **Volume** at `/data` and set `DATABASE_PATH=/data/heyday.db` so data survives redeploys.

## Changelog — 2026-06-15

### Deploy & infrastructure
- Pushed repo to GitHub (`R3xRamza/heyday`)
- Added `railway.toml` for consistent Railway builds
- Added `DATABASE_PATH` env support in `server/db.js` for persistent SQLite on volumes

### Sidebar & layout
- Collapsible sidebar (260px ↔ 72px) with `SidebarContext` + `localStorage` (`sidebar-collapsed-v1`)
- Fixed footer: compact user row, small logout link (expanded) / icon (collapsed)
- Task Hub `NavLink` uses `end` so “My tasks” (`/tasks/:userId`) does not also highlight Task Hub
- Sidebar nav label: **Marketing**; page TopNav title: **Marketing Calendar**

### Marketing Calendar
- Day cells render **Social → Tasks → Milestones** (was Tasks → Social)
- Friday toolbar milestones popover: fetches Fri–Sun; Friday items, separator, then weekend; button “{n} upcoming” on Fridays

## Project layout

```
heyday/
├── client/          React SPA (Vite + Tailwind)
├── server/          Express API + SQLite
├── railway.toml     Railway deploy config
├── heyday.db        Local SQLite (gitignored)
└── .cursor/rules/   Agent/project context
```
