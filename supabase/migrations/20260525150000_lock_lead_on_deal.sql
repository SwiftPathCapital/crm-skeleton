-- When a deal is created or updated with a linked lead,
-- assign that lead to the deal's agent so other agents lose access.
CREATE OR REPLACE FUNCTION lock_lead_to_deal_agent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL AND NEW.assigned_agent_id IS NOT NULL THEN
    UPDATE leads
    SET assigned_to = NEW.assigned_agent_id::uuid
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lock_lead_on_deal ON deals;
CREATE TRIGGER trg_lock_lead_on_deal
  AFTER INSERT OR UPDATE OF lead_id, assigned_agent_id ON deals
  FOR EACH ROW
  EXECUTE FUNCTION lock_lead_to_deal_agent();
