import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path="backend/.env")

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

client = create_client(url, key)

def purge_all_glassdoor():
    print("Purging ALL Glassdoor noise from document_embeddings...")
    
    # Loop until no glassdoor rows remain
    while True:
        res = client.table("document_embeddings").select("id, metadata, content").limit(1000).execute()
        rows = res.data or []
        if not rows:
            break

        to_delete = []
        for r in rows:
            meta = r.get("metadata", {})
            content = str(r.get("content", "")).lower()
            sender = str(meta.get("sender", "")).lower()
            subject = str(meta.get("subject", "")).lower()

            if "glassdoor" in sender or "glassdoor" in subject or "glassdoor" in content or "job" in subject:
                to_delete.append(r["id"])

        if not to_delete:
            print("No more Glassdoor rows found in this batch!")
            break

        print(f"Deleting batch of {len(to_delete)} Glassdoor noise rows...")
        for i in range(0, len(to_delete), 100):
            chunk_ids = to_delete[i:i + 100]
            client.table("document_embeddings").delete().in_("id", chunk_ids).execute()

    print("Complete purge finished!")

if __name__ == "__main__":
    purge_all_glassdoor()
