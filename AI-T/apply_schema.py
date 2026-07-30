import os
import requests
from dotenv import load_dotenv

backend_env = os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend', '.env'))
load_dotenv(backend_env)

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json"
}

sql_file = os.path.join(os.path.dirname(__file__), 'backend', 'db', 'migrations', '008_document_embeddings.sql')
with open(sql_file, 'r', encoding='utf-8') as f:
    sql_script = f.read()

# Try calling rpc/exec_sql or query endpoints
print("Attempting to initialize document_embeddings schema on Supabase...")
res = requests.post(f"{url}/rest/v1/rpc/exec_sql", json={"sql": sql_script}, headers=headers)
print("RPC Response:", res.status_code, res.text)
