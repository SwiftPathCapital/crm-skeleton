-- Replace recursive agent policies with a security-definer function
-- that reads agents without triggering RLS, breaking the infinite loop.

CREATE OR REPLACE FUNCTION public.current_agent_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.agents WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "agents_select_admin" ON agents;
CREATE POLICY "agents_select_admin"
  ON agents FOR SELECT
  TO authenticated
  USING (current_agent_role() = 'admin');

DROP POLICY IF EXISTS "agents_update_own_no_role_change" ON agents;
CREATE POLICY "agents_update_own_no_role_change"
  ON agents FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = current_agent_role()
  );

DROP POLICY IF EXISTS "agents_update_admin" ON agents;
CREATE POLICY "agents_update_admin"
  ON agents FOR UPDATE
  TO authenticated
  USING (current_agent_role() = 'admin');
