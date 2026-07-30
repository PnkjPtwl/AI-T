"""
Populate Phoenix's HubSpot account — Relanto AI Trainer setup
================================================================

WHAT THIS SCRIPT DOES
1. Creates the missing custom properties on Company, Contact, and Deal
   objects (only if they don't already exist — safe to re-run).
2. Fills in those properties for your Phoenix Company, 2 Contacts, and
   2 Deals with realistic values consistent with the Relanto seed data
   (plants, product lines, "Competitor A").
3. Logs sample Activities (Notes, Calls, Emails) against the deals so
   the persona has interaction history to draw from.

BEFORE YOU RUN THIS
- pip install requests
- Fill in ACCESS_TOKEN and the 5 record IDs in the CONFIG section below.
- Run: python populate_phoenix_hubspot.py
- The script prints what it's doing at every step. If something is
  already set up (e.g. a property exists), it skips it and moves on.
"""

import requests
import time

# =========================================================================
# CONFIG — fill these in before running
# =========================================================================

ACCESS_TOKEN = "PASTE_YOUR_PRIVATE_APP_TOKEN_HERE"

COMPANY_ID = "PASTE_PHOENIX_COMPANY_ID"
CONTACT_ID_1 = "PASTE_CONTACT_1_ID"     # e.g. the Decision Maker
CONTACT_ID_2 = "PASTE_CONTACT_2_ID"     # e.g. the Technical Evaluator
DEAL_ID_1 = "PASTE_DEAL_1_ID"           # Phoenix - Deal-1 ($42,000)
DEAL_ID_2 = "PASTE_DEAL_2_ID"           # Phoenix - Deal-2 ($180,000)

BASE_URL = "https://api.hubapi.com"
HEADERS = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Content-Type": "application/json",
}

# =========================================================================
# HELPERS
# =========================================================================

def property_exists(object_type, name):
    r = requests.get(f"{BASE_URL}/crm/v3/properties/{object_type}/{name}", headers=HEADERS)
    return r.status_code == 200

def create_property(object_type, definition):
    name = definition["name"]
    if property_exists(object_type, name):
        print(f"  - property '{name}' already exists on {object_type}, skipping")
        return
    r = requests.post(f"{BASE_URL}/crm/v3/properties/{object_type}", headers=HEADERS, json=definition)
    if r.status_code in (200, 201):
        print(f"  + created property '{name}' on {object_type}")
    else:
        print(f"  ! failed to create '{name}' on {object_type}: {r.status_code} {r.text}")

def enum_options(values):
    return [{"label": v, "value": v.lower().replace(" ", "_")} for v in values]

def update_object(object_type, object_id, properties):
    r = requests.patch(
        f"{BASE_URL}/crm/v3/objects/{object_type}/{object_id}",
        headers=HEADERS,
        json={"properties": properties},
    )
    if r.status_code == 200:
        print(f"  + updated {object_type} {object_id}")
    else:
        print(f"  ! failed to update {object_type} {object_id}: {r.status_code} {r.text}")

def get_default_association_type(from_object_type, to_object_type):
    """Fetch the default HubSpot association type ID between two object types."""
    r = requests.get(
        f"{BASE_URL}/crm/v4/associations/{from_object_type}/{to_object_type}/labels",
        headers=HEADERS,
    )
    if r.status_code != 200:
        print(f"  ! could not fetch association labels {from_object_type}->{to_object_type}: {r.text}")
        return None
    results = r.json().get("results", [])
    for res in results:
        if res.get("category") == "HUBSPOT_DEFINED":
            return res["typeId"]
    return results[0]["typeId"] if results else None

def create_engagement(engagement_type, properties, associate_with):
    """
    engagement_type: 'notes' | 'calls' | 'emails'
    associate_with: list of (object_type, object_id) tuples, e.g. [("deals", DEAL_ID_1)]
    """
    associations = []
    for obj_type, obj_id in associate_with:
        type_id = get_default_association_type(engagement_type, obj_type)
        if type_id is None:
            continue
        associations.append({
            "to": {"id": obj_id},
            "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": type_id}],
        })
    payload = {"properties": properties, "associations": associations}
    r = requests.post(f"{BASE_URL}/crm/v3/objects/{engagement_type}", headers=HEADERS, json=payload)
    if r.status_code in (200, 201):
        print(f"  + logged {engagement_type[:-1]}: {properties.get('hs_note_body') or properties.get('hs_call_title') or properties.get('hs_email_subject')}")
    else:
        print(f"  ! failed to log {engagement_type}: {r.status_code} {r.text}")

