-- Create group_chat_members FIRST so group_chats policy can reference it
CREATE TABLE IF NOT EXISTS group_chat_members (
  chat_id   UUID NOT NULL,
  agent_id  TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_id, agent_id)
);

ALTER TABLE group_chat_members ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_chats (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE group_chats ENABLE ROW LEVEL SECURITY;

-- Now add the FK now that both tables exist
ALTER TABLE group_chat_members
  ADD CONSTRAINT group_chat_members_chat_id_fkey
  FOREIGN KEY (chat_id) REFERENCES group_chats(id) ON DELETE CASCADE;

CREATE POLICY "group_chats_select" ON group_chats FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM group_chat_members WHERE chat_id = group_chats.id AND agent_id = auth.uid()::text)
    OR EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "group_chats_insert" ON group_chats FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "group_chat_members_select" ON group_chat_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "group_chat_members_insert" ON group_chat_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_chat_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id       UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  from_agent_id TEXT NOT NULL,
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE group_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_chat_messages_select" ON group_chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM group_chat_members WHERE chat_id = group_chat_messages.chat_id AND agent_id = auth.uid()::text)
    OR EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "group_chat_messages_insert" ON group_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM group_chat_members WHERE chat_id = group_chat_messages.chat_id AND agent_id = auth.uid()::text)
    OR EXISTS (SELECT 1 FROM agents WHERE id = auth.uid() AND role = 'admin')
  );
