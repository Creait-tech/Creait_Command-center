# Custom Fields — Bespoke Order Details folder

**GHL Path:** Settings → Custom Fields → + Add Field → Place in folder "Bespoke Order Details"

Create this folder first, then add all 17 fields inside it. All fields live on the **Contact** object (not Opportunity) so they persist across repeat orders — this is critical for VIP/repeat client detection.

---

## The 17 fields

| # | Field Name | Data Type | Options / Format | Used By |
|---|---|---|---|---|
| 1 | Occasion | Single Options (dropdown) | Wedding, Business, Black-tie Event, Lifestyle, Travel, Other | Inquiry form, WF1, WF8 |
| 2 | Event Date | Date | MM/DD/YYYY | Inquiry form, WF5 timing logic |
| 3 | Budget Range | Single Options | $3,500–$5,000 / $5,000–$7,500 / $7,500–$10,000 / $10,000+ / Open to guidance | Inquiry form, Dustin triage |
| 4 | Suit Type Interest | Single Options | Custom (made-to-measure), Bespoke (fully hand-crafted), Not sure yet | Inquiry form, AI agent qualification |
| 5 | Preferred Communication | Single Options | SMS, Email, Phone Call, Instagram DM, WhatsApp | WF1 routing logic |
| 6 | Experience Level | Single Options | First bespoke commission, Existing pattern with us, Multiple commissions elsewhere | Inquiry form, WF8 customization |
| 7 | Fabric Selected | Text (single line) | Free text — e.g. "Loro Piana Super 150s Navy" | Consult completion, WF5 |
| 8 | Mill | Text (single line) | e.g. "Loro Piana", "Scabal", "Dormeuil" | Consult completion |
| 9 | Deposit Amount | Monetary | USD | WF6B, Dashboard |
| 10 | Total Order Value | Monetary | USD | WF6C, Pipeline opportunity value |
| 11 | Order Status | Single Options | Awaiting deposit, Deposit paid, In production, Fitting scheduled, Final fitting complete, Delivered | WF5, internal dashboard |
| 12 | Pattern On File | Checkbox | Yes/No | Repeat order fast-track logic |
| 13 | Measurements Taken Date | Date | MM/DD/YYYY | Consult completion, WF5 Week 0 trigger |
| 14 | Fabric Approved | Checkbox | Yes/No | Triggers Pipeline Stage 5 (Fabric & Design Selected) |
| 15 | Production Start Date | Date | MM/DD/YYYY | WF5 milestone timing |
| 16 | Expected Delivery Date | Date | MM/DD/YYYY | Automatically calculated (Production Start + 28 days) |
| 17 | Referred By | Text (single line) | Name of referring client | WF10 referral loop, VIP detection |

---

## Field key naming (API)

GHL auto-generates field keys from the field name. For consistency and API scripting, here are the expected keys (GHL converts to `snake_case` with the location prefix `contact.`):

| Field | API Key |
|---|---|
| Occasion | `contact.occasion` |
| Event Date | `contact.event_date` |
| Budget Range | `contact.budget_range` |
| Suit Type Interest | `contact.suit_type_interest` |
| Preferred Communication | `contact.preferred_communication` |
| Experience Level | `contact.experience_level` |
| Fabric Selected | `contact.fabric_selected` |
| Mill | `contact.mill` |
| Deposit Amount | `contact.deposit_amount` |
| Total Order Value | `contact.total_order_value` |
| Order Status | `contact.order_status` |
| Pattern On File | `contact.pattern_on_file` |
| Measurements Taken Date | `contact.measurements_taken_date` |
| Fabric Approved | `contact.fabric_approved` |
| Production Start Date | `contact.production_start_date` |
| Expected Delivery Date | `contact.expected_delivery_date` |
| Referred By | `contact.referred_by` |

---

## API payload reference

POST `https://services.leadconnectorhq.com/locations/{locationId}/customFields`
Headers: `Authorization: Bearer {PIT}`, `Version: 2021-07-28`, `Content-Type: application/json`

Example — creating the "Occasion" dropdown:

```json
{
  "name": "Occasion",
  "dataType": "RADIO",
  "placeholder": "Select occasion",
  "position": 1,
  "model": "contact",
  "options": [
    { "name": "Wedding", "position": 0 },
    { "name": "Business", "position": 1 },
    { "name": "Black-tie Event", "position": 2 },
    { "name": "Lifestyle", "position": 3 },
    { "name": "Travel", "position": 4 },
    { "name": "Other", "position": 5 }
  ]
}
```

See `13_api-bulk-import.js` for the script that creates all 17 fields in one run.

---

## Why these specific fields

Each field ties directly to either (a) a pipeline stage trigger, (b) a workflow timing decision, or (c) a customization merge field inside a message. No vanity fields. If Dustin adds one later that's used in copy, it must be added here first so the merge field exists.
