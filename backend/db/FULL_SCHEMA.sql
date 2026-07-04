-- =====================================================
-- COMPLETE DATABASE SCHEMA — AI TRAINER
-- Paste this ENTIRE file into Supabase SQL Editor and run.
-- Last updated: 2026-07-04 (includes dynamic scorecard)
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 001: ORGANISATIONS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- 002: USERS
-- NOTE: id is a UUID that matches Supabase Auth user id.
-- The trigger below auto-inserts a row here when a new
-- Auth user signs up.
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,  -- matches auth.users.id
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
-- 003: CALLS (Sales Call Records)
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
-- 004: COACHING SIGNALS
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
-- 005: TRAINING SCENARIOS (AI Personas)
-- contact_title + contact_company = display label shown in UI
-- persona_name = internal reference only (not shown in UI)
-- scorecard_metrics = [{name, description, weight}] — AI-generated per persona
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  persona_name TEXT NOT NULL,
  persona_type TEXT,
  contact_title TEXT,
  contact_company TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard', 'beginner', 'intermediate', 'advanced')),
  context_text TEXT NOT NULL,
  personality_traits JSONB,
  evaluation_focus TEXT,
  objection_style TEXT,
  conversation_expectations TEXT,
  target_skills TEXT,
  custom_prompt TEXT,
  scorecard_metrics JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_scenarios_org_id ON training_scenarios(org_id);
CREATE INDEX IF NOT EXISTS idx_training_scenarios_difficulty ON training_scenarios(difficulty);

-- ─────────────────────────────────────────────────────
-- 006: TRAINING SESSIONS
-- Also used to store manager notes (feedback_json.is_note = true)
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
-- 007: TRAINING ASSIGNMENTS
-- avatar_type controls which AI avatar the rep sees
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
  avatar_type TEXT DEFAULT 'female',
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
-- 008: SCENARIO EVALUATION QUESTIONS
-- Per-scenario questions selected by manager at creation
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

-- ─────────────────────────────────────────────────────
-- 009: QUESTION BANK
-- Reusable evaluation questions, rated by managers
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  question_text TEXT NOT NULL,
  scenario_id UUID REFERENCES training_scenarios(id) ON DELETE SET NULL,
  average_rating FLOAT DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_bank_category ON question_bank(category);
CREATE INDEX IF NOT EXISTS idx_question_bank_average_rating ON question_bank(average_rating);

-- ─────────────────────────────────────────────────────
-- 010: AUTO updated_at TRIGGER FUNCTION
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
BEFORE UPDATE ON users FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_calls_updated_at ON calls;
CREATE TRIGGER update_calls_updated_at
BEFORE UPDATE ON calls FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_training_scenarios_updated_at ON training_scenarios;
CREATE TRIGGER update_training_scenarios_updated_at
BEFORE UPDATE ON training_scenarios FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_training_sessions_updated_at ON training_sessions;
CREATE TRIGGER update_training_sessions_updated_at
BEFORE UPDATE ON training_sessions FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_training_assignments_updated_at ON training_assignments;
CREATE TRIGGER update_training_assignments_updated_at
BEFORE UPDATE ON training_assignments FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scenario_evaluation_questions_updated_at ON scenario_evaluation_questions;
CREATE TRIGGER update_scenario_evaluation_questions_updated_at
BEFORE UPDATE ON scenario_evaluation_questions FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_question_bank_updated_at ON question_bank;
CREATE TRIGGER update_question_bank_updated_at
BEFORE UPDATE ON question_bank FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────
-- 011: SUPABASE AUTH TRIGGER
-- Auto-creates a users row when someone signs up via Auth
-- You must ALSO enable this from Supabase Auth → Hooks
-- or run this in the SQL editor.
-- ─────────────────────────────────────────────────────
-- NOTE: This trigger requires the user to pass metadata:
--   { name, role, org_id } in signUp options.data
--   If org_id is not passed, you must handle org creation separately.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role, org_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'rep'),
    (NEW.raw_user_meta_data->>'org_id')::UUID
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ─────────────────────────────────────────────────────
-- 012: ROW LEVEL SECURITY (RLS)
-- Enable RLS on all tables and allow service_role full access
-- ─────────────────────────────────────────────────────
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_evaluation_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;

-- Allow service_role (backend uses this key) to do everything
CREATE POLICY "service_role_all_organisations" ON organisations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_users" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_calls" ON calls FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_coaching_signals" ON coaching_signals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_training_scenarios" ON training_scenarios FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_training_sessions" ON training_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_training_assignments" ON training_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_evaluation_questions" ON scenario_evaluation_questions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_question_bank" ON question_bank FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ✅ Schema complete! All tables, triggers, RLS policies are created.
-- Next: update your .env with the new SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
