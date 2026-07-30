import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from rag.connectors.hubspot.loader import HubSpotLoader

def test():
    loader = HubSpotLoader(target_company="Phoenix")
    docs = loader.load()
    
    print("\n--- GENERATED DOCUMENTS ---\n")
    for d in docs:
        print(f"METADATA: {d.metadata}")
        print(f"CONTENT:\n{d.page_content}\n")
        print("-" * 40)

if __name__ == "__main__":
    test()
