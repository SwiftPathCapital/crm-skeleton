-- Reconcile agents table after dialer-app recreated it without CRM columns.
-- The dialer added: sip_connection_id, extension, status, updated_at, voicemail_greeting_url
-- The CRM needs back: role, did

ALTER TABLE agents ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'agent';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS did  text;

-- Mark Jordan Bosh as admin (auth user ID)
UPDATE agents SET role = 'admin' WHERE id = 'f03b5a98-a8c5-4a30-8ac8-d9c60655925e';
