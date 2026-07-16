-- ================================================================
-- MIGRATION: Add training_mode to training_assignments
-- Run this in Supabase SQL Editor
-- ================================================================

ALTER TABLE training_assignments
ADD COLUMN IF NOT EXISTS training_mode TEXT
  DEFAULT 'learning'
  CHECK (training_mode IN ('exam', 'coach', 'learning'));

-- Update existing rows to default value
UPDATE training_assignments
SET training_mode = 'learning'
WHERE training_mode IS NULL;
