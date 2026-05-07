# APEX CRM — Phase 1 Skeleton

## Stack
- Electron (desktop app)
- React 18
- Tailwind CSS
- Vite (via electron-vite)
- Supabase (Phase 2 — not connected yet)

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Run in development
```bash
npm run dev
```
This launches the Electron window with hot reload.

### 3. Toggle role (agent vs admin)
In `src/App.jsx` line 12:
```js
const userRole = "admin"; // change to "agent" to hide Admin Dashboard
```

---

## File Structure
```
src/
  App.jsx                  — Root component, view router, role toggle
  main.jsx                 — React entry point
  index.css                — Tailwind + global styles
  main/
    index.js               — Electron main process
  components/
    Sidebar.jsx            — Navigation (role-aware)
    LeadTable.jsx          — Main table with search, filter, expanding rows
    LeadExpandedRow.jsx    — All editable fields per lead type + documents
  pages/
    MyLeads.jsx            — My Leads view
    DialerQueue.jsx        — Placeholder (Phase 5)
    AdminDashboard.jsx     — Placeholder (Phase 3/6)
  lib/
    dummyData.js           — 9 sample leads across all 5 types (Phase 2: swap for Supabase)
```

---

## Lead Types & Fields

| Type | Expanded Fields |
|------|----------------|
| `ucc` | name, title, email, number_type, address, city, zip, sic_code, sic_description, employee_size, revenue, filing_day, filing_month, filing_year, sec_partyname |
| `trigger` | name, title, email, number_type, sic_code, sic_description, day, month, year |
| `aged` | name, email, line_type |
| `web` | name, email, requested_amount, why_funds, tib, monthly_deposit, best_time, fico, lead_type_label, date_sold |
| `live_transfer` | same as web |

All types also share: `lead_vendor`, `status` (dropdown), documents upload section.

---

## Phase Checklist
- [x] Phase 1 — Skeleton complete
- [ ] Phase 2 — Supabase integration
- [ ] Phase 3 — Auth & roles
- [ ] Phase 4 — E-signature
- [ ] Phase 5 — Telephony / Power Dialer
- [ ] Phase 6 — Admin tools
- [ ] Phase 7 — Scripts, search, drip
- [ ] Phase 8 — Compliance & deployment
