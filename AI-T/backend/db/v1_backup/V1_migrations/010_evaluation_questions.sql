-- ─────────────────────────────────────────────────────
-- 010: EVALUATION QUESTIONS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scenario_evaluation_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES training_scenarios(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'boolean' CHECK (question_type IN ('boolean', 'scale')),
  confidence_score FLOAT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenario_evaluation_questions_scenario_id ON scenario_evaluation_questions(scenario_id);

DROP TRIGGER IF EXISTS update_scenario_evaluation_questions_updated_at ON scenario_evaluation_questions;
CREATE TRIGGER update_scenario_evaluation_questions_updated_at
BEFORE UPDATE ON scenario_evaluation_questions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
