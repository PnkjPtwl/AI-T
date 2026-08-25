-- 017_scenario_shares.sql
-- Allow managers to share scenarios/personas with other managers

CREATE TABLE IF NOT EXISTS scenario_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES training_scenarios(id) ON DELETE CASCADE,
  shared_with_manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_by_manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(scenario_id, shared_with_manager_id)
);

CREATE INDEX IF NOT EXISTS idx_scenario_shares_scenario ON scenario_shares(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_shares_shared_with ON scenario_shares(shared_with_manager_id);
CREATE INDEX IF NOT EXISTS idx_scenario_shares_shared_by ON scenario_shares(shared_by_manager_id);

ALTER TABLE scenario_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_scenario_shares" ON scenario_shares
  FOR ALL TO service_role USING (true) WITH CHECK (true);
