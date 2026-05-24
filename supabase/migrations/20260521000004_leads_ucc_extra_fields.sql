alter table leads
  add column if not exists filing_number     text,
  add column if not exists secondary_contact text,
  add column if not exists secondary_title   text;
