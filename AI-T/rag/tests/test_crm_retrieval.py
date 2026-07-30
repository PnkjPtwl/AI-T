import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from rag.retrieval.retriever import KnowledgeRetriever

def run_tests():
    retriever = KnowledgeRetriever()
    
    queries = [
        # 1. Direct match for Markdown documents
        "Who are the main competitors of Phoenix?",
        
        # 2. Direct match for CRM Contacts (Includes deliberate typo "phoeanox")
        "What are the contacts related to the phoeanox account?",
        
        # 3. Contextual/Indirect match
        "Based on Phoenix's current active deals and projects, what is their primary strategic goal for the near future?"
    ]
    
    print("\n" + "="*60)
    print("RUNNING HYBRID RAG RETRIEVAL TESTS")
    print("="*60)
    
    for i, q in enumerate(queries, 1):
        print(f"\n[Query {i}]: '{q}'")
        print("-" * 60)
        
        try:
            # Fetch top 3 results
            results = retriever.search(q, k=3)
            if results:
                for idx, (doc, score) in enumerate(results, 1):
                    source = doc.metadata.get("source", "Unknown")
                    doc_type = doc.metadata.get("document_type", "Unknown")
                    
                    print(f"Result {idx} (Score: {score:.4f} | Type: {doc_type} | Source: {source})")
                    print(f"Snippet: {doc.page_content[:200].strip()}...\n")
            else:
                print("No results found.\n")
        except Exception as e:
            print(f"Error querying: {e}\n")
            
if __name__ == "__main__":
    run_tests()
