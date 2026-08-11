from langchain_core.documents import Document

class GmailMapper:
    @staticmethod
    def map_email_thread(email_data: dict, company_name: str = "Phoenix Automotive") -> Document:
        subject = email_data.get("subject", "Email Discussion")
        sender = email_data.get("sender", "Unknown Sender")
        date_str = email_data.get("date", "Recent")
        body = email_data.get("body", "")

        markdown_content = (
            f"# Gmail Interaction Log — {company_name}\n\n"
            f"**Subject:** {subject}\n"
            f"**Sender:** {sender}\n"
            f"**Date:** {date_str}\n"
            f"**Account:** {company_name}\n\n"
            f"## Email Thread Transcript\n"
            f"{body}\n\n"
            f"--- Source: Gmail Live Sync ---"
        )

        metadata = {
            "source": "gmail",
            "company": company_name.lower().replace(" ", "_"),
            "document_type": "email_thread",
            "subject": subject,
            "sender": sender,
            "date": date_str
        }

        return Document(page_content=markdown_content, metadata=metadata)
