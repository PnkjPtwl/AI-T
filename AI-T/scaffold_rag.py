import os

files = {
    "rag/config.py": """
import os
from dotenv import load_dotenv

load_dotenv()

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "salescoach_documents")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 700))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 120))
""",
    
    "rag/loaders/markdown_loader.py": """
import os
from langchain_community.document_loaders import DirectoryLoader, UnstructuredMarkdownLoader
from langchain_core.documents import Document
from typing import List

class MarkdownLoader:
    def __init__(self, directory: str):
        self.directory = directory

    def load(self) -> List[Document]:
        documents = []
        for root, _, files in os.walk(self.directory):
            for file in files:
                if file.endswith('.md'):
                    file_path = os.path.join(root, file)
                    loader = UnstructuredMarkdownLoader(file_path)
                    docs = loader.load()
                    for doc in docs:
                        parts = file_path.split(os.sep)
                        if "customers" in parts:
                            company = parts[parts.index("customers") + 1]
                            doc_type = parts[-1].replace(".md", "")
                        elif "seller" in parts:
                            company = "relanto" # or parts[parts.index("seller") + 1] depending on struct
                            doc_type = parts[-2]
                        else:
                            company = "unknown"
                            doc_type = "unknown"
                            
                        doc.metadata = {
                            "source": file_path,
                            "filename": file,
                            "folder": root,
                            "company": company,
                            "document_type": doc_type
                        }
                        documents.append(doc)
        return documents
""",
    
    "rag/processor/normalizer.py": """
from langchain_core.documents import Document
from typing import List

class DocumentNormalizer:
    '''
    Converts various documents into a unified standard internal Document format before chunking.
    '''
    def normalize(self, documents: List[Document]) -> List[Document]:
        normalized = []
        for doc in documents:
            # Ensure text is clean and metadata is standard
            content = doc.page_content.strip()
            if content:
                normalized.append(Document(
                    page_content=content,
                    metadata=doc.metadata
                ))
        return normalized
""",
    
    "rag/processor/chunker.py": """
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from typing import List
from rag import config

class DocumentChunker:
    def __init__(self):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=config.CHUNK_SIZE,
            chunk_overlap=config.CHUNK_OVERLAP,
            separators=["\n\n", "\n", ".", "!", "?", " ", ""]
        )

    def chunk(self, documents: List[Document]) -> List[Document]:
        return self.splitter.split_documents(documents)
""",
    
    "rag/processor/metadata_builder.py": """
import uuid
from datetime import datetime
from langchain_core.documents import Document
from typing import List

class MetadataBuilder:
    def build(self, chunks: List[Document]) -> List[Document]:
        # Group chunks by source document
        source_groups = {}
        for chunk in chunks:
            src = chunk.metadata.get("source", "unknown")
            if src not in source_groups:
                source_groups[src] = []
            source_groups[src].append(chunk)
            
        enriched_chunks = []
        for src, doc_chunks in source_groups.items():
            total = len(doc_chunks)
            for i, chunk in enumerate(doc_chunks):
                chunk.metadata.update({
                    "chunk_id": str(uuid.uuid4()),
                    "document_name": chunk.metadata.get("filename", "unknown"),
                    "chunk_number": i + 1,
                    "total_chunks": total,
                    "created_at": datetime.utcnow().isoformat()
                })
                enriched_chunks.append(chunk)
        return enriched_chunks
""",
    
    "rag/embeddings/embedder.py": """
from langchain_huggingface import HuggingFaceEmbeddings
from rag import config

class EmbedderSingleton:
    _instance = None

    @classmethod
    def get_instance(cls) -> HuggingFaceEmbeddings:
        if cls._instance is None:
            cls._instance = HuggingFaceEmbeddings(model_name=config.EMBEDDING_MODEL)
        return cls._instance
""",
    
    "rag/vector_store/qdrant_client.py": """
from qdrant_client import QdrantClient
from rag import config

class QdrantStore:
    _client = None

    @classmethod
    def get_client(cls) -> QdrantClient:
        if cls._client is None:
            cls._client = QdrantClient(host=config.QDRANT_HOST, port=config.QDRANT_PORT)
        return cls._client
""",
    
    "rag/vector_store/collections.py": """
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
""",
    
    "rag/ingestion/pipeline.py": """
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from langchain_qdrant import QdrantVectorStore
from rag.loaders.markdown_loader import MarkdownLoader
from rag.processor.normalizer import DocumentNormalizer
from rag.processor.chunker import DocumentChunker
from rag.processor.metadata_builder import MetadataBuilder
from rag.embeddings.embedder import EmbedderSingleton
from rag.vector_store.qdrant_client import QdrantStore
from rag.vector_store.collections import ensure_collection
from rag import config

class IngestionPipeline:
    def __init__(self, docs_dir: str):
        self.docs_dir = docs_dir
        self.loader = MarkdownLoader(docs_dir)
        self.normalizer = DocumentNormalizer()
        self.chunker = DocumentChunker()
        self.metadata_builder = MetadataBuilder()
        self.embedder = EmbedderSingleton.get_instance()
        
    def run(self):
        print("Loading files...")
        docs = self.loader.load()
        print(f"{len(docs)} documents loaded")
        
        print("Normalizing...")
        normalized = self.normalizer.normalize(docs)
        
        print("Chunking...")
        chunks = self.chunker.chunk(normalized)
        print(f"{len(chunks)} chunks created")
        
        print("Building Metadata...")
        enriched_chunks = self.metadata_builder.build(chunks)
        
        if not enriched_chunks:
            print("No chunks to process. Exiting.")
            return

        print("Connecting to Qdrant...")
        # Get vector size from a dummy embedding
        dummy_vector = self.embedder.embed_query("test")
        ensure_collection(vector_size=len(dummy_vector))
        
        print("Embedding and Uploading...")
        client = QdrantStore.get_client()
        QdrantVectorStore.from_documents(
            documents=enriched_chunks,
            embedding=self.embedder,
            url=f"http://{config.QDRANT_HOST}:{config.QDRANT_PORT}",
            collection_name=config.COLLECTION_NAME
        )
        print("Upload Complete")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--docs-dir", type=str, required=True, help="Directory containing markdown docs")
    args = parser.parse_args()
    
    pipeline = IngestionPipeline(args.docs_dir)
    pipeline.run()
""",
    
    "rag/retrieval/retriever.py": """
from langchain_qdrant import QdrantVectorStore
from rag.embeddings.embedder import EmbedderSingleton
from rag.vector_store.qdrant_client import QdrantStore
from rag import config

class KnowledgeRetriever:
    def __init__(self):
        client = QdrantStore.get_client()
        embedder = EmbedderSingleton.get_instance()
        self.vector_store = QdrantVectorStore(
            client=client,
            collection_name=config.COLLECTION_NAME,
            embedding=embedder
        )

    def search(self, query: str, k: int = 5):
        results = self.vector_store.similarity_search_with_score(query, k=k)
        return results
""",

    "rag/tests/test_retrieval.py": """
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from rag.retrieval.retriever import KnowledgeRetriever

def run_tests():
    retriever = KnowledgeRetriever()
    
    queries = [
        "What products does Relanto offer?",
        "Who is Phoenix?",
        "What compliance requirements does Phoenix have?",
        "Who are Phoenix's competitors?",
        "What pricing model does Relanto use?"
    ]
    
    print("Testing Retrieval...")
    success = 0
    for q in queries:
        print(f"\nQuery: {q}")
        try:
            results = retriever.search(q, k=2)
            if results:
                success += 1
                for doc, score in results:
                    print(f"Similarity: {score:.4f}")
                    print(f"Metadata: {doc.metadata}")
                    print(f"Content snippet: {doc.page_content[:100]}...")
            else:
                print("No results found.")
        except Exception as e:
            print(f"Error querying: {e}")
            
    print(f"\n{success}/{len(queries)} Queries Successful")

if __name__ == "__main__":
    run_tests()
""",
    
    "rag/__init__.py": ""
}

for path, content in files.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

print("RAG scaffolded successfully!")
