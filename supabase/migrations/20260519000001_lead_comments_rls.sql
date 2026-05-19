alter table lead_comments enable row level security;

create policy "Authenticated users can read lead comments"
  on lead_comments for select
  to authenticated
  using (true);

create policy "Authenticated users can insert lead comments"
  on lead_comments for insert
  to authenticated
  with check (true);
