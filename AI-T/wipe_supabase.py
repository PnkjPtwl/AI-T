from rag.embeddings.embedder import EmbedderSingleton
from rag.vector_store.supabase_store import SupabaseVectorStore

embedder = EmbedderSingleton.get_instance()
store = SupabaseVectorStore(embedder=embedder)
store.wipe_all()
print("Supabase vector store wiped successfully.")
