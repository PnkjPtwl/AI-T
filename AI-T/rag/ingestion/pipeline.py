import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from rag.loaders.markdown_loader import MarkdownLoader
from rag.processor.normalizer import DocumentNormalizer
from rag.processor.chunker import DocumentChunker
from rag.processor.metadata_builder import MetadataBuilder
from rag.embeddings.embedder import EmbedderSingleton
from rag.vector_store.supabase_store import SupabaseVectorStore
from rag import config

from rag.connectors.hubspot.loader import HubSpotLoader

class IngestionPipeline:
    def __init__(self, docs_dir: str):
        self.docs_dir = docs_dir
        self.loader = MarkdownLoader(docs_dir)
        self.hubspot_loader = HubSpotLoader(target_company="Phoenix")
        self.normalizer = DocumentNormalizer()
        self.chunker = DocumentChunker()
        self.metadata_builder = MetadataBuilder()
        self.embedder = EmbedderSingleton.get_instance()
        self.vector_store = SupabaseVectorStore(embedder=self.embedder)
        
    def run(self, wipe_first: bool = False):
        print(f"Loading Knowledge Base Documents from '{self.docs_dir}'...")
        docs = self.loader.load()
        print(f"{len(docs)} documents loaded (.md and .docx)")
        
        try:
            hubspot_docs = self.hubspot_loader.load()
            if hubspot_docs:
                docs.extend(hubspot_docs)
        except Exception as e:
            print(f"Hubspot load skipped/failed: {e}")
        
        print("Normalizing documents...")
        normalized = self.normalizer.normalize(docs)
        
        print("Chunking documents...")
        chunks = self.chunker.chunk(normalized)
        print(f"{len(chunks)} total chunks created")
        
        print("Building Metadata...")
        enriched_chunks = self.metadata_builder.build(chunks)
        
        if not enriched_chunks:
            print("No chunks to process. Exiting.")
            return

        if wipe_first:
            print("Wiping existing vectors from Supabase...")
            self.vector_store.wipe_all()

        print("Embedding and Uploading chunks to Supabase...")
        self.vector_store.add_documents(enriched_chunks, batch_size=50)
        print("==> Ingestion to Supabase Complete!")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--docs-dir", type=str, required=True, help="Directory containing KB docs")
    parser.add_argument("--wipe", action="store_true", help="Wipe existing vectors before ingestion")
    args = parser.parse_args()
    
    pipeline = IngestionPipeline(args.docs_dir)
    pipeline.run(wipe_first=args.wipe)

