import requests
import json
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env")

TOKEN = os.getenv("HUBSPOT_ACCESS_TOKEN")
BASE_URL = "https://api.hubapi.com"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

def test_hubspot():
    print(f"Connecting to HubSpot with Private App Token: {TOKEN[:15]}...")

    # 1. Search for Company "Phoenix"
    search_url = f"{BASE_URL}/crm/v3/objects/companies/search"
    search_payload = {
        "filterGroups": [{
            "filters": [{
                "propertyName": "name",
                "operator": "CONTAINS_TOKEN",
                "value": "Phoenix"
            }]
        }],
        "properties": ["name", "domain", "city", "state", "industry", "description", "lifecyclestage", "hubspot_owner_id", "phone", "annualrevenue", "numberofemployees"]
    }

    resp = requests.post(search_url, headers=HEADERS, json=search_payload)
    print(f"Search Status: {resp.status_code}")
    if resp.status_code != 200:
        print("Search failed:", resp.text)
        return

    data = resp.json()
    results = data.get("results", [])
    print(f"Found {len(results)} matching company(ies) in your HubSpot Account.")

    for company in results:
        comp_id = company["id"]
        props = company.get("properties", {})
        print("\n=======================================================")
        print(f"COMPANY: {props.get('name')} (ID: {comp_id})")
        print(f"Domain: {props.get('domain')}")
        print(f"City: {props.get('city')}, State: {props.get('state')}")
        print(f"Industry: {props.get('industry')}")
        print(f"Description: {props.get('description')}")
        print(f"Employees: {props.get('numberofemployees')}")
        print(f"Revenue: {props.get('annualrevenue')}")
        print("=======================================================")

        # 2. Fetch Associated Contacts
        assoc_contacts_url = f"{BASE_URL}/crm/v4/objects/companies/{comp_id}/associations/contacts"
        c_assoc_resp = requests.get(assoc_contacts_url, headers=HEADERS)
        if c_assoc_resp.status_code == 200:
            c_assoc_data = c_assoc_resp.json().get("results", [])
            print(f"\nASSOCIATED CONTACTS ({len(c_assoc_data)}):")
            for c_assoc in c_assoc_data:
                c_id = c_assoc["toObjectId"]
                c_detail = requests.get(f"{BASE_URL}/crm/v3/objects/contacts/{c_id}", headers=HEADERS, params={"properties": "firstname,lastname,email,jobtitle,phone,lifecyclestage"}).json()
                c_props = c_detail.get("properties", {})
                print(f"  * {c_props.get('firstname')} {c_props.get('lastname')} | Job Title: {c_props.get('jobtitle')} | Email: {c_props.get('email')} | Phone: {c_props.get('phone')}")

        # 3. Fetch Associated Deals
        assoc_deals_url = f"{BASE_URL}/crm/v4/objects/companies/{comp_id}/associations/deals"
        d_assoc_resp = requests.get(assoc_deals_url, headers=HEADERS)
        if d_assoc_resp.status_code == 200:
            d_assoc_data = d_assoc_resp.json().get("results", [])
            print(f"\nASSOCIATED DEALS ({len(d_assoc_data)}):")
            for d_assoc in d_assoc_data:
                d_id = d_assoc["toObjectId"]
                d_detail = requests.get(f"{BASE_URL}/crm/v3/objects/deals/{d_id}", headers=HEADERS, params={"properties": "dealname,dealstage,amount,closedate,description,pipeline"}).json()
                d_props = d_detail.get("properties", {})
                print(f"  * Deal Name: {d_props.get('dealname')} | Amount: ${d_props.get('amount')} | Stage: {d_props.get('dealstage')} | Close Date: {d_props.get('closedate')}")

        # 4. Fetch Associated Notes / Engagements
        assoc_notes_url = f"{BASE_URL}/crm/v4/objects/companies/{comp_id}/associations/notes"
        n_assoc_resp = requests.get(assoc_notes_url, headers=HEADERS)
        if n_assoc_resp.status_code == 200:
            n_assoc_data = n_assoc_resp.json().get("results", [])
            print(f"\nASSOCIATED NOTES ({len(n_assoc_data)}):")
            for n_assoc in n_assoc_data:
                n_id = n_assoc["toObjectId"]
                n_detail = requests.get(f"{BASE_URL}/crm/v3/objects/notes/{n_id}", headers=HEADERS, params={"properties": "hs_note_body,hs_timestamp"}).json()
                n_props = n_detail.get("properties", {})
                print(f"  * Note: {n_props.get('hs_note_body')} ({n_props.get('hs_timestamp')})")

if __name__ == "__main__":
    test_hubspot()
