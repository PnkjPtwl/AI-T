import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from rag.tracker.sync_agent import PhoenixSyncAgent

def test_sync():
    print("Testing PhoenixSyncAgent live sync...")
    agent = PhoenixSyncAgent("Phoenix Automotive")
    
    status = agent.get_status()
    print("Initial Status:", status)
    
    print("\nExecuting sync_now()...")
    sync_result = agent.sync_now()
    print("Sync Result:", sync_result)

if __name__ == "__main__":
    test_sync()
