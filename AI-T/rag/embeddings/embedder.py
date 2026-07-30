from langchain_huggingface import HuggingFaceEmbeddings
from rag import config

class EmbedderSingleton:
    _instance = None

    @classmethod
    def get_instance(cls) -> HuggingFaceEmbeddings:
        if cls._instance is None:
            cls._instance = HuggingFaceEmbeddings(model_name=config.EMBEDDING_MODEL)
        return cls._instance
