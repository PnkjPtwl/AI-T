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
