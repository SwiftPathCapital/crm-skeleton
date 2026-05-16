-- Run once in the Supabase SQL editor to enable Calendar event persistence.

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id    TEXT,
  title       TEXT NOT NULL,
  description TEXT,
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ,
  color       TEXT DEFAULT '#c9a84c',
  all_day     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all calendar_events" ON public.calendar_events FOR ALL USING (true) WITH CHECK (true);
