"""
rag/api.py — RAG Knowledge Retrieval HTTP API

A lightweight FastAPI server that wraps the KnowledgeRetriever and exposes
it over HTTP so the Node.js backend can call it during live training sessions.

Start locally:
    cd AI-T
    ./venv/Scripts/uvicorn.exe rag.api:app --host 0.0.0.0 --port 8001 --reload

Endpoints:
    POST /search              — semantic KB search with optional account filter
    GET  /health              — liveness probe
    GET  /accounts            — list all KB accounts from Supabase
    POST /kb/upload           — upload & process docs for a custom KB account
    GET  /kb/list             — list all custom KB accounts from Supabase
    DELETE /kb/{slug}         — delete all embeddings for a KB account
"""

import sys
# Fix Windows cp1252 encoding crashes (emoji/Unicode in print statements)
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import os
import sys
import shutil
import logging
import tempfile
from typing import Optional, List

sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rag.retrieval.retriever import KnowledgeRetriever
from rag.vector_store.supabase_client import SupabaseStoreClient
from rag.ingestion.upload_pipeline import UploadPipeline

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
_upload_pipeline: Optional[UploadPipeline] = None


def get_retriever() -> KnowledgeRetriever:
    global _retriever
    if _retriever is None:
        logger.info("Initialising KnowledgeRetriever (loading models)...")
        _retriever = KnowledgeRetriever()
        logger.info("KnowledgeRetriever ready.")
    return _retriever


def get_upload_pipeline() -> UploadPipeline:
    global _upload_pipeline
    if _upload_pipeline is None:
        _upload_pipeline = UploadPipeline()
    return _upload_pipeline


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


# ─── Search Route ─────────────────────────────────────────────────────────────

@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):
    """
    Semantic search over the knowledge base.
    If account_name is provided, results are fetched for that account context.
    Returns top-k reranked chunks.
    """
    retriever = get_retriever()

    try:
        results = retriever.search(req.query, k=req.k, account_slug=req.account_name)

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


# ─── Accounts Route ───────────────────────────────────────────────────────────

@app.get("/accounts")
async def list_accounts():
    """
    Returns all KB account names from the knowledge_bases Supabase table.
    """
    try:
        client = SupabaseStoreClient.get_client()
        kb_res = client.table("knowledge_bases").select("slug, name, status").execute()
        accounts = [
            {"id": kb["slug"], "name": kb["name"]}
            for kb in (kb_res.data or [])
            if kb.get("slug") and kb.get("name")
        ]
        return {"accounts": accounts}

    except Exception as e:
        logger.exception("Failed to list accounts")
        return {"accounts": [], "error": str(e)}


# ─── KB Upload Route ──────────────────────────────────────────────────────────

@app.post("/kb/upload")
async def kb_upload(
    account_slug: str = Form(...),
    account_name: str = Form(...),
    document_category: str = Form("uploaded"),
    files: List[UploadFile] = File(...)
):
    """
    Receives uploaded documents (.md, .docx, .txt), processes them through the
    embedding pipeline, stores results in Supabase, and deletes the temp files.
    """
    logger.info(f"[KB Upload] Received {len(files)} file(s) for '{account_name}' (slug: {account_slug})")

    # Create a temporary directory to store uploaded files
    temp_dir = tempfile.mkdtemp(prefix="kb_upload_")
    temp_file_paths = []

    try:
        # Save uploaded files to temp dir
        for upload_file in files:
            filename = upload_file.filename or "unknown_file"
            ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

            # Only allow supported formats
            if ext not in ('md', 'docx', 'txt'):
                logger.warning(f"[KB Upload] Skipping unsupported file type: {filename}")
                continue

            safe_filename = "".join(c if c.isalnum() or c in ('_', '-', '.') else '_' for c in filename)
            temp_path = os.path.join(temp_dir, safe_filename)

            content = await upload_file.read()
            with open(temp_path, 'wb') as f:
                f.write(content)

            temp_file_paths.append(temp_path)
            logger.info(f"[KB Upload] Saved temp file: {safe_filename} ({len(content)} bytes)")

        if not temp_file_paths:
            return {
                "success": False,
                "error": "No supported files were uploaded (.md, .docx, .txt only)",
                "doc_count": 0,
                "chunk_count": 0
            }

        # Run the upload pipeline
        pipeline = get_upload_pipeline()
        result = pipeline.run(
            file_paths=temp_file_paths,
            account_slug=account_slug,
            account_name=account_name,
            document_category=document_category
        )

        return result

    except Exception as e:
        logger.exception(f"[KB Upload] Fatal error for {account_name}")
        return {
            "success": False,
            "error": str(e),
            "doc_count": 0,
            "chunk_count": 0
        }
    finally:
        # Always clean up temp files
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
            logger.info(f"[KB Upload] Cleaned up temp dir: {temp_dir}")
        except Exception as cleanup_err:
            logger.warning(f"[KB Upload] Temp cleanup warning: {cleanup_err}")


