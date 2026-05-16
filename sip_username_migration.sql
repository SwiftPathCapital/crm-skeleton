-- Run once in the Supabase SQL editor.
-- Adds SIP username column to the agents table.

ALTER TABLE agents ADD COLUMN IF NOT EXISTS sip_username TEXT;
