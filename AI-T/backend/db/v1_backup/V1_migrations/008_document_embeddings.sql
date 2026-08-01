-- =====================================================
-- 008: DOCUMENT EMBEDDINGS (pgvector for RAG)
-- Enables vector extension, document_embeddings table,
-- HNSW index, and match_documents function for Supabase.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding VECTOR(384), -- BAAI/bge-small-en-v1.5 vector dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HNSW index for high performance vector similarity search
CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector 
ON document_embeddings 
USING hnsw (embedding vector_cosine_ops);

-- Index metadata JSONB for fast filter queries
CREATE INDEX IF NOT EXISTS idx_document_embeddings_metadata 
ON document_embeddings 
USING gin (metadata);

-- RPC Function for similarity search
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding VECTOR(384),
  match_count INT DEFAULT 5,
  filter JSONB DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_embeddings.id,
    document_embeddings.content,
    document_embeddings.metadata,
    1 - (document_embeddings.embedding <=> query_embedding) AS similarity
  FROM document_embeddings
  WHERE document_embeddings.metadata @> filter
  ORDER BY document_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
