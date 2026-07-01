-- =====================================================
-- COMPLETE DATABASE SCHEMA FOR AI TRAINER MONOREPO
-- Run all statements in Supabase SQL Editor
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 001: ORGANISATIONS AND USERS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('manager', 'rep', 'admin')),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ─────────────────────────────────────────────────────
-- 002: CALLS (Sales Call Records)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  duration_sec INTEGER NOT NULL,
  recorded_at TIMESTAMP NOT NULL,
  transcript_text TEXT NOT NULL,
  raw_metrics_json JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_rep_id ON calls(rep_id);
CREATE INDEX IF NOT EXISTS idx_calls_org_id ON calls(org_id);
CREATE INDEX IF NOT EXISTS idx_calls_recorded_at ON calls(recorded_at);

-- ─────────────────────────────────────────────────────
-- 003: COACHING SIGNALS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coaching_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  value FLOAT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coaching_signals_call_id ON coaching_signals(call_id);
CREATE INDEX IF NOT EXISTS idx_coaching_signals_signal_type ON coaching_signals(signal_type);

-- ─────────────────────────────────────────────────────
-- 004: TRAINING SCENARIOS
-- ─────────────────────────────────────────────────────
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
  custom_prompt TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_scenarios_org_id ON training_scenarios(org_id);
CREATE INDEX IF NOT EXISTS idx_training_scenarios_difficulty ON training_scenarios(difficulty);

-- ─────────────────────────────────────────────────────
-- 005: TRAINING SESSIONS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES training_scenarios(id) ON DELETE CASCADE,
  messages_json JSONB,
  feedback_json JSONB,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_sessions_rep_id ON training_sessions(rep_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_scenario_id ON training_sessions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_completed_at ON training_sessions(completed_at);

-- ─────────────────────────────────────────────────────
-- 006: TRAINING ASSIGNMENTS
-- ─────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────
-- 007: UPDATE TRIGGER FOR updated_at
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_calls_updated_at ON calls;
CREATE TRIGGER update_calls_updated_at
BEFORE UPDATE ON calls
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_training_scenarios_updated_at ON training_scenarios;
CREATE TRIGGER update_training_scenarios_updated_at
BEFORE UPDATE ON training_scenarios
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_training_sessions_updated_at ON training_sessions;
CREATE TRIGGER update_training_sessions_updated_at
BEFORE UPDATE ON training_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_training_assignments_updated_at ON training_assignments;
CREATE TRIGGER update_training_assignments_updated_at
BEFORE UPDATE ON training_assignments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────
-- 008: EVALUATION QUESTIONS
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

-- ✅ Schema setup complete!
