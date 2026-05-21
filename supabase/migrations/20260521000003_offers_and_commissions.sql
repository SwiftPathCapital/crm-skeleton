ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS commission_rate   NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS offers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL,
  amount      NUMERIC NOT NULL,
  factor_rate NUMERIC,
  term        TEXT NOT NULL DEFAULT '',
  position    TEXT NOT NULL DEFAULT '1st',
  notes       TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'sent',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offers_select" ON offers FOR SELECT TO authenticated
  USING (
    agent_id = auth.uid()::text
    OR EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "offers_insert" ON offers FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid()::text OR EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "offers_update" ON offers FOR UPDATE TO authenticated
  USING (
    agent_id = auth.uid()::text
    OR EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );
