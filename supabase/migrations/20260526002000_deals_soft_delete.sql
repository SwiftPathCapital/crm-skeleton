-- Soft-delete support for deals
alter table deals add column if not exists deleted_at   timestamptz;
alter table deals add column if not exists deleted_by   uuid references agents(id) on delete set null;

-- Hard delete is admin-only; agents soft-delete via UPDATE
drop policy if exists "deals_delete" on deals;

create policy "deals_delete" on deals
  for delete using (
    exists (select 1 from agents where id = auth.uid() and role = 'admin')
  );
