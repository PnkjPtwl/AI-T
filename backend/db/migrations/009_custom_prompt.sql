-- Add custom_prompt column to training_scenarios
ALTER TABLE training_scenarios 
ADD COLUMN IF NOT EXISTS custom_prompt TEXT;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
