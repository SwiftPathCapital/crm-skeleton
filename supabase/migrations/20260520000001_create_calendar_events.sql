CREATE TABLE IF NOT EXISTS public.calendar_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ,
  color       TEXT DEFAULT '#c9a84c',
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Agents see their own events; admins see all
CREATE POLICY "calendar_select_own"
  ON public.calendar_events FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid() OR public.current_agent_role() = 'admin');

CREATE POLICY "calendar_insert_own"
  ON public.calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid() OR public.current_agent_role() = 'admin');

CREATE POLICY "calendar_update_own"
  ON public.calendar_events FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid() OR public.current_agent_role() = 'admin');

CREATE POLICY "calendar_delete_own"
  ON public.calendar_events FOR DELETE
  TO authenticated
  USING (agent_id = auth.uid() OR public.current_agent_role() = 'admin');
