CREATE TABLE IF NOT EXISTS clients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name      TEXT NOT NULL DEFAULT '',
  business_name     TEXT NOT NULL DEFAULT '',
  phone             TEXT,
  funded_amount     NUMERIC,
  funding_date      DATE,
  assigned_agent_id TEXT,
  notes             JSONB NOT NULL DEFAULT '[]',
  docs              JSONB NOT NULL DEFAULT '[]',
  deal_id           UUID REFERENCES deals(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select"
  ON clients FOR SELECT
  TO authenticated
  USING (
    assigned_agent_id = auth.uid()::text
    OR EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "clients_insert" ON clients;
CREATE POLICY "clients_insert"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "clients_update" ON clients;
CREATE POLICY "clients_update"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    assigned_agent_id = auth.uid()::text
    OR EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "clients_delete" ON clients;
CREATE POLICY "clients_delete"
  ON clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );

-- Storage bucket for client documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-docs', 'client-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "client_docs_insert" ON storage.objects;
CREATE POLICY "client_docs_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'client-docs');

DROP POLICY IF EXISTS "client_docs_select" ON storage.objects;
CREATE POLICY "client_docs_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'client-docs');

DROP POLICY IF EXISTS "client_docs_delete" ON storage.objects;
CREATE POLICY "client_docs_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'client-docs');
