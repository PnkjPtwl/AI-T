-- =====================================================
-- Migration 007: Dynamic Scorecard + Data Wipe
-- Run in Supabase SQL Editor
-- =====================================================

-- Step 1: Clear all existing training data (order matters due to FK)
DELETE FROM scenario_evaluation_questions;
DELETE FROM training_assignments;
DELETE FROM training_sessions;
DELETE FROM training_scenarios;

-- Step 2: Add new first-class columns to training_scenarios
ALTER TABLE training_scenarios
  ADD COLUMN IF NOT EXISTS contact_title TEXT,
  ADD COLUMN IF NOT EXISTS contact_company TEXT,
  ADD COLUMN IF NOT EXISTS scorecard_metrics JSONB;

-- scorecard_metrics stores: [{ name, description, weight }, ...]
-- contact_title / contact_company are the display identity (replaces persona_type for display)
