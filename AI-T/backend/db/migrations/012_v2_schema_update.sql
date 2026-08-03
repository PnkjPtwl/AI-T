-- =====================================================
-- MIGRATION 012: SALESCOACH VERSION 2 SCHEMA OVERHAUL
-- Adds support for rich persona metadata, snapshots, 
-- emotion & speech analytics, assignments workflow, and team analytics.
-- =====================================================

-- 1. USERS: Add team_name for Manager Cohort Comparisons
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS team_name TEXT DEFAULT 'Enterprise';

-- 2. TRAINING SCENARIOS: Rich Persona metadata & V2 fields
ALTER TABLE training_scenarios 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS estimated_duration_mins INTEGER DEFAULT 25,
ADD COLUMN IF NOT EXISTS conversation_stages JSONB DEFAULT '["Opening", "Discovery", "Pitch & Presentation", "Objection Handling", "Closing", "Product knowledge"]'::jsonb,
ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS buying_style TEXT,
ADD COLUMN IF NOT EXISTS communication_style TEXT,
ADD COLUMN IF NOT EXISTS priority_goals TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS customer_background TEXT,
ADD COLUMN IF NOT EXISTS business_goals TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS pain_points TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS expected_objections TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS meeting_objective TEXT,
ADD COLUMN IF NOT EXISTS buying_signals TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS skills_evaluated TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS ai_behavior_profile TEXT,
ADD COLUMN IF NOT EXISTS decision_drivers TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS knowledge_base_id TEXT,
ADD COLUMN IF NOT EXISTS scorecard_json JSONB,
ADD COLUMN IF NOT EXISTS avatar_config JSONB,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS evaluation_questions_json JSONB;

-- 3. TRAINING SESSIONS: Stage tracking, snapshots, metrics & assignment link
ALTER TABLE training_sessions
ADD COLUMN IF NOT EXISTS current_stage TEXT DEFAULT 'Opening',
ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS snapshot_json JSONB,
ADD COLUMN IF NOT EXISTS metrics_json JSONB,
ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES training_assignments(id) ON DELETE SET NULL;

-- Index for session assignment lookup
CREATE INDEX IF NOT EXISTS idx_training_sessions_assignment_id ON training_sessions(assignment_id);

-- 4. TRAINING ASSIGNMENTS: Advanced options, notes, assigner & mode
ALTER TABLE training_assignments
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS notify_immediate BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_reminder BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_completion BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS training_mode TEXT DEFAULT 'Coach Mode';

-- Additional Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_team_name ON users(team_name);
CREATE INDEX IF NOT EXISTS idx_training_scenarios_kb_id ON training_scenarios(knowledge_base_id);
