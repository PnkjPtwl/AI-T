import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from rag.retrieval.retriever import KnowledgeRetriever

def run_tests():
    retriever = KnowledgeRetriever()
    
    queries = [
        "What products does Relanto offer?",
        "Who is Phoenix?",
        "What compliance requirements does Phoenix have?",
        "Who are Phoenix's competitors?",
        "What pricing model does Relanto use?"
    ]
    
    print("Testing Retrieval...")
    success = 0
    for q in queries:
        print(f"\\nQuery: {q}")
        try:
            results = retriever.search(q, k=2)
            if results:
                success += 1
                for doc, score in results:
                    print(f"Similarity: {score:.4f}")
                    print(f"Metadata: {doc.metadata}")
                    print(f"Content snippet: {doc.page_content[:100]}...")
            else:
                print("No results found.")
        except Exception as e:
            print(f"Error querying: {e}")
            
    print(f"\\n{success}/{len(queries)} Queries Successful")

if __name__ == "__main__":
    run_tests()
