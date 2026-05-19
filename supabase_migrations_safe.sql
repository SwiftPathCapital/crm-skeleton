-- Safe idempotent migration — drops policies before recreating

-- MESSAGES
drop policy if exists "agents read own messages" on public.messages;
drop policy if exists "agents send messages" on public.messages;
drop policy if exists "agents mark messages read" on public.messages;

create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  from_agent_id uuid not null references public.agents(id) on delete cascade,
  to_agent_id   uuid not null references public.agents(id) on delete cascade,
  body          text not null,
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (from_agent_id, to_agent_id, created_at);

create index if not exists messages_unread_idx
  on public.messages (to_agent_id, read)
  where read = false;

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

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when others then null;
end $$;

-- ANNOUNCEMENTS
drop policy if exists "all agents read announcements" on public.announcements;
drop policy if exists "admins post announcements" on public.announcements;

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  posted_by   uuid references public.agents(id) on delete set null,
  created_at  timestamptz not null default now()
);

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

do $$ begin
  alter publication supabase_realtime add table public.announcements;
exception when others then null;
end $$;

-- LEADS
alter table public.leads
  add column if not exists assigned_to uuid references public.agents(id) on delete set null;

create index if not exists leads_assigned_to_idx on public.leads (assigned_to);
