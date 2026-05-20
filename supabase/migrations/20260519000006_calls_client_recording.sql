ALTER TABLE calls ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_path TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "call_recordings_insert" ON storage.objects;
CREATE POLICY "call_recordings_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'call-recordings');

DROP POLICY IF EXISTS "call_recordings_select" ON storage.objects;
CREATE POLICY "call_recordings_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'call-recordings');
