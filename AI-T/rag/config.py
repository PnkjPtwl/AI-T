import os
from dotenv import load_dotenv

# Try loading backend/.env if available
backend_env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend/.env'))
if os.path.exists(backend_env_path):
    load_dotenv(backend_env_path)
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_VECTOR_TABLE = os.getenv("SUPABASE_VECTOR_TABLE", "document_embeddings")

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 700))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 120))

