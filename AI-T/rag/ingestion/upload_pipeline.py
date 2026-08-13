"""
rag/ingestion/upload_pipeline.py

Lightweight ingestion pipeline for manager-uploaded documents.
Unlike the main IngestionPipeline, this:
- Accepts a list of file paths (temp files) rather than a directory
- Tags all chunks with the provided account slug
- Does NOT wipe existing embeddings (appends only)
- Returns stats after completion
"""

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from typing import List, Dict, Any

from rag.loaders.multi_format_loader import MultiFormatLoader
from rag.processor.normalizer import DocumentNormalizer
from rag.processor.chunker import DocumentChunker
from rag.processor.metadata_builder import MetadataBuilder
from rag.embeddings.embedder import EmbedderSingleton
from rag.vector_store.supabase_store import SupabaseVectorStore
from rag.vector_store.supabase_client import SupabaseStoreClient
from rag import config


class UploadPipeline:
    """
    Processes uploaded documents for a custom KB account and stores
    their embeddings in Supabase. Temporary files are cleaned up by the caller.
    """

    def __init__(self):
        self.normalizer = DocumentNormalizer()
        self.chunker = DocumentChunker()
        self.metadata_builder = MetadataBuilder()
        self.embedder = EmbedderSingleton.get_instance()
        self.vector_store = SupabaseVectorStore(embedder=self.embedder)

    def run(
        self,
        file_paths: List[str],
        account_slug: str,
        account_name: str,
        document_category: str = 'uploaded',
    ) -> Dict[str, Any]:
        """
        Process files and upsert embeddings into Supabase.

        Args:
            file_paths:          Absolute paths to temporary uploaded files.
            account_slug:        Normalized slug (e.g. "acme_corp").
            account_name:        Human-readable KB name.
            document_category:   One of: customer | deal_history | seller | uploaded

        Returns:
            dict with doc_count, chunk_count, success, error (if any)
        """
        print(f"[UploadPipeline] Starting for KB: '{account_name}' (slug: {account_slug}, category: {document_category})")

        try:
            # 1. Load documents
            loader = MultiFormatLoader(file_paths, account_slug, account_name, document_category)
            docs = loader.load()

            if not docs:
                return {
                    "success": False,
                    "error": "No readable content found in the uploaded files.",
                    "doc_count": 0,
                    "chunk_count": 0
                }

            print(f"[UploadPipeline] Loaded {len(docs)} document(s).")

            # 2. Normalize
            normalized = self.normalizer.normalize(docs)

            # 3. Chunk
            chunks = self.chunker.chunk(normalized)
            print(f"[UploadPipeline] Created {len(chunks)} chunk(s).")

            # 4. Build metadata
            enriched_chunks = self.metadata_builder.build(chunks)

            # 5. Explicitly ensure account + category tag on every chunk
            for chunk in enriched_chunks:
                chunk.metadata["account"] = account_slug
                chunk.metadata["company"] = account_slug
                chunk.metadata["account_name"] = account_name
                chunk.metadata["folder"] = document_category          # customer | deal_history | seller
                chunk.metadata["document_category"] = document_category
                chunk.metadata["upload_source"] = "manager_upload"

            # 6. Embed & upload (append — no wipe)
            print(f"[UploadPipeline] Embedding and uploading {len(enriched_chunks)} chunks...")
            self.vector_store.add_documents(enriched_chunks, batch_size=50)

            print(f"[UploadPipeline] Complete! {len(docs)} docs -> {len(enriched_chunks)} chunks for '{account_name}'.")

            return {
                "success": True,
                "doc_count": len(docs),
                "chunk_count": len(enriched_chunks),
                "account_slug": account_slug,
                "account_name": account_name
            }

        except Exception as e:
            print(f"[UploadPipeline] ERROR: {e}")
            return {
                "success": False,
                "error": str(e),
                "doc_count": 0,
                "chunk_count": 0
            }

    def delete_account_embeddings(self, account_slug: str) -> Dict[str, Any]:
        """
        Removes all document_embeddings rows where metadata.account = account_slug.
        Used when a manager deletes a KB account.
        """
        try:
            client = SupabaseStoreClient.get_client()
            client.table(config.SUPABASE_VECTOR_TABLE)\
                .delete()\
                .contains("metadata", {"account": account_slug})\
                .execute()
            print(f"[UploadPipeline] Deleted all embeddings for account: {account_slug}")
            return {"success": True, "deleted_account": account_slug}
        except Exception as e:
            print(f"[UploadPipeline] Error deleting embeddings for {account_slug}: {e}")
            return {"success": False, "error": str(e)}
