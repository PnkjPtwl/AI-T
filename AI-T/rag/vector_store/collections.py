from qdrant_client.models import Distance, VectorParams
from rag.vector_store.qdrant_client import QdrantStore
from rag import config

def ensure_collection(vector_size: int = 384):
    client = QdrantStore.get_client()
    collections = client.get_collections().collections
    if not any(c.name == config.COLLECTION_NAME for c in collections):
        client.create_collection(
            collection_name=config.COLLECTION_NAME,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE)
        )
