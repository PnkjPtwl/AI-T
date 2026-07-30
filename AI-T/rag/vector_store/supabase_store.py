import time
from typing import List, Tuple, Dict, Any
from langchain_core.documents import Document
from rag.vector_store.supabase_client import SupabaseStoreClient
from rag import config

class SupabaseVectorStore:
    def __init__(self, embedder):
        self.client = SupabaseStoreClient.get_client()
        self.embedder = embedder
        self.table_name = config.SUPABASE_VECTOR_TABLE

    def wipe_all(self):
        """Wipes all vector embeddings from the Supabase table."""
        try:
            # Delete all rows where id is not null
            self.client.table(self.table_name).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            print(f"Cleared existing vectors in Supabase table '{self.table_name}'.")
        except Exception as e:
            print(f"Warning wiping Supabase vectors: {e}")

    def add_documents(self, documents: List[Document], batch_size: int = 50):
        """Embeds and uploads documents in batches to Supabase."""
        total = len(documents)
        print(f"Uploading {total} documents to Supabase '{self.table_name}'...")
        start_time = time.time()

        for i in range(0, total, batch_size):
            batch_docs = documents[i : i + batch_size]
            texts = [doc.page_content for doc in batch_docs]
            
            # Generate embeddings batch
            embeddings = self.embedder.embed_documents(texts)
            
            rows = []
            for doc, emb in zip(batch_docs, embeddings):
                rows.append({
                    "content": doc.page_content,
                    "metadata": doc.metadata,
                    "embedding": emb
                })

            self.client.table(self.table_name).insert(rows).execute()

            elapsed = time.time() - start_time
            processed = min(i + batch_size, total)
            rate = processed / elapsed if elapsed > 0 else 1
            eta = (total - processed) / rate if rate > 0 else 0
            print(f"Uploaded {processed}/{total} chunks ({(processed/total)*100:.1f}%) - ETA: {int(eta)}s")

        print("Supabase Upload Complete!")

    def similarity_search_with_score(self, query: str, k: int = 5, filter_metadata: Dict[str, Any] = None) -> List[Tuple[Document, float]]:
        """Searches Supabase for similar document chunks using vector matching."""
        query_vector = self.embedder.embed_query(query)
        
        try:
            # Try using RPC match_documents function
            rpc_params = {
                "query_embedding": query_vector,
                "match_count": k,
                "filter": filter_metadata or {}
            }
            res = self.client.rpc("match_documents", rpc_params).execute()
            matches = res.data or []
            
            results = []
            for match in matches:
                doc = Document(
                    page_content=match.get("content", ""),
                    metadata=match.get("metadata", {})
                )
                score = match.get("similarity", 0.0)
                results.append((doc, score))
            return results
        except Exception as e:
            print(f"RPC match_documents failed ({e}), falling back to direct table query...")
            res = self.client.table(self.table_name).select("id, content, metadata").limit(k).execute()
            matches = res.data or []
            return [(Document(page_content=m.get("content", ""), metadata=m.get("metadata", {})), 0.8) for m in matches]
