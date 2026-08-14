from qdrant_client import QdrantClient
from rag import config

class QdrantStore:
    _client = None

    @classmethod
    def get_client(cls) -> QdrantClient:
        if cls._client is None:
            cls._client = QdrantClient(host=config.QDRANT_HOST, port=config.QDRANT_PORT, timeout=60.0)
        return cls._client
