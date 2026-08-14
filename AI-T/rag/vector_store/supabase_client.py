from supabase import create_client, Client
from rag import config

class SupabaseStoreClient:
    _client: Client = None

    @classmethod
    def get_client(cls) -> Client:
        if cls._client is None:
            if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
                raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in .env")
            cls._client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
        return cls._client
