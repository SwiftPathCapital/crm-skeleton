-- Enable RLS on agents table (safe to run if already enabled)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Agents can read their own row
CREATE POLICY "agents_select_own"
  ON agents FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Admins can read all agent rows
CREATE POLICY "agents_select_admin"
  ON agents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = auth.uid() AND a.role = 'admin'
    )
  );

-- Agents can update their own row but cannot change their role
CREATE POLICY "agents_update_own_no_role_change"
  ON agents FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM agents WHERE id = auth.uid())
  );

-- Only admins can update any row (including role changes)
CREATE POLICY "agents_update_admin"
  ON agents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = auth.uid() AND a.role = 'admin'
    )
  );
