from rag.embeddings.embedder import EmbedderSingleton
from rag.vector_store.supabase_store import SupabaseVectorStore
from rag.retrieval.reranker import RerankerSingleton
import numpy as np

class KnowledgeRetriever:
    def __init__(self):
        embedder = EmbedderSingleton.get_instance()
        self.vector_store = SupabaseVectorStore(embedder=embedder)
        self.reranker = RerankerSingleton.get_instance()

    def search(self, query: str, k: int = 5, account_slug: str = None):
        # 1. Fetch more documents initially (k * 4) to ensure high recall
        initial_k = k * 4
        
        filter_metadata = {}
        if account_slug:
            filter_metadata["account"] = account_slug
            
        base_results = self.vector_store.similarity_search_with_score(
            query, 
            k=initial_k, 
            filter_metadata=filter_metadata
        )
        
        if not base_results:
            return []
            
        # 2. Extract texts for cross-encoder scoring
        docs = [res[0] for res in base_results]
        texts = [doc.page_content for doc in docs]
        
        # 3. Create pairs: (query, document_text)
        pairs = [[query, text] for text in texts]
        
        # 4. Score using the CrossEncoder
        scores = self.reranker.predict(pairs)
        
        # 5. Sort by new scores descending
        scored_docs = list(zip(docs, scores))
        scored_docs.sort(key=lambda x: x[1], reverse=True)
        
        # 6. Return top k
        return scored_docs[:k]
