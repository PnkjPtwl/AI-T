import os
import sys
import time
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env")

GMAIL_USER = os.getenv("GMAIL_USER_EMAIL", "")
GMAIL_PASS = os.getenv("GMAIL_APP_PASSWORD", "")

def send_sample_emails():
    if not GMAIL_USER or not GMAIL_PASS:
        print("[!] GMAIL_USER_EMAIL and GMAIL_APP_PASSWORD are missing in backend/.env!")
        print("Please add your Gmail credentials to backend/.env and run this script again.")
        return False

    print(f"[+] Connecting to Gmail SMTP server as {GMAIL_USER}...")

    sample_emails = [
        {
            "subject": "Phoenix Deal-1 Technical Specifications & ISO Security Audit",
            "body": (
                "Hi Sarah & Relanto Team,\n\n"
                "We completed the technical evaluation for Phoenix Deal-1 ($42,000). "
                "Our engineering lead verified that ISO 26262 compliance and real-time telemetry latency "
                "must stay under 45ms. Please send over the final security audit report so we can finalize contract signing.\n\n"
                "Regards,\nMarcus Vance\nChief Technology Officer, Phoenix"
            )
        },
        {
            "subject": "Phoenix Executive Sponsorship & Q3 Deployment Timeline",
            "body": (
                "Team Relanto,\n\n"
                "Following up on our executive review for Phoenix. "
                "We have approved the Q3 deployment timeline starting September 1st. "
                "Sarah Thompson will be our primary project manager overseeing the Line 4 plant integration.\n\n"
                "Best,\nSarah Thompson\nProject Manager, Phoenix"
            )
        },
        {
            "subject": "Phoenix Deal-2 SLA Support Terms & Enterprise Pricing",
            "body": (
                "Hi Relanto Sales Team,\n\n"
                "Regarding Phoenix Deal-2 ($180,000 enterprise tier), our finance committee requires 24/7 dedicated support SLA "
                "and quarterly executive business reviews. Once updated terms are reflected in the proposal, we are ready to sign.\n\n"
                "Sincerely,\nPhoenix Procurement Committee"
            )
        }
    ]

    try:
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
        server.login(GMAIL_USER, GMAIL_PASS)

        for idx, item in enumerate(sample_emails, 1):
            msg = MIMEMultipart()
            msg["From"] = GMAIL_USER
            msg["To"] = GMAIL_USER
            msg["Subject"] = item["subject"]
            msg.attach(MIMEText(item["body"], "plain"))

            server.send_message(msg)
            print(f"  + [{idx}/3] Sent email: '{item['subject']}'")
            time.sleep(1)

        server.quit()
        print("[+] All 3 sample emails sent successfully via Gmail SMTP!")
        return True

    except Exception as e:
        print(f"[!] Failed to send emails via Gmail SMTP: {e}")
        return False


def fetch_and_ingest_gmail():
    print("\n[+] Connecting to Gmail IMAP to fetch & scrape Phoenix email threads...")
    sys.path.append(os.path.abspath("."))
    
    from rag.connectors.gmail.loader import GmailLoader
    from rag.tracker.sync_agent import get_phoenix_sync_agent

    loader = GmailLoader(target_company="Phoenix")
    docs = loader.load()

    print(f"\n[+] Successfully scraped {len(docs)} email document(s) from Gmail!")
    for idx, doc in enumerate(docs, 1):
        print(f"\n--- Document [{idx}] Metadata ---")
        print(doc.metadata)
        print("Content Preview:")
        print(doc.page_content[:200] + "...\n")

    print("[+] Triggering Phoenix Sync Agent to embed and upload Gmail vectors to Supabase...")
    agent = get_phoenix_sync_agent()
    sync_result = agent.sync_now()
    print("Sync Result:", sync_result)


if __name__ == "__main__":
    if send_sample_emails():
        print("\nWaiting 3 seconds for Gmail inbox indexing...")
        time.sleep(3)
        fetch_and_ingest_gmail()
