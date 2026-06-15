# HEYDAY

Real estate operations platform — Express/SQLite API + React/Vite SPA.

## Status (updated 2026-06-15)

**Production:** Live on [Railway](https://railway.app) at `https://heyday-production-ce72.up.railway.app`  
**Source:** [github.com/R3xRamza/heyday](https://github.com/R3xRamza/heyday) (`main` synced)  
**Stage:** Team is starting real use. Persistent DB via Railway Volume + `DATABASE_PATH`.

### What works

| Area | Status |
|------|--------|
| Auth (JWT cookie) | ✅ |
| CRM / contacts (birthday, anniversary) | ✅ |
| Tasks (team + per-user + calendar) | ✅ |
| Transactions + checklists | ✅ |
| Checklist template editor (nicknames, assignees) | ✅ |
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
- Repo on GitHub (`R3xRamza/heyday`); `main` includes latest features
- `railway.toml` for consistent Railway builds
- `DATABASE_PATH` env support in `server/db.js` for persistent SQLite on volumes

### Sidebar & layout
- Collapsible sidebar (260px ↔ 72px) with `SidebarContext` + `localStorage` (`sidebar-collapsed-v1`)
- Fixed footer: compact user row, small logout link (expanded) / icon (collapsed)
- Task Hub `NavLink` uses `end` so “My tasks” (`/tasks/:userId`) does not also highlight Task Hub
- Sidebar nav label: **Marketing**; page TopNav title: **Marketing Calendar**

### Checklist template editor (`/checklists`)
- Multi-line **Full title** textarea per template task
- **Calendar nickname** field — short labels for calendar chips (auto-generated on migrate via `deriveNickname.js`)
- **Default assignee** dropdown per task (Tessa/Adam/Margaret/Meredith by role → `default_role`)
- Nicknames display on Marketing Calendar and Task Hub calendar via `template_tasks.calendar_nickname` join

### Marketing Calendar
- Day cells render **Social → Tasks → Milestones**
- Friday toolbar milestones popover: Fri celebrations, separator, weekend; **Birthdays** button with empty state
- **Month birthday planner** (`MonthBirthdaysModal`): pin which CRM birthdays show on grid; add birthday from CRM search
- `marketing_birthday_pins` table + `GET/PUT /api/marketing/birthday-pins`
- Double-click empty day cell → new post modal with date pre-filled
- Social post **done** status (crossed-out chips in grid)
- Task chips use calendar nickname when set

### CRM
- `PATCH /api/crm/:id` accepts `birthday` and `anniversary` for contact edits from marketing modals

## Project layout

```
heyday/
├── client/          React SPA (Vite + Tailwind)
├── server/          Express API + SQLite
├── railway.toml     Railway deploy config
├── heyday.db        Local SQLite (gitignored)
└── .cursor/rules/   Agent/project context
```
