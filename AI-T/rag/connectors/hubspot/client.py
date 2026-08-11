import requests
import time
from rag.connectors.hubspot import config

import os

class HubSpotClient:
    def __init__(self):
        self.base_url = config.HUBSPOT_API_BASE

    def get_headers(self):
        token = os.getenv("HUBSPOT_ACCESS_TOKEN") or config.HUBSPOT_ACCESS_TOKEN
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    def request(self, method, endpoint, params=None, json=None, retries=3):
        url = f"{self.base_url}{endpoint}"
        headers = self.get_headers()
        for attempt in range(retries):
            try:
                response = requests.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json,
                    timeout=10
                )
                
                if response.status_code == 401:
                    print(f"HubSpot Error 401: Unauthorized. Check token.")
                    return None
                elif response.status_code == 403:
                    print(f"HubSpot Error 403: Forbidden.")
                    return None
                elif response.status_code == 429:
                    print(f"HubSpot Error 429: Rate limited. Retrying in {2 ** attempt} seconds...")
                    time.sleep(2 ** attempt)
                    continue
                    
                response.raise_for_status()
                return response.json()
            except requests.exceptions.RequestException as e:
                print(f"Request failed: {e}")
                time.sleep(2 ** attempt)
        return None