def ts_days_ago(days):
    """HubSpot engagement timestamps are epoch milliseconds."""
    return int((time.time() - days * 86400) * 1000)

# =========================================================================
# STEP 1 — CREATE MISSING CUSTOM PROPERTIES
# =========================================================================

def create_all_properties():
    print("\n== Creating custom properties (skips ones that already exist) ==")

    # --- Company properties ---
    create_property("companies", {
        "name": "oem_industry_segment",
        "label": "OEM Industry Segment",
        "type": "enumeration",
        "fieldType": "select",
        "groupName": "companyinformation",
        "options": enum_options(["Passenger Vehicle", "Commercial Vehicle", "Two-Wheeler", "Off-Highway", "Aftermarket"]),
    })
    create_property("companies", {
        "name": "plants_count",
        "label": "Number of Plants",
        "type": "number",
        "fieldType": "number",
        "groupName": "companyinformation",
    })
    # NOTE: "country" and "annualrevenue" already exist as default HubSpot
    # Company properties — no need to create them, just fill values in Step 2.

    # --- Contact properties ---
    create_property("contacts", {
        "name": "role_type",
        "label": "Role Type",
        "type": "enumeration",
        "fieldType": "select",
        "groupName": "contactinformation",
        "options": enum_options(["Decision Maker", "Influencer", "Technical Evaluator", "Champion"]),
    })
    create_property("contacts", {
        "name": "background",
        "label": "Background",
        "type": "string",
        "fieldType": "text",
        "groupName": "contactinformation",
    })
    create_property("contacts", {
        "name": "buyer_type",
        "label": "Buyer Type",
        "type": "enumeration",
        "fieldType": "select",
        "groupName": "contactinformation",
        "options": enum_options(["OEM Buyer", "Aftermarket Buyer", "Distributor"]),
    })
    # NOTE: "jobtitle" already exists as a default Contact property — use it for Title.

    # --- Deal properties ---
    create_property("deals", {
        "name": "product_line",
        "label": "Product Line",
        "type": "enumeration",
        "fieldType": "checkbox",  # multi-select
        "groupName": "dealinformation",
        "options": enum_options(["Brake Pads", "Disc Brakes", "Suspension Systems", "Steering Components",
                                 "Axles", "Bearings", "Clutch Systems", "Wiring Harness"]),
    })
    create_property("deals", {
        "name": "competitor_name",
        "label": "Competitor",
        "type": "enumeration",
        "fieldType": "select",
        "groupName": "dealinformation",
        "options": enum_options(["Competitor A", "Competitor B", "None Identified"]),
    })
    create_property("deals", {
        "name": "supplier_tier",
        "label": "Tier",
        "type": "enumeration",
        "fieldType": "select",
        "groupName": "dealinformation",
        "options": enum_options(["Tier 1", "Tier 2", "Tier 3"]),
    })
    create_property("deals", {
        "name": "vehicle_platform",
        "label": "Platform",
        "type": "string",
        "fieldType": "text",
        "groupName": "dealinformation",
    })
    create_property("deals", {
        "name": "vehicle_program",
        "label": "Vehicle Program",
        "type": "string",
        "fieldType": "text",
        "groupName": "dealinformation",
    })
    create_property("deals", {
        "name": "annual_volume",
        "label": "Annual Volume",
        "type": "number",
        "fieldType": "number",
        "groupName": "dealinformation",
    })
    create_property("deals", {
        "name": "rfq_number",
        "label": "RFQ Number",
        "type": "string",
        "fieldType": "text",
        "groupName": "dealinformation",
    })
    create_property("deals", {
        "name": "ppap_status",
        "label": "PPAP Status",
        "type": "enumeration",
        "fieldType": "select",
        "groupName": "dealinformation",
        "options": enum_options(["Not Started", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5", "Approved"]),
    })
    create_property("deals", {
        "name": "sop_date",
        "label": "SOP Date",
        "type": "date",
        "fieldType": "date",
        "groupName": "dealinformation",
    })
    create_property("deals", {
        "name": "prototype_status",
        "label": "Prototype Status",
        "type": "enumeration",
        "fieldType": "select",
        "groupName": "dealinformation",
        "options": enum_options(["Not Started", "In Progress", "Complete"]),
    })
    create_property("deals", {
        "name": "tooling_status",
        "label": "Tooling Status",
        "type": "enumeration",
        "fieldType": "select",
        "groupName": "dealinformation",
        "options": enum_options(["Not Started", "In Progress", "Complete"]),
    })
    create_property("deals", {
        "name": "commodity",
        "label": "Commodity",
        "type": "enumeration",
        "fieldType": "select",
        "groupName": "dealinformation",
        "options": enum_options(["Brake Pads", "Disc Brakes", "Suspension Systems", "Steering Components",
                                 "Axles", "Bearings", "Clutch Systems", "Wiring Harness"]),
    })
    create_property("deals", {
        "name": "quoting_plant",
        "label": "Plant",
        "type": "enumeration",
        "fieldType": "select",
        "groupName": "dealinformation",
        "options": enum_options(["Relanto Chennai Forge Plant", "Relanto Pune Precision Plant", "Relanto Rayong Assembly Plant"]),
    })
    create_property("deals", {
        "name": "region",
        "label": "Region",
        "type": "enumeration",
        "fieldType": "select",
        "groupName": "dealinformation",
        "options": enum_options(["APAC", "EMEA", "Americas"]),
    })
    create_property("deals", {
        "name": "customer_wants",
        "label": "Customer Wants",
        "type": "enumeration",
        "fieldType": "checkbox",  # multi-select
        "groupName": "dealinformation",
        "options": enum_options(["Lower NVH", "Higher Durability", "Reduced Warranty Claims",
                                  "Faster Lead Time", "Lower Landed Cost", "Local Supply Support"]),
    })

# =========================================================================
# STEP 2 — FILL IN VALUES
# =========================================================================

def populate_company():
    print("\n== Updating Phoenix Company ==")
    update_object("companies", COMPANY_ID, {
        "oem_industry_segment": "passenger_vehicle",
        "country": "United States",
        "plants_count": "3",
        "annualrevenue": "850000000",
        # NOTE: leave the default "industry" field as-is or update separately
        # in the UI — it's a generic HubSpot field, not the automotive one.
    })

def populate_contacts():
    print("\n== Updating Phoenix Contacts ==")
    update_object("contacts", CONTACT_ID_1, {
        "jobtitle": "Procurement Head",
        "role_type": "decision_maker",
        "background": "12 years in automotive procurement, previously at a Tier-1 supplier",
        "buyer_type": "oem_buyer",
    })
    update_object("contacts", CONTACT_ID_2, {
        "jobtitle": "Senior Design Engineer",
        "role_type": "technical_evaluator",
        "background": "Mechanical engineering background, owns technical sign-off on supplier PPAP submissions",
        "buyer_type": "oem_buyer",
    })

def populate_deals():
    print("\n== Updating Phoenix Deals ==")
    # Deal-1: smaller, earlier-stage deal
    update_object("deals", DEAL_ID_1, {
        "product_line": "brake_pads",
        "competitor_name": "competitor_a",
        "supplier_tier": "tier_1",
        "vehicle_platform": "PX-200",
        "vehicle_program": "Astra Sedan Refresh",
        "annual_volume": "420000",
        "rfq_number": "RFQ-PHX-2026-014",
        "ppap_status": "level_2",
        "sop_date": "2027-02-01",
        "prototype_status": "in_progress",
        "tooling_status": "not_started",
        "commodity": "brake_pads",
        "quoting_plant": "relanto_pune_precision_plant",
        "region": "americas",
        "customer_wants": "reduced_warranty_claims;lower_landed_cost",
    })
    # Deal-2: larger, later-stage deal
    update_object("deals", DEAL_ID_2, {
        "product_line": "suspension_systems",
        "competitor_name": "competitor_a",
        "supplier_tier": "tier_1",
        "vehicle_platform": "CX-450",
        "vehicle_program": "Kestrel Commercial Van Program",
        "annual_volume": "1250000",
        "rfq_number": "RFQ-PHX-2026-021",
        "ppap_status": "level_3",
        "sop_date": "2026-11-15",
        "prototype_status": "complete",
        "tooling_status": "in_progress",
        "commodity": "suspension_systems",
        "quoting_plant": "relanto_chennai_forge_plant",
        "region": "americas",
        "customer_wants": "higher_durability;faster_lead_time",
    })

# =========================================================================
# STEP 3 — LOG ACTIVITIES (calls, emails, notes)
# =========================================================================

def populate_activities():
    print("\n== Logging Activities ==")

    # --- Deal-1 activity history ---
    create_engagement("calls", {
        "hs_call_title": "Discovery Call — Brake Pad RFQ",
        "hs_call_body": "Phoenix procurement flagged rising warranty claims on their current brake pad supplier "
                         "and wants a quote for the Astra Sedan Refresh program. Asked about IATF 16949 status "
                         "and lead time on tooling. Mentioned they're also evaluating Competitor A.",
        "hs_call_direction": "OUTBOUND",
        "hs_call_disposition": "af1e5346-ba97-4d55-a6e9-9e5b2e5f4bef",  # HubSpot's default "Connected" disposition
        "hs_timestamp": ts_days_ago(35),
    }, associate_with=[("deals", DEAL_ID_1), ("contacts", CONTACT_ID_1)])

    create_engagement("emails", {
        "hs_email_subject": "RFQ-PHX-2026-014 — Brake Pad Quotation Request",
        "hs_email_text": "Hi team, following our call, please send over your formal quotation for the Astra Sedan "
                          "Refresh program at 420,000 units/year. We'll need PPAP Level 3 by SOP. Also open to "
                          "hearing your durability data vs. Competitor A if you have a comparison.",
        "hs_email_direction": "INCOMING_EMAIL",
        "hs_timestamp": ts_days_ago(30),
    }, associate_with=[("deals", DEAL_ID_1), ("contacts", CONTACT_ID_1)])

    create_engagement("notes", {
        "hs_note_body": "Customer Wants (Deal-1): Reduced warranty claims, lower landed cost. Procurement Head is "
                         "price-sensitive but responsive to TCO framing. Technical evaluator not yet engaged on this deal.",
        "hs_timestamp": ts_days_ago(30),
    }, associate_with=[("deals", DEAL_ID_1)])

    # --- Deal-2 activity history ---
    create_engagement("calls", {
        "hs_call_title": "Plant Visit Follow-up — Suspension Program",
        "hs_call_body": "Followed up after Phoenix's technical team visited the Chennai plant. They raised a "
                         "concern about NVH performance under sustained commercial load and asked for durability "
                         "test data. SOP date is tight (Nov 2026) — tooling status is in progress.",
        "hs_call_direction": "OUTBOUND",
        "hs_call_disposition": "af1e5346-ba97-4d55-a6e9-9e5b2e5f4bef",
        "hs_timestamp": ts_days_ago(20),
    }, associate_with=[("deals", DEAL_ID_2), ("contacts", CONTACT_ID_2)])

    create_engagement("emails", {
        "hs_email_subject": "RFQ-PHX-2026-021 — Suspension Durability Data Request",
        "hs_email_text": "Can you share your fatigue/durability test data for the HD suspension strut line? We need "
                          "this before we can move PPAP to Level 4. Also flagging: SOP is Nov 15, so tooling "
                          "completion needs to land by early October at the latest.",
        "hs_email_direction": "INCOMING_EMAIL",
        "hs_timestamp": ts_days_ago(15),
    }, associate_with=[("deals", DEAL_ID_2), ("contacts", CONTACT_ID_2)])

    create_engagement("notes", {
        "hs_note_body": "Customer Wants (Deal-2): Higher durability, faster lead time. Timeline risk around SOP date "
                         "is the main pressure point — tooling status needs close monitoring.",
        "hs_timestamp": ts_days_ago(15),
    }, associate_with=[("deals", DEAL_ID_2)])

# =========================================================================
# MAIN
# =========================================================================

if __name__ == "__main__":
    if "PASTE_" in ACCESS_TOKEN or any("PASTE_" in v for v in [COMPANY_ID, CONTACT_ID_1, CONTACT_ID_2, DEAL_ID_1, DEAL_ID_2]):
        print("Please fill in ACCESS_TOKEN and all 5 record IDs in the CONFIG section before running.")
    else:
        create_all_properties()
        populate_company()
        populate_contacts()
        populate_deals()
        populate_activities()
        print("\nDone. Refresh Phoenix's record pages in HubSpot to see the new fields and activities.")