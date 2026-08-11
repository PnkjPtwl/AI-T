-- ─────────────────────────────────────────────────────
-- 013: USER EXPERIENCE TABLE
-- Stores experience level (years) for sales reps
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_experience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  experience_years INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_experience_user_id ON user_experience(user_id);
