import imaplib
import email
from email.header import decode_header
import logging
from rag.connectors.gmail import config

logger = logging.getLogger("gmail-client")

class GmailClient:
    def __init__(self):
        self.user = config.GMAIL_USER_EMAIL
        self.password = config.GMAIL_APP_PASSWORD

    def is_configured(self) -> bool:
        return bool(self.user and self.password)

    def fetch_phoenix_threads(self, max_results=10):
        if not self.is_configured():
            logger.info("[GmailClient] Credentials not set — falling back to mock loader")
            return None

        threads = []
        try:
            # Connect via IMAP to Gmail
            mail = imaplib.IMAP4_SSL("imap.gmail.com")
            mail.login(self.user, self.password)
            mail.select("inbox")

            # Search query
            search_term = f'TEXT "{config.GMAIL_SEARCH_QUERY}"'
            status, messages = mail.search(None, search_term)

            if status != "OK" or not messages[0]:
                mail.logout()
                return []

            msg_ids = messages[0].split()[-max_results:]
            for msg_id in msg_ids:
                res, msg_data = mail.fetch(msg_id, "(RFC822)")
                for response_part in msg_data:
                    if isinstance(response_part, tuple):
                        msg = email.message_from_bytes(response_part[1])
                        subject, encoding = decode_header(msg.get("Subject", ""))[0]
                        if isinstance(subject, bytes):
                            subject = subject.decode(encoding or "utf-8", errors="ignore")
                        sender = msg.get("From", "")
                        date_str = msg.get("Date", "")

                        # Ignore promotional / newsletter / job alert noise
                        if any(w in sender.lower() or w in subject.lower() for w in ["glassdoor", "noreply", "newsletter", "job alert"]):
                            continue

                        body = ""
                        if msg.is_multipart():
                            for part in msg.walk():
                                content_type = part.get_content_type()
                                if content_type == "text/plain":
                                    try:
                                        body += part.get_payload(decode=True).decode("utf-8", errors="ignore")
                                    except Exception:
                                        pass
                        else:
                            body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")

                        threads.append({
                            "id": msg_id.decode("utf-8"),
                            "subject": subject,
                            "sender": sender,
                            "recipient": self.user,
                            "date": date_str,
                            "body": body.strip()
                        })

            mail.logout()
            return threads
        except Exception as e:
            logger.error(f"[GmailClient] Error fetching emails: {e}")
            return None
