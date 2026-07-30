import sys
import os
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from rag.ingestion.pipeline import IngestionPipeline

if __name__ == "__main__":
    docs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "AI-trainer-KB"))
    print(f"Starting Ingestion for: {docs_dir}")
    
    pipeline = IngestionPipeline(docs_dir)
    pipeline.run(wipe_first=True)
