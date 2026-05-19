CREATE TABLE IF NOT EXISTS deals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name      TEXT NOT NULL DEFAULT '',
  business_name     TEXT NOT NULL DEFAULT '',
  lead_type         TEXT,
  assigned_agent_id TEXT,
  stage             TEXT NOT NULL DEFAULT 'new_lead',
  notes             JSONB NOT NULL DEFAULT '[]',
  docs              JSONB NOT NULL DEFAULT '[]',
  funded_amount     NUMERIC,
  funded_date       DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deals_select" ON deals;
CREATE POLICY "deals_select"
  ON deals FOR SELECT
  TO authenticated
  USING (
    assigned_agent_id = auth.uid()::text
    OR EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "deals_insert" ON deals;
CREATE POLICY "deals_insert"
  ON deals FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "deals_update" ON deals;
CREATE POLICY "deals_update"
  ON deals FOR UPDATE
  TO authenticated
  USING (
    assigned_agent_id = auth.uid()::text
    OR EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "deals_delete" ON deals;
CREATE POLICY "deals_delete"
  ON deals FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );

-- Storage bucket for deal documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-docs', 'deal-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "deal_docs_insert" ON storage.objects;
CREATE POLICY "deal_docs_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'deal-docs');

DROP POLICY IF EXISTS "deal_docs_select" ON storage.objects;
CREATE POLICY "deal_docs_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'deal-docs');

DROP POLICY IF EXISTS "deal_docs_delete" ON storage.objects;
CREATE POLICY "deal_docs_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'deal-docs');
