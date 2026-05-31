-- Create lead_documents table for tracking uploaded files per lead
create table if not exists lead_documents (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid references leads(id) on delete cascade,
  agent_id     uuid references agents(id) on delete set null,
  file_name    text not null,
  storage_path text not null,
  uploaded_at  timestamptz not null default now()
);

create index if not exists lead_documents_lead_id_idx on lead_documents(lead_id);

alter table lead_documents enable row level security;

create policy "Authenticated users can manage lead documents"
  on lead_documents for all
  to authenticated
  using (true)
  with check (true);

-- Create the lead-documents storage bucket (private — access via signed URLs)
insert into storage.buckets (id, name, public)
values ('lead-documents', 'lead-documents', false)
on conflict (id) do nothing;

-- Storage RLS: authenticated users can upload and read from lead-documents
create policy "Authenticated users can upload lead documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'lead-documents');

create policy "Authenticated users can read lead documents"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'lead-documents');

create policy "Authenticated users can delete lead documents"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'lead-documents');
