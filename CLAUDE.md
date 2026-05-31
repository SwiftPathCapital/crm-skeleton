# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Sales CRM for Swift Path Capital LLC (merchant cash advance). Runs as both an Electron desktop app and a Railway-hosted web app from the same React codebase.

- **Live URL**: https://crm-skeleton-production.up.railway.app
- **GitHub**: https://github.com/SwiftPathCapital/crm-skeleton
- **Supabase project**: `sdlosxhgqakrumhtzsns`

---

## Swift Path Capital — Full Product Ecosystem

All of these products are owned by Swift Path Capital and work together. When making changes, consider how they interact.

| Product | GitHub Repo | Live URL | Purpose |
|---|---|---|---|
| **CRM** (this repo) | `SwiftPathCapital/crm-skeleton` | crm-skeleton-production.up.railway.app | Agent CRM — leads, deals, calls, messaging, applications |
| **Marketing Site** | `SwiftPathCapital/Client-Consultation-Request` | swiftpathtocapital.com | Public landing page — lead capture form, company info |
| **DocuSeal** | Self-hosted on Railway | docuseal-railway-production-11b8.up.railway.app | E-signature platform — MCA applications sent from CRM |
| **Dialer** | `SwiftPathCapital/dialer-app` (private) | dialer.swiftpathcapital.net | Softphone/dialer for agents |
| **Legacy CRM** | `SwiftPathCapital/apex-crm` | — | Older CRM version, superseded by crm-skeleton |

### How They Connect

- **Marketing Site → CRM**: Lead capture form on swiftpathtocapital.com POSTs to `POST /api/leads/inbound` on the CRM server via `x-api-key` header (env var `INBOUND_LEADS_API_KEY`). Leads land directly in My Leads.
- **CRM → DocuSeal**: Applications page and Deal Pipeline drawer call `POST /api/docuseal/send` on the CRM server, which creates a DocuSeal submission and emails the client a signing link. Webhook at `POST /webhook/docuseal` updates status to `completed` when signed.
- **CRM → Dialer**: Sidebar links out to `dialer.swiftpathcapital.net` (external). No API integration currently.
- **CRM → Zoho**: Email and Calendar are proxied through the CRM server using per-agent OAuth tokens stored in `zoho_tokens` table.
- **CRM → Telnyx**: Calling (SIP via WebRTC) and SMS handled by Telnyx. Webhook at `POST /webhook/telnyx` writes call records.
- **CRM → Southend Capital**: Embedded iframe portal in sidebar (`portal.southendcapital.com`). No API — just a browser embed.
- **CRM → Supabase**: All data storage, auth, and file storage (lead documents, call recordings, deal docs, client docs).

### Railway Services

Two services run on Railway under the Swift Path Capital account:
1. **crm-skeleton** — Express server (`server/`) serving the React web app. Root directory: `server/`.
2. **DocuSeal** — Self-hosted DocuSeal instance.

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
**Always run `npm run build:web` before committing** — Railway serves `server/dist/`.

---

## Architecture

**Dual-target build**: The same React source (`src/renderer/src/`) builds to:
- `dist-electron/renderer/` via `electron-vite` for the desktop app
- `server/dist/` via `vite.web.config.js` for the web app (served by Express)

**API_BASE detection**: Every file that calls the Express backend checks `window.location?.protocol === "file:"`. If true (Electron), routes to `http://localhost:3001`. Otherwise uses same-origin (Railway). Keep this pattern consistent across all pages.

**Page slot mounting** (`App.jsx`): All pages are permanently mounted using `<PageSlot>` wrappers that toggle `display: none`. This keeps stateful connections (Zoho email session, etc.) alive during navigation. Never unmount a page that holds long-lived connections.

**AppContext** (`context/AppContext.jsx`): Provides `userId`, `agent` (full agents row), `zohoConnected`, `disconnectZoho`, and `getAuthToken` to the entire app. The `agent` object is the source of truth for the current user's role, SIP credentials, and DID — always read from `useApp()`, never re-fetch in components.

