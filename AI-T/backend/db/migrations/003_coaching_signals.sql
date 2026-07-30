-- 003_coaching_signals.sql
-- Create coaching_signals table

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
