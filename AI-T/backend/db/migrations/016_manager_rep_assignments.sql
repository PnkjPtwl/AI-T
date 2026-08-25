-- =====================================================
-- 016: MANAGER-REP ASSIGNMENTS
-- Links managers to their assigned reps.
-- Enforces 1 rep → 1 manager via UNIQUE(rep_id).
-- Admin assigns reps to managers via the admin panel.
-- =====================================================

CREATE TABLE IF NOT EXISTS manager_rep_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rep_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(rep_id) -- enforces 1 rep can only be under 1 manager
);

CREATE INDEX IF NOT EXISTS idx_mra_manager_id ON manager_rep_assignments(manager_id);
CREATE INDEX IF NOT EXISTS idx_mra_rep_id ON manager_rep_assignments(rep_id);

-- RLS
ALTER TABLE manager_rep_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_mra" ON manager_rep_assignments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add created_by to training_scenarios so scenarios are manager-scoped
ALTER TABLE training_scenarios
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_training_scenarios_created_by ON training_scenarios(created_by);
