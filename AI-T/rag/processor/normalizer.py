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
