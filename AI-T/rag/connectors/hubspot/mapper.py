from langchain_core.documents import Document

class HubSpotMapper:
    @staticmethod
    def map_company(company_data: dict, company_name: str) -> Document:
        props = company_data.get("properties", {})
        md = f"""# Company CRM Profile

Company
{props.get('name', company_name)}

Industry
{props.get('industry', 'Unknown')}

Employees
{props.get('numberofemployees', 'Unknown')}

Annual Revenue
{props.get('annualrevenue', 'Unknown')}

Location
{props.get('city', '')}, {props.get('state', '')}, {props.get('country', '')}

Description
{props.get('description', 'No description available')}

Lifecycle Stage
{props.get('lifecyclestage', 'Unknown')}

Website
{props.get('website', 'Unknown')}

Phone
{props.get('phone', 'Unknown')}

CRM Source
HubSpot
"""
        metadata = {
            "source": "hubspot",
            "company": company_name.lower(),
            "document_type": "crm_company",
            "crm_object": "company",
            "object_id": company_data.get("id", "")
        }
        return Document(page_content=md.strip(), metadata=metadata)

    @staticmethod
    def map_contact(contact_data: dict, company_name: str) -> Document:
        props = contact_data.get("properties", {})
        name = f"{props.get('firstname', '')} {props.get('lastname', '')}".strip()
        md = f"""# Customer Stakeholder

Name
{name}

Role
{props.get('jobtitle', 'Unknown')}

Email
{props.get('email', 'Unknown')}

Company
{company_name}

Responsibilities
Primary stakeholder.

CRM Source
HubSpot
"""
        metadata = {
            "source": "hubspot",
            "company": company_name.lower(),
            "document_type": "crm_contact",
            "crm_object": "contact",
            "object_id": contact_data.get("id", "")
        }
        return Document(page_content=md.strip(), metadata=metadata)

    @staticmethod
    def map_deal(deal_data: dict, company_name: str) -> Document:
        props = deal_data.get("properties", {})
        md = f"""# Active Sales Opportunity

Company
{company_name}

Deal
{props.get('dealname', 'Unknown')}

Stage
{props.get('dealstage', 'Unknown')}

Amount
${props.get('amount', '0')}

Expected Close
{props.get('closedate', 'Unknown')}

Summary
{props.get('description', 'No description available')}

CRM Source
HubSpot
"""
        metadata = {
            "source": "hubspot",
            "company": company_name.lower(),
            "document_type": "crm_deal",
            "crm_object": "deal",
            "object_id": deal_data.get("id", "")
        }
        return Document(page_content=md.strip(), metadata=metadata)

    @staticmethod
    def map_note(note_data: dict, company_name: str) -> Document:
        props = note_data.get("properties", {})
        body = props.get("hs_note_body", "No note content")
        timestamp = props.get("hs_timestamp", "")
        md = f"""# CRM Account Note — {company_name}

Timestamp
{timestamp}

Note Content
{body}

CRM Source
HubSpot
"""
        metadata = {
            "source": "hubspot",
            "company": company_name.lower(),
            "document_type": "crm_note",
            "crm_object": "note",
            "object_id": note_data.get("id", "")
        }
        return Document(page_content=md.strip(), metadata=metadata)

    @staticmethod
    def map_call(call_data: dict, company_name: str) -> Document:
        props = call_data.get("properties", {})
        title = props.get("hs_call_title", "Call Log")
        body = props.get("hs_call_body", "No call notes available")
        duration = props.get("hs_call_duration", "")
        md = f"""# CRM Sales Call Log — {company_name}

Call Title
{title}

Duration (seconds)
{duration}

Call Summary & Key Takeaways
{body}

CRM Source
HubSpot
"""
        metadata = {
            "source": "hubspot",
            "company": company_name.lower(),
            "document_type": "crm_call",
            "crm_object": "call",
            "object_id": call_data.get("id", "")
        }
        return Document(page_content=md.strip(), metadata=metadata)

