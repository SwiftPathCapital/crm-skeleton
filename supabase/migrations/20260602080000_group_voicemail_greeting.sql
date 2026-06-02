ALTER TABLE inbound_groups ADD COLUMN IF NOT EXISTS voicemail_greeting_url text;
ALTER TABLE voicemails    ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES agents(id);
