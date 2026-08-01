-- Add enhanced fields to training_scenarios
ALTER TABLE training_scenarios 
ADD COLUMN IF NOT EXISTS personality_traits TEXT,
ADD COLUMN IF NOT EXISTS evaluation_focus TEXT,
ADD COLUMN IF NOT EXISTS objection_style TEXT,
ADD COLUMN IF NOT EXISTS conversation_expectations TEXT,
ADD COLUMN IF NOT EXISTS target_skills TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for training_scenarios
DROP TRIGGER IF EXISTS update_training_scenarios_updated_at ON training_scenarios;
CREATE TRIGGER update_training_scenarios_updated_at
BEFORE UPDATE ON training_scenarios
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
