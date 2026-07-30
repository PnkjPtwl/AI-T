from rag.vector_store.qdrant_client import QdrantStore
from rag import config

client = QdrantStore.get_client()
if client.collection_exists(config.COLLECTION_NAME):
    client.delete_collection(config.COLLECTION_NAME)
    print(f"Collection {config.COLLECTION_NAME} wiped successfully.")
else:
    print("Collection did not exist.")