---

## Database

All tables use RLS. Pattern for new tables: enable RLS, add policies for `authenticated` role. Migrations go in `supabase/migrations/`.

| Table | Purpose |
|---|---|
| `agents` | One row per auth user; holds `role`, `sip_username`, `sip_password`, `did` |
| `leads` | `assigned_to = null` = unassigned (visible to all agents) |
| `lead_comments` | Notes per lead |
| `lead_documents` | Files uploaded per lead; stored in `lead-documents` Supabase bucket |
| `calls` | Written on hangup by Telnyx webhook |
| `callbacks` | Scheduled callbacks with reminder system |
| `sms_conversations` / `sms_messages` | SMS thread per contact |
| `zoho_tokens` | Per-agent OAuth tokens; auto-refreshed server-side |
| `settings` | Key/value store used by Settings page |
| `deals` | Deal pipeline records with stage, funding, commission fields |
| `offers` | Offers logged per deal |
| `clients` | Funded clients — auto-created when deal moves to Funded stage |
| `live_transfers` | Inbound live transfer records |
| `docuseal_submissions` | E-signature submissions sent via DocuSeal |
| `application_requests` | Legacy table; kept for history |

**Zoho token refresh**: `getZohoToken(agentId)` in `server/lib/zoho.js` refreshes automatically if within 5 minutes of expiry. Every Zoho API route calls this first.

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

## Server

Entry point: `server/index.js`. Routes are split into modules under `server/routes/`.

| Route file | Key routes |
|---|---|
| `routes/calls.js` | Telnyx calling, SMS, webhook, call recordings |
| `routes/zoho.js` | Zoho OAuth flow |
| `routes/emails.js` | Proxy to Zoho Mail |
| `routes/calendar.js` | Proxy to Zoho Calendar |
| `routes/agents.js` | Agent management |
| `routes/leads.js` | Application send (Zoho email), application request reject |
| `routes/docuseal.js` | `POST /api/docuseal/send`, `POST /webhook/docuseal` |
| `index.js` (inline) | `POST /api/leads/inbound` (public, x-api-key auth) |

---

## Environment Variables

In `.env` at root (gitignored). Set the same values in Railway for production.

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
TELNYX_API_KEY
TELNYX_PHONE_NUMBER
TELNYX_SIP_USERNAME          # fallback only — agents use their own from agents table
TELNYX_SIP_PASSWORD          # fallback only
ZOHO_CLIENT_ID
ZOHO_CLIENT_SECRET
OAUTH_STATE_SECRET           # required — server throws on startup if missing
INBOUND_LEADS_API_KEY        # shared secret for POST /api/leads/inbound
DOCUSEAL_URL                 # https://docuseal-railway-production-11b8.up.railway.app
DOCUSEAL_API_KEY             # from DocuSeal → Settings → API Tokens
DOCUSEAL_TEMPLATE_ID         # numeric ID of the MCA application template
```

---

## Pages Status

| Page | Status |
|---|---|
| Login, MyLeads, EmailClient, CalendarPage, AdminDashboard, AgentManagement, AgentLeads, Messaging, Settings | Functional |
| DealPipeline | Functional — kanban, offers, DocuSeal send, document upload |
| Clients | Functional — funded client records, notes, call recordings |
| ScriptsPage | Functional — Live Transfer and Webform scripts with interactive qual tracking |
| NewApplication (Applications) | Functional — DocuSeal send form + submission history |
| LiveTransfers | Functional |
| CallbacksPage | Functional |
| SouthendPortal | Functional — iframe embed (degrades to external link if blocked) |
| Documents tab (LeadExpandedRow) | Functional — upload/download via Supabase storage |
| Signatures tab (LeadExpandedRow) | Functional — DocuSeal send + submission history per lead |
