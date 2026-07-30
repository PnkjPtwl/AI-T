import os
import sys
from dotenv import load_dotenv

# Load env from backend/.env if available
backend_env = os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend', '.env'))
if os.path.exists(backend_env):
    load_dotenv(backend_env)
else:
    load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

print(f"Supabase URL: {supabase_url}")
print(f"Key configured: {'Yes' if supabase_key else 'No'}")

try:
    from supabase import create_client, Client
    supabase: Client = create_client(supabase_url, supabase_key)
    res = supabase.table("document_embeddings").select("id").limit(1).execute()
    print("Table 'document_embeddings' exists and is accessible!")
except Exception as e:
    print(f"Table query response: {e}")
