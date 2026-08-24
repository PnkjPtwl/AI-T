from rag.connectors.hubspot.client import HubSpotClient

class HubSpotService:
    def __init__(self):
        self.client = HubSpotClient()

    def list_companies(self):
        endpoint = "/crm/v3/objects/companies"
        res = self.client.request("GET", endpoint, params={"properties": "name", "limit": 100})
        companies = []
        if res and res.get("results"):
            for comp in res["results"]:
                name = comp.get("properties", {}).get("name", "Unknown Company")
                companies.append({"id": comp["id"], "name": name})
        return companies

    def find_company(self, name: str):
        endpoint = "/crm/v3/objects/companies/search"
        payload = {
            "filterGroups": [{
                "filters": [{
                    "propertyName": "name",
                    "operator": "CONTAINS_TOKEN",
                    "value": name.split()[0] if name else name
                }]
            }],
            "properties": ["name", "industry", "description", "city", "state", "country", "website", "phone", "numberofemployees", "annualrevenue", "lifecyclestage"]
        }
        res = self.client.request("POST", endpoint, json=payload)
        if res and res.get("results"):
            return res["results"][0]
        return None

    def get_associated_contacts(self, company_id: str):
        # First get association IDs
        endpoint = f"/crm/v4/objects/companies/{company_id}/associations/contacts"
        res = self.client.request("GET", endpoint)
        contacts = []
        if res and res.get("results"):
            for assoc in res["results"]:
                contact_id = assoc["toObjectId"]
                contact_res = self.client.request("GET", f"/crm/v3/objects/contacts/{contact_id}", params={"properties": "firstname,lastname,email,jobtitle,phone,hubspot_owner_id,lifecyclestage,notes_last_updated"})
                if contact_res:
                    contacts.append(contact_res)
        return contacts

    def get_associated_deals(self, company_id: str):
        endpoint = f"/crm/v4/objects/companies/{company_id}/associations/deals"
        res = self.client.request("GET", endpoint)
        deals = []
        if res and res.get("results"):
            for assoc in res["results"]:
                deal_id = assoc["toObjectId"]
                deal_res = self.client.request("GET", f"/crm/v3/objects/deals/{deal_id}", params={"properties": "dealname,dealstage,amount,pipeline,closedate,createdate,hubspot_owner_id,description"})
                if deal_res:
                    deals.append(deal_res)
        return deals

    def get_associated_notes(self, company_id: str):
        endpoint = f"/crm/v4/objects/companies/{company_id}/associations/notes"
        res = self.client.request("GET", endpoint)
        notes = []
        if res and res.get("results"):
            for assoc in res["results"]:
                note_id = assoc["toObjectId"]
                note_res = self.client.request("GET", f"/crm/v3/objects/notes/{note_id}", params={"properties": "hs_note_body,hs_timestamp,hubspot_owner_id"})
                if note_res:
                    notes.append(note_res)
        return notes

    def get_associated_calls(self, company_id: str):
        endpoint = f"/crm/v4/objects/companies/{company_id}/associations/calls"
        res = self.client.request("GET", endpoint)
        calls = []
        if res and res.get("results"):
            for assoc in res["results"]:
                call_id = assoc["toObjectId"]
                call_res = self.client.request("GET", f"/crm/v3/objects/calls/{call_id}", params={"properties": "hs_call_title,hs_call_body,hs_call_duration,hs_timestamp"})
                if call_res:
                    calls.append(call_res)
        return calls

