from typing import List
from langchain_core.documents import Document
from rag.connectors.gmail.client import GmailClient
from rag.connectors.gmail.mapper import GmailMapper

class GmailLoader:
    def __init__(self, target_company="Phoenix Automotive"):
        self.target_company = target_company
        self.client = GmailClient()

    def load(self) -> List[Document]:
        print(f"Connecting to Gmail for {self.target_company}...")
        threads = self.client.fetch_phoenix_threads()

        if threads is None or len(threads) == 0:
            print("Using Mock Gmail Email Threads (Credentials missing or 0 threads found)...")
            return self._mock_load()

        documents = []
        for thread in threads:
            doc = GmailMapper.map_email_thread(thread, self.target_company)
            documents.append(doc)

        print(f"Generated {len(documents)} Gmail Document(s) for {self.target_company}")
        return documents

    def _mock_load(self) -> List[Document]:
        email1 = {
            "subject": "Phoenix Automotive — Brake System Line Modernization & Relanto AI",
            "sender": "sarah.t@phoenix-automotive.com",
            "date": "Mon, 03 Aug 2026 14:22:10 +0000",
            "body": (
                "Hi Relanto Team,\n\n"
                "Following up on our discovery workshop regarding the Phoenix Automotive Brake Assembly Line 4 expansion. "
                "We reviewed the AI-driven quality inspection and predictive maintenance proposal ($420k scope). "
                "Our CFO Marcus Vance raised concerns regarding the 12-month ROI timeline vs 18-month payback. "
                "Can you provide detailed case studies demonstrating <14 month ROI for tier-1 automotive brake suppliers?\n\n"
                "Best regards,\nSarah Thompson\nVP Operations, Phoenix Automotive"
            )
        }

        email2 = {
            "subject": "RE: Phoenix Automotive — Technical Integration Requirements",
            "sender": "marcus.vance@phoenix-automotive.com",
            "date": "Wed, 05 Aug 2026 09:15:00 +0000",
            "body": (
                "Team Relanto,\n\n"
                "We need confirmation on ISO 26262 compliance and real-time latency (<50ms) for sensor telemetry ingestion "
                "on line 4. We cannot approve the software contract until technical sign-off is complete.\n\n"
                "Regards,\nMarcus Vance\nChief Technology Officer, Phoenix Automotive"
            )
        }

        doc1 = GmailMapper.map_email_thread(email1, self.target_company)
        doc2 = GmailMapper.map_email_thread(email2, self.target_company)

        return [doc1, doc2]
