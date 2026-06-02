-- Add last_contacted timestamp to leads for staleness tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contacted timestamptz;

-- Follow-up sequence templates (admin-defined, trigger on lead status change)
CREATE TABLE IF NOT EXISTS follow_up_sequences (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  trigger_status text NOT NULL,
  created_by     uuid REFERENCES agents(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE follow_up_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_sequences" ON follow_up_sequences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Steps within each sequence (each step creates a callback at day_offset days from trigger)
CREATE TABLE IF NOT EXISTS follow_up_sequence_steps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id   uuid NOT NULL REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
  day_offset    integer NOT NULL DEFAULT 0,
  note_template text,
  sort_order    integer NOT NULL DEFAULT 0
);
ALTER TABLE follow_up_sequence_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_steps" ON follow_up_sequence_steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index for fast lookup when a lead status changes
CREATE INDEX IF NOT EXISTS idx_follow_up_sequences_trigger ON follow_up_sequences(trigger_status);
