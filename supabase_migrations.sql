-- Run these in your Supabase SQL Editor to set up the new tables.

-- ── MESSAGES TABLE ────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  from_agent_id uuid not null references public.agents(id) on delete cascade,
  to_agent_id   uuid not null references public.agents(id) on delete cascade,
  body          text not null,
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Index for fast conversation queries
create index if not exists messages_conversation_idx
  on public.messages (from_agent_id, to_agent_id, created_at);

create index if not exists messages_unread_idx
  on public.messages (to_agent_id, read)
  where read = false;

-- RLS: agents can only read/write their own messages
alter table public.messages enable row level security;

create policy "agents read own messages"
  on public.messages for select
  using (auth.uid() = from_agent_id or auth.uid() = to_agent_id);

create policy "agents send messages"
  on public.messages for insert
  with check (auth.uid() = from_agent_id);

create policy "agents mark messages read"
  on public.messages for update
  using (auth.uid() = to_agent_id);

-- Enable realtime for messages
alter publication supabase_realtime add table public.messages;


-- ── ANNOUNCEMENTS TABLE ───────────────────────────────────────────────────────
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  posted_by   uuid references public.agents(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- RLS: all authenticated users can read; only admins can insert
alter table public.announcements enable row level security;

create policy "all agents read announcements"
  on public.announcements for select
  using (auth.uid() is not null);

create policy "admins post announcements"
  on public.announcements for insert
  with check (
    exists (
      select 1 from public.agents
      where id = auth.uid() and role = 'admin'
    )
  );

-- Enable realtime for announcements
alter publication supabase_realtime add table public.announcements;


-- ── LEADS TABLE: add assigned_to column if not already present ────────────────
-- (Skip this block if assigned_to already exists in your leads table)
alter table public.leads
  add column if not exists assigned_to uuid references public.agents(id) on delete set null;

create index if not exists leads_assigned_to_idx on public.leads (assigned_to);
