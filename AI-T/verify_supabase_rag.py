import sys
import os
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from rag.retrieval.retriever import KnowledgeRetriever
from rag.vector_store.supabase_client import SupabaseStoreClient

def verify():
    client = SupabaseStoreClient.get_client()
    res = client.table("document_embeddings").select("id, metadata").execute()
    total_points = len(res.data)
    print(f"Total Vector Points in Supabase: {total_points}")
    
    retriever = KnowledgeRetriever()
    queries = [
        "What products and technical capabilities does the seller offer?",
        "What are the customer business goals and pain points?",
        "What communication happened in call01 and deal history?"
    ]
    
    print("\n--- Testing Supabase RAG Vector Retrieval ---")
    for q in queries:
        print(f"\n[Query]: {q}")
        results = retriever.search(q, k=2)
        for doc, score in results:
            folder = doc.metadata.get("folder", "unknown")
            filename = doc.metadata.get("filename", "unknown")
            snippet = doc.page_content[:120].replace("\n", " ")
            print(f" -> Score: {score:.4f} | Folder: {folder} | File: {filename}")
            print(f"    Snippet: {snippet}...")

if __name__ == "__main__":
    verify()
