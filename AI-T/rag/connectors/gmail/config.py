import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../../backend/.env"))
load_dotenv()

GMAIL_USER_EMAIL = os.getenv("GMAIL_USER_EMAIL", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
GMAIL_CLIENT_ID = os.getenv("GMAIL_CLIENT_ID", "")
GMAIL_CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET", "")
GMAIL_REFRESH_TOKEN = os.getenv("GMAIL_REFRESH_TOKEN", "")

# Search query for Phoenix / Phoenix Automotive email threads
GMAIL_SEARCH_QUERY = os.getenv("GMAIL_SEARCH_QUERY", "Phoenix")
