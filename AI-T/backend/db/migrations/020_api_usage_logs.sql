-- Creates an api_usage_logs table for tracking individual LLM requests.
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id UUID,
  call_type VARCHAR(255),
  model VARCHAR(255),
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  total_cost NUMERIC(15, 8) DEFAULT 0.00000000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
