-- Creates an api_costs table to store global configurations.
CREATE TABLE IF NOT EXISTS api_costs (
  provider VARCHAR(255) PRIMARY KEY,
  balance NUMERIC(10, 4) DEFAULT 0.0000,
  input_token_cost NUMERIC(15, 8) DEFAULT 0.00000000,
  output_token_cost NUMERIC(15, 8) DEFAULT 0.00000000,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Insert initial configuration for Cerebras with a balance of $4.43
INSERT INTO api_costs (provider, balance, input_token_cost, output_token_cost)
VALUES ('cerebras', 4.4300, 0.00000000, 0.00000000)
ON CONFLICT (provider) DO UPDATE 
SET balance = EXCLUDED.balance, 
    updated_at = timezone('utc', now());
