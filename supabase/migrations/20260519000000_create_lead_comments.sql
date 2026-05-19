create table if not exists lead_comments (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  agent_id    uuid references agents(id) on delete set null,
  agent_name  text not null,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists lead_comments_lead_id_created_at_idx
  on lead_comments (lead_id, created_at);
