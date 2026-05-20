CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON settings;
CREATE POLICY "settings_select"
  ON settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "settings_insert" ON settings;
CREATE POLICY "settings_insert"
  ON settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "settings_update" ON settings;
CREATE POLICY "settings_update"
  ON settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );
