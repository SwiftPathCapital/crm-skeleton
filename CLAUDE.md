# Swift Path Capital CRM

Sales operations platform for Swift Path Capital LLC (merchant cash advance). Runs as an Electron desktop app and as a web app served from Railway.

- **Live URL**: https://crm-skeleton-production.up.railway.app
- **GitHub**: https://github.com/SwiftPathCapital/crm-skeleton
- **Supabase project**: `sdlosxhgqakrumhtzsns`

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Desktop wrapper | Electron 28 |
| Backend | Express (`server/index.js`) on port 3001 |
| Database | Supabase (Postgres + Auth + RLS) |
| SoftPhone | Telnyx WebRTC (`@telnyx/webrtc`) |
| SMS | Telnyx REST API |
| Email / Calendar | Zoho Mail + Zoho Calendar (OAuth) |
| Hosting | Railway — Docker, auto-deploys from `master` |

---

## Deployment

Railway builds and deploys automatically on every push to `master`. The Express server serves the React web build from `server/dist/` via a catch-all route. Zoho OAuth redirect URI is hardcoded to the Railway URL.

- **Zoho OAuth redirect**: `https://crm-skeleton-production.up.railway.app/auth/zoho/callback`
- **Web build output**: `server/dist/` (built with `npm run build:web`)
- **Electron build**: `dist-electron/` (built with `npm run build`)

---

## Development Workflow

```bash
# Install dependencies
npm install

# Run Electron app (dev mode with hot reload)
npm run dev

# Run Express backend separately (required for SMS, Zoho, Telnyx webhooks)
node server/index.js   # listens on port 3001

# Build web app (output → server/dist)
npm run build:web

# Build Electron app
npm run build

# Build Windows installer
npm run build:win

# Push DB migrations
npx supabase db push   # project already linked to sdlosxhgqakrumhtzsns
```

In Electron, `API_BASE` auto-detects the `file:` protocol and routes API calls to `http://localhost:3001`. In the web build, API calls go to the same origin (Railway).

All pages stay permanently mounted (`display: none` when inactive) via `PageSlot` wrappers in `App.jsx` — this keeps SoftPhone WebRTC connections and email sessions alive across navigation.

---

## Environment Variables

