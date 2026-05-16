-- Run this once in the Supabase SQL editor before using the Zoho integration.
-- Adds Zoho OAuth token columns to the agents table.

ALTER TABLE agents ADD COLUMN IF NOT EXISTS zoho_access_token  TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS zoho_refresh_token TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS zoho_token_expiry  BIGINT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS zoho_account_id   TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS zoho_api_domain   TEXT;
