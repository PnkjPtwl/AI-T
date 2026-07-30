from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from typing import List
from rag import config

class DocumentChunker:
    def __init__(self):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=config.CHUNK_SIZE,
            chunk_overlap=config.CHUNK_OVERLAP,
            separators=["\\n\\n", "\\n", ".", "!", "?", " ", ""]
        )

    def chunk(self, documents: List[Document]) -> List[Document]:
        return self.splitter.split_documents(documents)
