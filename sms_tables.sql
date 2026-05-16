-- Run once in the Supabase SQL editor before using the SoftPhone SMS feature.

CREATE TABLE IF NOT EXISTS public.sms_conversations (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id         TEXT,
  contact_name     TEXT,
  contact_phone    TEXT NOT NULL,
  last_message     TEXT DEFAULT '',
  last_message_at  TIMESTAMPTZ DEFAULT now(),
  unread_count     INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sms_messages (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id  UUID REFERENCES public.sms_conversations(id) ON DELETE CASCADE,
  body             TEXT NOT NULL,
  direction        TEXT CHECK (direction IN ('inbound', 'outbound')),
  sent_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sms_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all sms_conversations" ON public.sms_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all sms_messages"      ON public.sms_messages      FOR ALL USING (true) WITH CHECK (true);
