-- Run once in the Supabase SQL editor.
-- Adds SIP columns to the agents table.

ALTER TABLE agents ADD COLUMN IF NOT EXISTS sip_username TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS sip_password TEXT;
