const express = require('express');
const cors    = require('cors');
const path    = require('path');
const crypto  = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// ── Startup validation ────────────────────────────────────────────────────────
if (!process.env.OAUTH_STATE_SECRET) {
  throw new Error('[startup] OAUTH_STATE_SECRET env var is required. Set it in .env and in Railway before deploying.');
}

// Supabase clients — inlined to avoid module resolution issues on Railway
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  { realtime: { transport: ws } }
);
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  { realtime: { transport: ws } }
);

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://crm-skeleton-production.up.railway.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3001',
]);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    cb(Object.assign(new Error('CORS: origin not allowed'), { status: 403 }));
  },
  credentials: true,
}));

// Capture raw body for Telnyx webhook signature verification
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'dist')));

// ── Auth middleware ───────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  req.userId = user.id;
  next();
}

// ── Inbound lead parser (public — registered before requireAuth) ──────────────
// Lead vendors POST here with x-api-key; no user JWT required.
app.post('/api/leads/inbound', async (req, res) => {
  const expectedKey = process.env.INBOUND_LEADS_API_KEY;
  if (!expectedKey) {
    return res.status(503).json({ error: 'Inbound lead endpoint is not configured' });
  }
  const provided = req.headers['x-api-key'];
  if (!provided || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expectedKey))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  function clean(val) {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string' && val.trim().toUpperCase() === 'N/A') return null;
    return val === '' ? null : val;
  }

  const b = req.body;

  let assignedToId = null;
  const rawAgent = clean(b.assigned_to);
  if (rawAgent) {
    const { data: matched } = await supabaseAdmin
      .from('agents')
      .select('id')
      .ilike('name', rawAgent)
      .limit(1);
    if (matched?.length) assignedToId = matched[0].id;
  }

  const lead = {
    lead_type:              'web',
    status:                 'New',
    created_at:             new Date().toISOString(),
    received_date:          new Date().toISOString().split('T')[0],
    company_name:           clean(b.company_name),
    contact_name:           clean(b.contact_name),
    phone:                  clean(b.phone),
    email:                  clean(b.email),
    state:                  clean(b.state),
    assigned_to:            assignedToId,
    industry:               clean(b.industry),
    best_contact_time:      clean(b.best_contact_time),
    fax:                    clean(b.fax),
    is_owner:               clean(b.is_owner),
    years_as_owner:         clean(b.years_as_owner),
    monthly_deposits:       clean(b.monthly_deposits),
    urgent:                 clean(b.urgent),
    requested_amount:       clean(b.requested_amount),
    fund_purpose:           clean(b.fund_purpose),
    previous_denials:       clean(b.previous_denials),
    processes_credit_cards: clean(b.processes_credit_cards),
    fico_score:             clean(b.fico_score),
    has_equity:             clean(b.has_equity),
    property_equity:        clean(b.property_equity),
    existing_loan_balances: clean(b.existing_loan_balances),
    num_existing_loans:     clean(b.num_existing_loans),
  };

  const { data, error } = await supabaseAdmin
    .from('leads')
    .insert(lead)
    .select('id')
    .single();

  if (error) {
    console.error('[inbound-lead] insert error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ id: data.id });
});

// ── Apply requireAuth to all /api/* and /sms ──────────────────────────────────
app.use('/api', requireAuth);
app.use('/sms', requireAuth);

// ── Route modules ─────────────────────────────────────────────────────────────
app.use('/', require('./route-calls'));
app.use('/', require('./route-zoho'));
app.use('/', require('./route-emails'));
app.use('/', require('./route-calendar'));
app.use('/', require('./route-agents'));
app.use('/', require('./route-leads'));
app.use('/', require('./route-docuseal'));

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  const API_KEY = process.env.TELNYX_API_KEY;
  console.log('TELNYX_API_KEY:', API_KEY ? `set (${API_KEY.slice(0, 8)}...)` : 'MISSING');
});

