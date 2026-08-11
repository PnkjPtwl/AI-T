"""
rag/api.py — RAG Knowledge Retrieval HTTP API

A lightweight FastAPI server that wraps the KnowledgeRetriever and exposes
it over HTTP so the Node.js backend can call it during live training sessions.

Start locally:
    cd AI-T
    ./venv/Scripts/uvicorn.exe rag.api:app --host 0.0.0.0 --port 8001 --reload

Endpoints:
    POST /search  — semantic KB search with optional account filter
    GET  /health  — liveness probe
    GET  /accounts — list all unique account names in the KB
"""

import os
import sys
import logging
from typing import Optional, List

sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rag.retrieval.retriever import KnowledgeRetriever
from rag.vector_store.supabase_client import SupabaseStoreClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rag-api")

app = FastAPI(title="SalesCoach RAG API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Singleton retriever (loads embedding model + reranker once at startup)
_retriever: Optional[KnowledgeRetriever] = None


def get_retriever() -> KnowledgeRetriever:
    global _retriever
    if _retriever is None:
        logger.info("Initialising KnowledgeRetriever (loading models)...")
        _retriever = KnowledgeRetriever()
        logger.info("KnowledgeRetriever ready.")
    return _retriever


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    account_name: Optional[str] = None   # e.g. "phoenix automotive"
    k: int = 5                           # balanced default: 5 chunks


class ChunkResult(BaseModel):
    content: str
    folder: str
    filename: str
    score: float


class SearchResponse(BaseModel):
    query: str
    account_name: Optional[str]
    results: List[ChunkResult]
    count: int


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):
    """
    Semantic search over the knowledge base.
    If account_name is provided, results are fetched for that account context.
    Returns top-k reranked chunks.
    """
    retriever = get_retriever()

    try:
        # All KB docs (customer, seller, deal_history) belong to the Phoenix Automotive opportunity
        results = retriever.search(req.query, k=req.k)

        chunks = []
        for doc, score in results:
            chunks.append(ChunkResult(
                content=doc.page_content,
                folder=doc.metadata.get("folder", "unknown"),
                filename=doc.metadata.get("filename", "unknown"),
                score=round(float(score), 4)
            ))

        return SearchResponse(
            query=req.query,
            account_name=req.account_name,
            results=chunks,
            count=len(chunks)
        )

    except Exception as e:
        logger.exception(f"Search failed for query: {req.query}")
        return SearchResponse(
            query=req.query,
            account_name=req.account_name,
            results=[],
            count=0
        )


@app.get("/accounts")
async def list_accounts():
    """
    Returns unique customer account names in the knowledge base.
    Excludes internal category folder names (customer, seller, deal_history, relanto).
    Standardizes 'phoenix' to 'Phoenix Automotive'.
    """
    try:
        client = SupabaseStoreClient.get_client()
        res = client.table("document_embeddings").select("metadata").execute()
        
        # Reserved system folder names that are NOT customer account names
        system_folders = {"customer", "seller", "deal_history", "relanto", "unknown", "phoenix"}
        
        raw_accounts = set()
        for row in (res.data or []):
            meta = row.get("metadata", {})
            for key in ("account", "company"):
                val = meta.get(key, "")
                if val and isinstance(val, str) and val.strip().lower() not in system_folders:
                    raw_accounts.add(val.strip())
        
        # Standardized account list (defaulting to Phoenix Automotive)
        formatted_accounts = [
            {"id": "phoenix_automotive", "name": "Phoenix Automotive"}
        ]
        
        for acc in sorted(raw_accounts):
            acc_id = acc.lower().replace(" ", "_")
            if acc_id not in [a["id"] for a in formatted_accounts] and "phoenix" not in acc_id:
                formatted_accounts.append({"id": acc_id, "name": acc})
        
        return {"accounts": formatted_accounts}

    except Exception as e:
        logger.exception("Failed to list accounts")
        return {
            "accounts": [
                {"id": "phoenix_automotive", "name": "Phoenix Automotive"}
            ]
        }


from rag.tracker.sync_agent import get_phoenix_sync_agent

@app.on_event("startup")
async def startup_event():
    logger.info("Initializing Phoenix Automotive Background Sync Agent...")
    agent = get_phoenix_sync_agent()
    # Run initial sync and start background polling worker (every 10 mins)
    agent.start_background_tracker(interval_seconds=600)


@app.post("/sync/phoenix")
async def sync_phoenix():
    """
    Triggers an immediate live sync for Phoenix Automotive.
    Captures new/updated CRM records from HubSpot and email threads from Gmail,
    embeds them, and updates the Supabase Vector Store.
    """
    try:
        agent = get_phoenix_sync_agent()
        status = agent.sync_now()
        return {"success": True, "message": "Phoenix Automotive sync completed", "data": status}
    except Exception as e:
        logger.exception("Failed to sync Phoenix Automotive")
        return {"success": False, "error": str(e)}


@app.get("/sync/status")
async def sync_status():
    """
    Returns the live sync status, document count, and last sync timestamp for Phoenix Automotive.
    """
    agent = get_phoenix_sync_agent()
    return agent.get_status()


@app.get("/health")
def health():
    agent = get_phoenix_sync_agent()
    return {
        "status": "ok",
        "model_loaded": _retriever is not None,
        "sync_agent": agent.get_status()
    }

