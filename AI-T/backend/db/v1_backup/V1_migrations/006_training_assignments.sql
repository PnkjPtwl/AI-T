-- 006_training_assignments.sql
-- Create training_assignments table for manager assignments

CREATE TABLE IF NOT EXISTS training_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES training_scenarios(id) ON DELETE CASCADE,
  session_id UUID REFERENCES training_sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Overdue')) DEFAULT 'Pending',
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  deadline TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_assignments_rep_id ON training_assignments(rep_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_manager_id ON training_assignments(manager_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_scenario_id ON training_assignments(scenario_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_status ON training_assignments(status);
CREATE INDEX IF NOT EXISTS idx_training_assignments_deadline ON training_assignments(deadline);
