-- ─────────────────────────────────────────────────────────────────────────────
-- Enable Row-Level Security on four previously unprotected tables and add
-- appropriate access policies.
--
-- Server-side writes that have no user JWT context (Telnyx webhook, Zoho OAuth
-- callback) use the service-role supabaseAdmin client, which bypasses RLS by
-- design — those paths are updated in server/index.js alongside this migration.
--
-- current_agent_role() is a SECURITY DEFINER function defined in migration
-- 20260520000000 that reads the calling user's role without triggering RLS
-- recursion on the agents table.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. leads ─────────────────────────────────────────────────────────────────

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Agents see their own leads + unassigned leads; admins see everything
CREATE POLICY "leads_select"
  ON leads FOR SELECT
  TO authenticated
  USING (
    current_agent_role() = 'admin'
    OR assigned_to = auth.uid()
    OR assigned_to IS NULL
  );

-- Any logged-in user can create a lead
CREATE POLICY "leads_insert"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Agents can edit leads assigned to them or unassigned; admins can edit all
CREATE POLICY "leads_update"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    current_agent_role() = 'admin'
    OR assigned_to = auth.uid()
    OR assigned_to IS NULL
  );

-- Only admins can delete leads
CREATE POLICY "leads_delete"
  ON leads FOR DELETE
  TO authenticated
  USING (current_agent_role() = 'admin');


-- ── 2. calls ─────────────────────────────────────────────────────────────────

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- calls has no agent_id column; all authenticated users may read call records
-- (admin dashboard, client call history, etc.)
CREATE POLICY "calls_select"
  ON calls FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated inserts (SoftPhone client-side logging on hangup)
CREATE POLICY "calls_insert"
  ON calls FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated updates (recording path, duration written by SoftPhone)
CREATE POLICY "calls_update"
  ON calls FOR UPDATE
  TO authenticated
  USING (true);


-- ── 3. emails ────────────────────────────────────────────────────────────────

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- All authenticated users may read email records
CREATE POLICY "emails_select"
  ON emails FOR SELECT
  TO authenticated
  USING (true);

-- Server inserts a record after each Zoho send; service-role client bypasses
-- this policy. Also permit authenticated inserts for any future client-side use.
CREATE POLICY "emails_insert"
  ON emails FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- ── 4. zoho_tokens ───────────────────────────────────────────────────────────

ALTER TABLE zoho_tokens ENABLE ROW LEVEL SECURITY;

-- Each agent sees only their own token row; admins see all
CREATE POLICY "zoho_tokens_select"
  ON zoho_tokens FOR SELECT
  TO authenticated
  USING (
    current_agent_role() = 'admin'
    OR id = auth.uid()
  );

-- Agents may update their own token; admins may update any
CREATE POLICY "zoho_tokens_update"
  ON zoho_tokens FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR current_agent_role() = 'admin');

-- OAuth upsert via supabaseAdmin bypasses this; allow authenticated inserts too
CREATE POLICY "zoho_tokens_insert"
  ON zoho_tokens FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() OR current_agent_role() = 'admin');
