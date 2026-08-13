-- =====================================================
-- 015: KNOWLEDGE BASES
-- Tracks custom KB accounts created by managers.
-- Each KB corresponds to uploaded documents embedded in document_embeddings
-- with metadata.account = slug.
-- =====================================================

CREATE TABLE IF NOT EXISTS knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'processing', 'error')),
  document_count INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_bases_org_id ON knowledge_bases(org_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_slug ON knowledge_bases(slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_status ON knowledge_bases(status);

-- Auto updated_at trigger
DROP TRIGGER IF EXISTS update_knowledge_bases_updated_at ON knowledge_bases;
CREATE TRIGGER update_knowledge_bases_updated_at
BEFORE UPDATE ON knowledge_bases FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_knowledge_bases"
ON knowledge_bases FOR ALL TO service_role USING (true) WITH CHECK (true);
