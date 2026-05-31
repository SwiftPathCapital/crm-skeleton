create table if not exists docuseal_submissions (
  id             uuid primary key default gen_random_uuid(),
  submission_id  text,
  signing_url    text,
  status         text not null default 'sent',
  deal_id        uuid references deals(id) on delete set null,
  lead_id        uuid references leads(id) on delete set null,
  agent_id       uuid references agents(id) on delete set null,
  client_email   text not null,
  contact_name   text,
  business_name  text,
  created_at     timestamptz not null default now()
);

create index if not exists docuseal_submissions_deal_idx  on docuseal_submissions(deal_id);
create index if not exists docuseal_submissions_lead_idx  on docuseal_submissions(lead_id);
create index if not exists docuseal_submissions_agent_idx on docuseal_submissions(agent_id);

alter table docuseal_submissions enable row level security;

create policy "Authenticated users can manage docuseal submissions"
  on docuseal_submissions for all
  to authenticated
  using (true)
  with check (true);
