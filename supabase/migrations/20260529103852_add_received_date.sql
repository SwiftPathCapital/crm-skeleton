alter table live_transfers add column if not exists received_date date;
alter table leads         add column if not exists received_date date;
