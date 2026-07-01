-- 007_assignment_lifecycle.sql
-- Add lifecycle tracking to training_assignments

ALTER TABLE training_assignments 
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES training_sessions(id) ON DELETE SET NULL;

-- Ensure status has correct default and constraints
ALTER TABLE training_assignments 
ALTER COLUMN status SET DEFAULT 'Pending';

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_training_assignments_updated_at ON training_assignments;
CREATE TRIGGER update_training_assignments_updated_at
BEFORE UPDATE ON training_assignments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

BEFORE UPDATE ON training_assignments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
