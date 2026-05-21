CREATE TABLE IF NOT EXISTS application_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id              UUID REFERENCES deals(id) ON DELETE SET NULL,
  agent_id             TEXT NOT NULL,
  client_email         TEXT NOT NULL,
  contact_name         TEXT NOT NULL DEFAULT '',
  business_name        TEXT NOT NULL DEFAULT '',
  status               TEXT NOT NULL DEFAULT 'pending',
  reviewed_by          TEXT,
  reviewed_at          TIMESTAMPTZ,
  rejection_note       TEXT,
  signwell_document_id TEXT,
  signwell_sent_at     TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE application_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_requests_select" ON application_requests FOR SELECT TO authenticated
  USING (
    agent_id = auth.uid()::text
    OR EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "app_requests_insert" ON application_requests FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid()::text);

CREATE POLICY "app_requests_update" ON application_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin'));
