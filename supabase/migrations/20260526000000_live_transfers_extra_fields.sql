alter table live_transfers add column if not exists company_name    text not null default '';
alter table live_transfers add column if not exists requested_amount text not null default '';
alter table live_transfers add column if not exists monthly_revenue  text not null default '';
alter table live_transfers add column if not exists time_in_business text not null default '';
alter table live_transfers add column if not exists lead_id          uuid references leads(id) on delete set null;
alter table live_transfers add column if not exists deal_id          uuid references deals(id) on delete set null;
