-- Live transfer vendors (e.g. SDLT, future vendors)
create table if not exists transfer_vendors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

insert into transfer_vendors (name) values ('SDLT') on conflict (name) do nothing;

-- Live transfer records
create table if not exists live_transfers (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  agent_id      uuid not null references agents(id) on delete cascade,
  customer_name text not null default '',
  phone         text not null default '',
  email         text not null default '',
  state         text not null default '',
  vendor_id     uuid references transfer_vendors(id) on delete set null,
  status        text not null default 'pending'
                  check (status in ('pending','completed','funded','failed','credit')),
  notes         text not null default ''
);

-- RLS
alter table transfer_vendors enable row level security;
alter table live_transfers   enable row level security;

-- Everyone can read vendors
create policy "vendors_select" on transfer_vendors
  for select using (true);

-- Only admins can insert/update vendors
create policy "vendors_admin_insert" on transfer_vendors
  for insert with check (
    exists (select 1 from agents where id = auth.uid() and role = 'admin')
  );

create policy "vendors_admin_update" on transfer_vendors
  for update using (
    exists (select 1 from agents where id = auth.uid() and role = 'admin')
  );

-- Agents see their own transfers; admins see all
create policy "transfers_select" on live_transfers
  for select using (
    agent_id = auth.uid()
    or exists (select 1 from agents where id = auth.uid() and role = 'admin')
  );

create policy "transfers_insert" on live_transfers
  for insert with check (agent_id = auth.uid());

create policy "transfers_update" on live_transfers
  for update using (
    agent_id = auth.uid()
    or exists (select 1 from agents where id = auth.uid() and role = 'admin')
  );

create policy "transfers_delete" on live_transfers
  for delete using (
    agent_id = auth.uid()
    or exists (select 1 from agents where id = auth.uid() and role = 'admin')
  );
