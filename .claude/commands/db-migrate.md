---
description: Create and push a Supabase migration for this project
argument-hint: <short description of what the migration does>
allowed-tools: [Read, Write, Bash, Glob]
---

# db-migrate

You are creating a Supabase migration for the Swift Path Capital CRM project.

## Project context

- Supabase project: `sdlosxhgqakrumhtzsns` (already linked)
- Migrations live in: `supabase/migrations/`
- Naming convention: `YYYYMMDDHHMMSS_<slug>.sql` — use the current date/time for the timestamp
- All new tables **must** have RLS enabled and policies for the `authenticated` role
- Always use `IF NOT EXISTS` / `IF NOT EXISTS` guards so migrations are safe to re-run
- Current date/time: !`date +"%Y%m%d%H%M%S" 2>/dev/null || powershell -Command "Get-Date -Format 'yyyyMMddHHmmss'"`
- Existing migrations: !`ls supabase/migrations/ 2>/dev/null || echo "(none yet)"`

## What the user wants

$ARGUMENTS

## Your task

1. **Determine the migration slug** — a short lowercase kebab-case name derived from the user's description (e.g. `add_recording_url_to_calls`, `create_announcements_table`).

2. **Write the migration file** at `supabase/migrations/<timestamp>_<slug>.sql` containing:
   - `CREATE TABLE IF NOT EXISTS` (for new tables) with all requested columns
   - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (for column additions)
   - Any indexes needed for common query patterns
   - If a new table: `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`
   - If a new table: RLS policies for `authenticated` role — at minimum SELECT and INSERT; add UPDATE/DELETE only if the table's data is mutable by users
   - Use standard Postgres types: `uuid`, `text`, `timestamptz`, `boolean`, `integer`, `jsonb`
   - Default `id` to `gen_random_uuid()`, default `created_at` to `now()`

3. **Push the migration** by running:
   ```
   npx supabase db push
   ```
   The CLI will prompt for confirmation — answer yes.

4. **Report** what was created: filename, SQL summary, and whether the push succeeded. If the push fails, show the error and suggest a fix.

## RLS policy template for new tables

```sql
alter table <table_name> enable row level security;

create policy "Authenticated users can read <table_name>"
  on <table_name> for select
  to authenticated
  using (true);

create policy "Authenticated users can insert <table_name>"
  on <table_name> for insert
  to authenticated
  with check (true);
```

Add UPDATE/DELETE policies only when the feature requires users to modify or delete rows.

## Column reference for this project

Common foreign keys used in this codebase:
- `lead_id uuid references leads(id) on delete cascade`
- `agent_id uuid references agents(id) on delete set null`

Common status/enum patterns use `text` with a check constraint, e.g.:
- `status text not null default 'active' check (status in ('active','inactive'))`
