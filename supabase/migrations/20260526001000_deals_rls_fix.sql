-- Deals table was missing SELECT, UPDATE, DELETE policies — only INSERT existed.
-- Agents see their own deals; admins see all.

create policy "deals_select" on deals
  for select using (
    assigned_agent_id = auth.uid()::text
    or exists (select 1 from agents where id = auth.uid() and role = 'admin')
  );

create policy "deals_update" on deals
  for update using (
    assigned_agent_id = auth.uid()::text
    or exists (select 1 from agents where id = auth.uid() and role = 'admin')
  );

create policy "deals_delete" on deals
  for delete using (
    assigned_agent_id = auth.uid()::text
    or exists (select 1 from agents where id = auth.uid() and role = 'admin')
  );
