-- Supabase SQL: emails table
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS emails (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID REFERENCES leads(id) ON DELETE SET NULL,
  subject          TEXT,
  body             TEXT,
  from_email       TEXT NOT NULL,
  to_email         TEXT NOT NULL,
  sent_at          TIMESTAMPTZ DEFAULT NOW(),
  folder           TEXT DEFAULT 'inbox'
                     CHECK (folder IN ('inbox', 'sent', 'drafts', 'starred')),
  read             BOOLEAN DEFAULT false,
  starred          BOOLEAN DEFAULT false,
  cc_email         TEXT,
  zoho_message_id  TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emails_lead_id  ON emails (lead_id);
CREATE INDEX IF NOT EXISTS idx_emails_folder   ON emails (folder);
CREATE INDEX IF NOT EXISTS idx_emails_sent_at  ON emails (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_from     ON emails (from_email);
CREATE INDEX IF NOT EXISTS idx_emails_to       ON emails (to_email);

-- RLS: agents see all emails (adjust to match your existing RLS strategy)
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read emails"
  ON emails FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert emails"
  ON emails FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update emails"
  ON emails FOR UPDATE
  TO authenticated
  USING (true);
