import os
import sys
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env")

from supabase import create_client

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

client = create_client(url, key)

def check_sap():
    print("Checking Supabase vector database for 'SAP', 'S/4HANA', 'MES'...")
    res = client.table("document_embeddings").select("*").execute()
    rows = res.data or []
    print(f"Total chunks in document_embeddings: {len(rows)}")

    sap_chunks = []
    phoenix_chunks = []

    for r in rows:
        content = r.get("content", "")
        meta = r.get("metadata", {})
        if "phoenix" in str(meta).lower() or "phoenix" in content.lower():
            phoenix_chunks.append(r)
        if "sap" in content.lower() or "s/4hana" in content.lower() or "mes" in content.lower():
            sap_chunks.append(r)

    print(f"Chunks matching 'phoenix': {len(phoenix_chunks)}")
    print(f"Chunks matching 'SAP' / 'S/4HANA' / 'MES': {len(sap_chunks)}")

    if sap_chunks:
        print("\n--- MATCHING SAP / MES CHUNKS FOUND IN KB ---")
        for idx, c in enumerate(sap_chunks, 1):
            print(f"[{idx}] Source/Metadata: {c.get('metadata')}")
            print(f"Content:\n{c.get('content')[:300]}...\n")
    else:
        print("\n❌ NO chunks containing 'SAP', 'S/4HANA', or 'MES' found in Supabase vector store.")
        print("Displaying sample contents of stored Phoenix KB chunks:")
        for idx, c in enumerate(phoenix_chunks[:5], 1):
            print(f"[{idx}] Metadata: {c.get('metadata')}")
            print(f"Content:\n{c.get('content')[:250]}...\n")

if __name__ == "__main__":
    check_sap()
