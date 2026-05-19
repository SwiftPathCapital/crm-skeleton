# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Sales CRM for Swift Path Capital LLC (merchant cash advance). Runs as both an Electron desktop app and a Railway-hosted web app from the same React codebase.

- **Live URL**: https://crm-skeleton-production.up.railway.app
- **GitHub**: https://github.com/SwiftPathCapital/crm-skeleton
- **Supabase project**: `sdlosxhgqakrumhtzsns`

---

## Commands

```bash
npm run dev          # Electron app with hot reload
npm run build:web    # Build web app → server/dist/ (what Railway deploys)
npm run build        # Build Electron app
npm run build:win    # Build Windows installer
node server/index.js # Run Express backend alone (port 3001)
npx supabase db push # Push migrations to Supabase (project already linked)
```

Railway auto-deploys on every push to `master`. No manual deploy step needed.

---

## Architecture

**Dual-target build**: The same React source (`src/renderer/src/`) builds to:
- `dist-electron/renderer/` via `electron-vite` for the desktop app
- `server/dist/` via `vite.web.config.js` for the web app (served by Express)

**API_BASE detection**: Every file that calls the Express backend checks `window.location?.protocol === "file:"`. If true (Electron), routes to `http://localhost:3001`. Otherwise uses same-origin (Railway). This pattern appears in `AppContext.jsx`, `SoftPhone.jsx`, `Settings.jsx`, and others — keep it consistent.

**Page slot mounting** (`App.jsx`): All pages are permanently mounted using `<PageSlot>` wrappers that toggle `display: none`. This keeps the SoftPhone WebRTC connection, Zoho email session, and other stateful components alive during navigation. Never unmount a page that holds long-lived connections.

**AppContext** (`context/AppContext.jsx`): Provides `userId`, `agent` (full agents row), `zohoConnected`, and `disconnectZoho` to the entire app. The `agent` object is the source of truth for the current user's role, SIP credentials, and DID — always read from `useApp()`, never re-fetch in components.

---

## SoftPhone (Critical)

`SoftPhone.jsx` is the most complex page. Key behaviors:

- **TelnyxRTC initialization**: `{ login: agent.sip_username, password: agent.sip_password }`. Client is created in a `useEffect` keyed to SIP credentials — reconnects automatically if credentials change.
- **Microphone selection**: `getRealMicConstraints()` enumerates `audioinput` devices and filters out loopback devices (Stereo Mix, Wave Out, etc.) before passing a `deviceId` constraint to `newCall()`. The SDK owns the `getUserMedia` call — do NOT pre-capture the stream yourself, as double-capturing the same device mutes the track.
- **Outbound calls**: Pass `audio: audioConstraints` (from `getRealMicConstraints()`) directly to `newCall()`. No `localStream` param.
- **Inbound calls**: `answer()` receives `{ audio: audioConstraints, video: false }`.
- **Remote audio**: Attached to a hidden `<audio ref={audioRef}>` element on call active state.
- **SIP credentials**: Must be set in the `agents` table (via Agent Management page) — NOT in the Settings page's `agent_sip` JSON blob, which is disconnected from the softphone.

---

## Database

All tables use RLS. Pattern for new tables: enable RLS, add policies for `authenticated` role. Migrations go in `supabase/migrations/`.

| Table | Purpose |
|---|---|
| `agents` | One row per auth user; holds `role`, `sip_username`, `sip_password`, `did` |
| `leads` | `assigned_to = null` = unassigned (visible to all agents) |
| `lead_comments` | Notes per lead |
| `calls` | Written on hangup by SoftPhone and by Telnyx webhook |
| `sms_conversations` / `sms_messages` | SMS thread per contact |
| `zoho_tokens` | Per-agent OAuth tokens; auto-refreshed server-side |
| `settings` | Key/value store used by Settings page |

**Zoho token refresh**: `getZohoToken(agentId)` in `server/index.js` refreshes automatically if within 5 minutes of expiry. Every Zoho API route calls this first.

---

## Settings Page — Known Disconnects

The `Settings.jsx` page saves to the `settings` table but several sections are not wired to actual app behavior:

- **Agent SIP section** — saves to `settings.agent_sip` JSON blob; softphone reads from `agents` table. Use **Agent Management** to change SIP credentials.
- **DID assignment** — saves to `settings.phone_dids`; softphone reads `agents.did`. Agent Management is the correct place.
- **Call recording toggle, ring timeout, dispositions, campaign schedule, branding** — all persisted but not yet read by any app logic.
- **Telnyx API key in Settings** — saved to DB; server reads from `.env`. Changing it in the UI has no effect on the running server.

---

## Auth & Roles

- **admin**: sees all leads; has Admin Dashboard, Agent Management, Agent Leads, Settings in sidebar
- **agent**: sees only `assigned_to = userId OR assigned_to IS NULL` leads

Role is set in the `agents` table. The Settings page is admin-only via `agent?.role !== "admin"` check.

---

## Server (`server/index.js`)

Single-file Express server. All routes are in one file — if it grows past ~600 lines, split into route modules. Key routes:

| Route | Purpose |
|---|---|
| `POST /sms` | Send SMS via Telnyx |
| `GET /api/active-calls` | Poll live calls from Telnyx |
| `POST /webhook/telnyx` | Telnyx event handler — writes call records |
| `GET/POST /auth/zoho*` | Zoho OAuth flow |
| `GET/POST /api/emails/*` | Proxy to Zoho Mail |
| `GET/POST/DELETE /api/calendar/events*` | Proxy to Zoho Calendar |
| `POST /api/send-application` | Email MCA app to submissions address |

---

## Environment Variables

In `.env` at root (gitignored). Set the same values in Railway for production.

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
TELNYX_API_KEY
TELNYX_PHONE_NUMBER
TELNYX_SIP_USERNAME      # fallback only — agents use their own from agents table
TELNYX_SIP_PASSWORD      # fallback only
ZOHO_CLIENT_ID
ZOHO_CLIENT_SECRET
```

`VITE_TWILIO_*` vars are present in `.env` but Twilio is not used — Telnyx handles all calling and SMS.

---

## Pages Status

| Page | Status |
|---|---|
| Login, MyLeads, SoftPhone, EmailClient, CalendarPage, AdminDashboard, AgentManagement, AgentLeads, Messaging, NewApplication, Settings | Functional |
| DealPipeline, Clients, ScriptsPage | Empty placeholder |
| Documents tab (in LeadExpandedRow) | UI stub — upload not implemented |
