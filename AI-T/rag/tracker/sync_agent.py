import os
import sys
import time
import threading
import logging
from datetime import datetime
from typing import Dict, Any, List

from rag.connectors.hubspot.loader import HubSpotLoader
from rag.connectors.gmail.loader import GmailLoader
from rag.processor.normalizer import DocumentNormalizer
from rag.processor.chunker import DocumentChunker
from rag.processor.metadata_builder import MetadataBuilder
from rag.embeddings.embedder import EmbedderSingleton
from rag.vector_store.supabase_store import SupabaseVectorStore

logger = logging.getLogger("phoenix-sync-agent")
logging.basicConfig(level=logging.INFO)

class PhoenixSyncAgent:
    def __init__(self, target_company: str = "Phoenix Automotive"):
        self.target_company = target_company
        self.account_id = target_company.lower().replace(" ", "_")
        self.hubspot_loader = HubSpotLoader(target_company=target_company)
        self.gmail_loader = GmailLoader(target_company=target_company)
        self.normalizer = DocumentNormalizer()
        self.chunker = DocumentChunker()
        self.metadata_builder = MetadataBuilder()
        self.embedder = EmbedderSingleton.get_instance()
        self.vector_store = SupabaseVectorStore(embedder=self.embedder)

        self._last_sync_time: str = None
        self._last_doc_count: int = 0
        self._last_chunk_count: int = 0
        self._is_syncing: bool = False
        self._thread: threading.Thread = None
        self._stop_event = threading.Event()

    def get_status(self) -> Dict[str, Any]:
        return {
            "account": self.target_company,
            "account_id": self.account_id,
            "is_syncing": self._is_syncing,
            "last_sync_time": self._last_sync_time,
            "document_count": self._last_doc_count,
            "chunk_count": self._last_chunk_count,
            "hubspot_configured": bool(os.getenv("HUBSPOT_ACCESS_TOKEN")),
            "gmail_configured": bool(os.getenv("GMAIL_USER_EMAIL") and os.getenv("GMAIL_APP_PASSWORD"))
        }

    def sync_now(self) -> Dict[str, Any]:
        if self._is_syncing:
            logger.info("[PhoenixSyncAgent] Sync already in progress, skipping trigger")
            return self.get_status()

        self._is_syncing = True
        logger.info(f"[PhoenixSyncAgent] Starting live data capture for {self.target_company}...")

        try:
            documents: List = []

            # 1. Fetch CRM updates from HubSpot
            try:
                hubspot_docs = self.hubspot_loader.load()
                if hubspot_docs:
                    documents.extend(hubspot_docs)
                    logger.info(f"[PhoenixSyncAgent] Captured {len(hubspot_docs)} HubSpot CRM docs")
            except Exception as e:
                logger.error(f"[PhoenixSyncAgent] HubSpot sync error: {e}")

            # 2. Fetch email threads from Gmail
            try:
                gmail_docs = self.gmail_loader.load()
                if gmail_docs:
                    documents.extend(gmail_docs)
                    logger.info(f"[PhoenixSyncAgent] Captured {len(gmail_docs)} Gmail email thread docs")
            except Exception as e:
                logger.error(f"[PhoenixSyncAgent] Gmail sync error: {e}")

            if not documents:
                logger.warning("[PhoenixSyncAgent] 0 documents fetched during sync")
                self._is_syncing = False
                return self.get_status()

            # 3. Process, Chunk, & Build Metadata
            normalized = self.normalizer.normalize(documents)
            chunks = self.chunker.chunk(normalized)
            enriched_chunks = self.metadata_builder.build(chunks)

            # Ensure company/account tag is explicitly set
            for chunk in enriched_chunks:
                chunk.metadata["account"] = self.account_id
                chunk.metadata["company"] = self.account_id

            logger.info(f"[PhoenixSyncAgent] Created {len(enriched_chunks)} chunks from {len(documents)} docs")

            # 4. Embed & Upsert to Supabase Vector Store
            self.vector_store.add_documents(enriched_chunks, batch_size=50)

            self._last_sync_time = datetime.utcnow().isoformat() + "Z"
            self._last_doc_count = len(documents)
            self._last_chunk_count = len(enriched_chunks)

            logger.info(f"✅ [PhoenixSyncAgent] Sync complete! Uploaded {len(enriched_chunks)} vectors to Supabase for {self.target_company}.")

        except Exception as err:
            logger.error(f"❌ [PhoenixSyncAgent] Fatal sync error: {err}", exc_info=True)
        finally:
            self._is_syncing = False

        return self.get_status()

    def start_background_tracker(self, interval_seconds: int = 600):
        """Starts periodic background polling loop in a daemon thread."""
        if self._thread and self._thread.is_alive():
            logger.info("[PhoenixSyncAgent] Background tracker thread already running.")
            return

        def polling_loop():
            logger.info(f"[PhoenixSyncAgent] Background tracker started (interval: {interval_seconds}s)...")
            while not self._stop_event.is_set():
                try:
                    self.sync_now()
                except Exception as e:
                    logger.error(f"[PhoenixSyncAgent] Background polling error: {e}")
                self._stop_event.wait(interval_seconds)

        self._stop_event.clear()
        self._thread = threading.Thread(target=polling_loop, daemon=True)
        self._thread.start()

    def stop_background_tracker(self):
        self._stop_event.set()


# Singleton instance
_phoenix_agent_instance = None

def get_phoenix_sync_agent() -> PhoenixSyncAgent:
    global _phoenix_agent_instance
    if _phoenix_agent_instance is None:
        _phoenix_agent_instance = PhoenixSyncAgent("Phoenix Automotive")
    return _phoenix_agent_instance