All values live in `.env` at the project root (gitignored). Also set these in Railway for production.

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_TWILIO_ACCOUNT_SID
VITE_TWILIO_PHONE_NUMBER
VITE_TWILIO_AUTH_TOKEN
TELNYX_API_KEY
TELNYX_PHONE_NUMBER
TELNYX_SIP_USERNAME
TELNYX_SIP_PASSWORD
ZOHO_CLIENT_ID
ZOHO_CLIENT_SECRET
```

---

## Pages

| Page | Route ID | Role | Purpose |
|---|---|---|---|
| `Login.jsx` | — | all | Supabase email/password auth |
| `MyLeads.jsx` | `my-leads` | all | Lead table with filtering, bulk assign/revoke, expanded detail |
| `DealPipeline.jsx` | `deal-pipeline` | all | Deal/opportunity pipeline view |
| `Clients.jsx` | `clients` | all | Client management |
| `ScriptsPage.jsx` | `scripts` | all | Call scripts and reference material |
| `EmailClient.jsx` | `email-client` | all | Zoho Mail client (inbox + compose) |
| `CalendarPage.jsx` | `calendar` | all | Zoho Calendar (view + create events) |
| `SoftPhone.jsx` | `softphone` | all | Telnyx WebRTC softphone + SMS conversations |
| `Messaging.jsx` | `messaging` | all | Standalone SMS messaging view |
| `NewApplication.jsx` | `new-application` | all | Iframe for external application form |
| `Settings.jsx` | `settings` | admin | App and user settings |
| `AdminDashboard.jsx` | `admin-dashboard` | admin | Live call board (5s polling) + softphone logs |
| `AgentManagement.jsx` | `agent-management` | admin | Create/edit agents, assign SIP credentials and DIDs |
| `AgentLeads.jsx` | `agent-leads` | admin | Assign and unassign leads per agent |

---

## Supabase Tables

| Table | Key Columns | Notes |
|---|---|---|
| `agents` | `id` (auth UUID), `full_name`, `email`, `role` (admin\|agent), `did`, `sip_username`, `sip_password` | One row per Supabase auth user |
| `leads` | `id` (UUID PK), `first_name`, `last_name`, `company_name`, `phone`, `lead_type` (ucc\|trigger\|aged\|web\|live_transfer), `status`, `assigned_to` (agent UUID, nullable) | `assigned_to = null` means unassigned; visible to all agents |
| `lead_comments` | `id`, `lead_id`, `agent_id`, `agent_name`, `content`, `created_at` | Notes tab in lead detail; RLS allows authenticated read/insert |
| `calls` | `id`, `lead_phone`, `agent_name`, `duration`, `disposition`, `recording_url`, `call_session_id` | Written by SoftPhone on hangup and by Telnyx webhook |
| `emails` | `id`, `lead_id`, `from_email`, `to_email`, `subject`, `body`, `zoho_message_id`, `sent_at` | Mirrored from Zoho on send; shown in lead Emails tab |
| `sms_conversations` | `id`, `contact_phone`, `contact_name`, `last_message`, `last_message_at`, `unread_count` | One row per SMS contact |
| `sms_messages` | `id`, `conversation_id`, `body`, `direction` (inbound\|outbound), `sent_at` | Individual SMS messages |
| `zoho_tokens` | `id` (agent UUID), `access_token`, `refresh_token`, `expires_at`, `account_id`, `calendar_uid`, `api_domain` | Token auto-refreshed server-side when within 5 min of expiry |

All tables use RLS. The pattern for new tables: enable RLS, add `SELECT` and `INSERT` (and `UPDATE`/`DELETE` as needed) policies for `authenticated` role. Migrations live in `supabase/migrations/`.

---

## Auth & Roles

Supabase Auth (email/password). On login, the `agents` row is fetched by `user.id` and stored in `AppContext`.

- **admin** — sees all leads; sees Admin Dashboard, Agent Management, Agent Leads, Settings in sidebar; can filter LeadTable by agent
- **agent** — sees only leads where `assigned_to = userId OR assigned_to IS NULL`

---

## Key Code Patterns

**Lead fetching** (`App.jsx`): paginated in 1000-row batches, stored in top-level state, passed as props. Admins get all leads; agents get filtered results.

**Supabase client** (`lib/supabaseClient.js`): imported directly into components and pages — no wrapper abstraction.

**TelnyxRTC** (`SoftPhone.jsx`): initialized with `{ login: sip_username, password: sip_password }`. `newCall()` options: `audio: true`, `video: false`, `debug: true`, `preferred_codecs: ['OPUS', 'PCMU']`.

**Zoho token refresh**: handled server-side in `getZohoToken()` — auto-refreshes if within 5 minutes of expiry before making any API call.

---

## Server Routes

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/sms` | Send SMS via Telnyx |
| `GET` | `/api/active-calls` | Fetch live calls from Telnyx connection IDs |
| `GET` | `/api/recordings` | Fetch call recordings from Telnyx |
| `POST` | `/webhook/telnyx` | Receive Telnyx events; writes hangup + recording to `calls` table |
| `GET` | `/auth/zoho` | Start Zoho OAuth flow |
| `GET` | `/auth/zoho/callback` | Exchange code, save tokens to `zoho_tokens` |
| `GET` | `/api/emails/inbox` | Proxy Zoho inbox |
| `GET` | `/api/emails/sent` | Proxy Zoho sent folder |
| `POST` | `/api/emails/send` | Send via Zoho; mirror to Supabase `emails` |
| `GET` | `/api/calendar/events` | Zoho Calendar events (next 30 days) |
| `POST` | `/api/calendar/events` | Create Zoho Calendar event |
| `DELETE` | `/api/calendar/events/:id` | Delete Zoho Calendar event |
| `POST` | `/api/send-application` | Email MCA application HTML to submissions@swiftpathtocapital.com via Zoho |

---

## Known Issues

- **SoftPhone audio**: Telnyx WebRTC audio reliability is under active investigation. `debug: true` is set on `newCall()` to capture console output. Local audio tracks are force-enabled on call active state. Remote stream is attached to a hidden `<audio>` element.
- **Documents tab**: The Documents section in the lead detail panel is a placeholder UI — file upload is not yet implemented.
- **Twilio vars**: `VITE_TWILIO_*` env vars are present but Twilio is not actively used; Telnyx handles calls and SMS.
