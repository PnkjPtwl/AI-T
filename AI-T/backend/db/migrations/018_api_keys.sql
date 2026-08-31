-- =====================================================
-- 018: API KEY MANAGEMENT
-- Stores API keys for ElevenLabs and Cerebras.
-- Admin can manage these from the admin panel.
-- Backend reads with service-role key (no RLS needed).
-- Supabase-stored keys take priority over .env.
-- =====================================================

CREATE TABLE IF NOT EXISTS api_keys (
  key_name   TEXT PRIMARY KEY,
  key_value  TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE api_keys IS 'Admin-managed API keys. Overrides .env values at runtime.';
COMMENT ON COLUMN api_keys.key_name IS 'Env-style key name, e.g. CEREBRAS_API_KEY';
COMMENT ON COLUMN api_keys.key_value IS 'Raw API key value -- accessible only via service_role';

-- RLS: only service_role can read/write
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_api_keys" ON api_keys
  FOR ALL TO service_role USING (true) WITH CHECK (true);