# ─── KB List Route ────────────────────────────────────────────────────────────

@app.get("/kb/list")
async def kb_list():
    """
    Returns all custom Knowledge Base accounts from the knowledge_bases table.
    """
    try:
        client = SupabaseStoreClient.get_client()
        res = client.table("knowledge_bases").select("*").order("created_at", desc=True).execute()
        return {"knowledge_bases": res.data or []}
    except Exception as e:
        logger.exception("Failed to list knowledge bases")
        return {"knowledge_bases": [], "error": str(e)}


# ─── KB Delete Route ──────────────────────────────────────────────────────────

@app.delete("/kb/{slug}")
async def kb_delete(slug: str):
    """
    Deletes all document embeddings for the given KB account slug.
    The knowledge_bases table row should be deleted by the Node.js backend.
    """
    try:
        pipeline = get_upload_pipeline()
        result = pipeline.delete_account_embeddings(slug)
        return result
    except Exception as e:
        logger.exception(f"Failed to delete embeddings for slug: {slug}")
        return {"success": False, "error": str(e)}


# ─── Health Route ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": _retriever is not None,
    }


# ─── HubSpot Routes ───────────────────────────────────────────────────────────

class HubSpotFetchRequest(BaseModel):
    account_name: str
    account_slug: Optional[str] = None

@app.get("/hubspot/accounts")
async def get_hubspot_accounts():
    """
    Returns all companies from HubSpot CRM to populate the UI dropdown.
    """
    try:
        from rag.connectors.hubspot.service import HubSpotService
        service = HubSpotService()
        accounts = service.list_companies()
        return {"accounts": accounts}
    except Exception as e:
        logger.exception("Failed to fetch hubspot accounts")
        return {"accounts": [], "error": str(e)}

@app.post("/hubspot/fetch")
async def fetch_hubspot(req: HubSpotFetchRequest):
    """
    Fetches raw CRM context from HubSpot for the given account name.
    Returns structured data for the UI preview.
    """
    try:
        from rag.connectors.hubspot.loader import HubSpotLoader
        loader = HubSpotLoader(target_company=req.account_name)
        docs = loader.load()
        
        # Structure the response for UI
        company = None
        contacts = []
        deals = []
        notes = []
        calls = []
        documents = []

        for d in docs:
            documents.append({
                "page_content": d.page_content,
                "metadata": d.metadata
            })
            
            doc_type = d.metadata.get("document_type")
            if doc_type == "crm_company":
                company = {"content": d.page_content, "metadata": d.metadata}
            elif doc_type == "crm_contact":
                contacts.append({"content": d.page_content, "metadata": d.metadata})
            elif doc_type == "crm_deal":
                deals.append({"content": d.page_content, "metadata": d.metadata})
            elif doc_type == "crm_note":
                notes.append({"content": d.page_content, "metadata": d.metadata})
            elif doc_type == "crm_call":
                calls.append({"content": d.page_content, "metadata": d.metadata})
            
        return {
            "success": True, 
            "company": company,
            "contacts": contacts,
            "deals": deals,
            "notes": notes,
            "calls": calls,
            "documents": documents
        }
    except Exception as e:
        logger.exception("Failed to fetch hubspot data")
        return {"success": False, "error": str(e), "documents": []}


class HubSpotIngestRequest(BaseModel):
    account_name: str
    account_slug: str

@app.post("/hubspot/ingest")
async def ingest_hubspot(req: HubSpotIngestRequest):
    """
    Fetches CRM data from HubSpot and ingests it into the knowledge base.
    """
    try:
        from rag.connectors.hubspot.loader import HubSpotLoader
        loader = HubSpotLoader(target_company=req.account_name)
        docs = loader.load()
        
        if not docs:
            return {"success": False, "error": "No documents found to ingest"}

        pipeline = get_upload_pipeline()
        result = pipeline.run_from_documents(
            documents=docs,
            account_slug=req.account_slug,
            account_name=req.account_name,
            document_category="crm"
        )
        return result
    except Exception as e:
        logger.exception(f"Failed to ingest hubspot data for {req.account_name}")
        return {"success": False, "error": str(e)}

