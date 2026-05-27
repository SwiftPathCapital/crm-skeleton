-- Add lead_phone so callbacks from the dialer can carry a phone number
-- even when lead_id is null (inbound calls not yet matched to a lead).
alter table callbacks add column if not exists lead_phone text;
alter table callbacks add column if not exists lead_name  text;
