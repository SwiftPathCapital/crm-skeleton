-- Run once in the Supabase SQL editor before using Zoho integration.
-- Creates the zoho_tokens table to store OAuth tokens per agent.

CREATE TABLE IF NOT EXISTS public.zoho_tokens (
  id            TEXT PRIMARY KEY,   -- Supabase user ID (auth.uid())
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expires_at    BIGINT,             -- Unix ms timestamp
  account_id    TEXT,               -- Zoho Mail account ID
  calendar_uid  TEXT,               -- Default Zoho Calendar UID
  api_domain    TEXT DEFAULT 'https://mail.zoho.com'
);

ALTER TABLE public.zoho_tokens ENABLE ROW LEVEL SECURITY;

-- Server uses anon key, so allow all operations.
-- For production, switch the server to the service role key and tighten these.
CREATE POLICY "Allow read zoho_tokens"   ON public.zoho_tokens FOR SELECT USING (true);
CREATE POLICY "Allow insert zoho_tokens" ON public.zoho_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update zoho_tokens" ON public.zoho_tokens FOR UPDATE USING (true);
