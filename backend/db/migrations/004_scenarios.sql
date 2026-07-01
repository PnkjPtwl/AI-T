-- 004_scenarios.sql
-- Create training_scenarios table

CREATE TABLE IF NOT EXISTS training_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  persona_name TEXT NOT NULL,
  persona_type TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  context_text TEXT NOT NULL,
  personality_traits JSONB,
  evaluation_focus TEXT,
  objection_style TEXT,
  conversation_expectations TEXT,
  target_skills TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_scenarios_org_id ON training_scenarios(org_id);
CREATE INDEX IF NOT EXISTS idx_training_scenarios_difficulty ON training_scenarios(difficulty);
