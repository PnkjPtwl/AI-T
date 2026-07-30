import os
import sys
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from rag.vector_store.supabase_client import SupabaseStoreClient
from rag.retrieval.retriever import KnowledgeRetriever

def deep_verify():
    client = SupabaseStoreClient.get_client()
    
    # 1. Fetch raw sample records including embedding vector length and metadata
    res = client.table("document_embeddings").select("id, content, metadata, embedding").limit(5).execute()
    rows = res.data or []
    
    print("--- 1. DIRECT DATABASE INSPECTION ---")
    print(f"Sample DB Rows Retrieved: {len(rows)}")
    for idx, r in enumerate(rows, 1):
        emb = r.get("embedding")
        emb_type = type(emb).__name__
        # If stored as string representation or list
        if isinstance(emb, str):
            emb_len = len(emb.strip("[]").split(","))
        elif isinstance(emb, list):
            emb_len = len(emb)
        else:
            emb_len = "Present"
            
        meta = r.get("metadata", {})
        folder = meta.get("folder")
        file_name = meta.get("filename")
        snippet = r.get("content", "")[:90].replace("\n", " ")
        print(f"Row {idx} | ID: {r.get('id')[:8]}... | Vector Dimension: {emb_len} | Folder: {folder} | File: {file_name}")
        print(f"        Content Snippet: \"{snippet}...\"\n")

    # 2. Test semantic similarity search across distinct document types
    print("--- 2. REAL QUERY RETRIEVAL TESTS ---")
    retriever = KnowledgeRetriever()
    
    queries = [
        ("Seller docx test", "What is the warranty coverage and manufacturing capability of Relanto automotive components?"),
        ("Customer md test", "What are Phoenix Automotive's primary pain points and compliance requirements?"),
        ("Deal history test", "Summarize what was discussed in call 01 regarding the brake system modernization.")
    ]
    
    for label, q in queries:
        print(f"\n[Test: {label}]")
        print(f"Query: \"{q}\"")
        results = retriever.search(q, k=2)
        for doc, score in results:
            folder = doc.metadata.get("folder")
            fn = doc.metadata.get("filename")
            print(f"  -> Match Score: {score:.4f} | Folder: {folder} | File: {fn}")
            print(f"     Content: {doc.page_content[:140].replace('\n', ' ')}...\n")

if __name__ == "__main__":
    deep_verify()
