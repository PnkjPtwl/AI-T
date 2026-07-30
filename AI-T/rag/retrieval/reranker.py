from sentence_transformers import CrossEncoder

class RerankerSingleton:
    _instance = None
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            # A small, fast, highly accurate cross-encoder model
            cls._instance = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        return cls._instance
