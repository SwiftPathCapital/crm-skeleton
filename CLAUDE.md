# Swift Path Capital — CRM

Electron desktop app (also deployable as a web app) for sales agents and admins at Swift Path Capital LLC, a merchant cash advance company.

## Stack

- **Frontend**: Electron 28 + Vite + React 18 + Tailwind CSS
- **Backend**: Express server (`server/index.js`) running on port 3001, deployed to Railway
- **Database**: Supabase (Postgres) — `sdlosxhgqakrumhtzsns.supabase.co`
- **SoftPhone**: Telnyx WebRTC (`@telnyx/webrtc`) — SIP credentials per agent
- **SMS**: Telnyx REST API via `/sms` server route
- **Email/Calendar**: Zoho Mail + Zoho Calendar via OAuth (tokens stored in `zoho_tokens` table)

## Dev Commands

```bash
npm run dev          # Electron + Vite dev server
npm run build        # Electron production build
npm run build:web    # Web-only build (vite.web.config.js)
npm run build:win    # Windows installer
```

The Express server is separate — run it with `node server/index.js` locally (port 3001). In Electron, `API_BASE` auto-detects `file:` protocol and points to `http://localhost:3001`.

## Environment Variables (`.env`)

All values live in `.env` (gitignored). Required keys:

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

## Deployment

- **Backend**: Railway at `https://crm-skeleton-production.up.railway.app`
- **Zoho OAuth redirect**: `https://crm-skeleton-production.up.railway.app/auth/zoho/callback`
- **Web build**: served from `server/dist/` via Express catch-all

## Project Structure

```
src/renderer/src/
  App.jsx                  # Auth gate, AppShell, all PageSlots, lead fetching
  components/
    Sidebar.jsx            # Nav (role-based: admin sees extra section)
    LeadTable.jsx          # Lead list with filtering, bulk assign/revoke
    LeadExpandedRow.jsx    # Lead detail: Details / Emails / Notes tabs
    AnnouncementsBanner.jsx
  pages/
    Login.jsx
    MyLeads.jsx            # Wraps LeadTable
    AdminDashboard.jsx     # Live call board, softphone logs
    AgentManagement.jsx    # Create/edit agents, assign SIP creds and DIDs
    AgentLeads.jsx         # Admin: assign/unassign leads per agent
    DealPipeline.jsx
    Clients.jsx
    ScriptsPage.jsx
    EmailClient.jsx        # Zoho Mail client
    CalendarPage.jsx       # Zoho Calendar
    SoftPhone.jsx          # Telnyx WebRTC softphone + SMS
    Messaging.jsx
    Settings.jsx
    NewApplication.jsx     # iframe
  context/AppContext.jsx   # userId, agent record, Zoho connection state
  lib/supabaseClient.js    # createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
server/index.js            # Express: SMS, Telnyx webhooks, Zoho OAuth + API proxy
```

## Database Tables

| Table | Purpose |
|---|---|
| `agents` | User accounts — `id` (auth UUID), `full_name`, `email`, `role` (admin\|agent), `did`, `sip_username`, `sip_password` |
| `leads` | All leads — `assigned_to` (agent UUID, nullable), `status`, `lead_type`, `first_name`, `last_name`, `company_name`, `phone`, etc. |
| `lead_comments` | Agent notes on leads — `lead_id`, `agent_id`, `agent_name`, `content`, `created_at` |
| `calls` | Call log — `lead_phone`, `agent_name`, `duration`, `disposition`, `recording_url`, `call_session_id` |
| `emails` | Email history mirrored from Zoho — `lead_id`, `from_email`, `to_email`, `subject`, `body`, `zoho_message_id` |
| `sms_conversations` | SMS threads — `contact_phone`, `contact_name`, `last_message` |
| `sms_messages` | Individual SMS — `conversation_id`, `body`, `direction` (inbound\|outbound) |
| `zoho_tokens` | Per-agent Zoho OAuth tokens — `id` (agent UUID), `access_token`, `refresh_token`, `expires_at`, `account_id`, `calendar_uid` |

## Auth & Roles

- Supabase Auth. On login, agent record is fetched from `agents` table by `user.id`.
- `role: "admin"` — sees all leads, admin sidebar items (Admin Dashboard, Agent Management, Agent Leads, Settings), agent filter on LeadTable.
- `role: "agent"` — sees only leads where `assigned_to = userId OR assigned_to IS NULL`.

## Key Patterns

**Supabase client** (frontend): imported from `lib/supabaseClient.js`, used directly in components.

**Lead visibility** (in `App.jsx`): admin fetches all leads; agents filter with `.or('assigned_to.eq.${userId},assigned_to.is.null')`. Leads are fetched in 1000-row pages and stored in top-level state, passed down as props.

**PageSlot**: all pages stay mounted (display:none when inactive) to preserve state across nav — important for SoftPhone, EmailClient.

**API_BASE**: `""` in web/dev (proxy via Vite or same-origin), `"http://localhost:3001"` when loaded as `file:` in Electron.

**Telnyx SoftPhone**: `TelnyxRTC` initialized with `{ login: sip_username, password: sip_password }`. `newCall()` uses `debug: true`, `preferred_codecs: ['OPUS', 'PCMU']`, `audio: true`, `video: false`.

**Migrations**: tracked in `supabase/migrations/`. Push with `npx supabase db push` (project already linked to `sdlosxhgqakrumhtzsns`). All tables require RLS policies for authenticated users.

## Server Routes

| Route | Purpose |
|---|---|
| `POST /sms` | Send SMS via Telnyx |
| `GET /api/active-calls` | Live calls from Telnyx connection IDs |
| `GET /api/recordings` | Call recordings from Telnyx |
| `POST /webhook/telnyx` | Inbound call hangup + recording saved events → writes to `calls` table |
| `GET /auth/zoho` | Start Zoho OAuth flow |
| `GET /auth/zoho/callback` | Exchange code, store tokens in `zoho_tokens` |
| `GET /api/emails/inbox` | Zoho inbox proxy |
| `GET /api/emails/sent` | Zoho sent proxy |
| `POST /api/emails/send` | Send via Zoho, mirror to Supabase `emails` |
| `GET /api/calendar/events` | Zoho Calendar events (next 30 days) |
| `POST /api/calendar/events` | Create Zoho Calendar event |
| `DELETE /api/calendar/events/:id` | Delete Zoho Calendar event |
| `POST /api/send-application` | Email MCA application HTML to submissions@swiftpathtocapital.com via Zoho |
