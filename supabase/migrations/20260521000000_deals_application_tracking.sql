ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS application_sent_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signwell_document_id   TEXT;
