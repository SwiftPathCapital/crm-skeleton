-- Run once in the Supabase SQL editor.
-- Creates the calls table for logging softphone call records.

CREATE TABLE IF NOT EXISTS calls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_phone  TEXT,
  agent_name  TEXT,
  duration    INTEGER,          -- seconds
  disposition TEXT DEFAULT 'completed',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
