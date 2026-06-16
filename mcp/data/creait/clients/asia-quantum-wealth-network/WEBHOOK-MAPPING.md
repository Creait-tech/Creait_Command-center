# QWS Intake Form — GHL Webhook Field Mapping Reference

**Webhook URL:** `https://services.leadconnectorhq.com/hooks/sTlvUPTx6xuouNAJ2JvA/webhook-trigger/129d0c9e-5ce7-4c2b-8a2b-74f8a66141a4`

**Method:** POST
**Content-Type:** application/json

---

## How GHL Inbound Webhook Field Mapping Works

When the form posts JSON, GHL receives it as a "Custom Webhook" trigger payload. Inside the workflow (WF #7 — QW Form Submission Entry Point), you'll add **"Update Contact Field"** actions to map each JSON key to the corresponding contact custom field.

The Inbound Webhook trigger exposes incoming payload keys as `{{inboundWebhookRequest.body.<key>}}`. You then map each one into the matching contact custom field action.

---

## Standard Contact Fields (8)

These map to GHL's built-in contact properties, not custom fields. In the workflow, use the "Create/Update Contact" action and assign:

| HTML form name | GHL Standard Field | Workflow value to assign |
|---|---|---|
| `business_name` | Company Name | `{{inboundWebhookRequest.body.business_name}}` |
| `first_name` | First Name | `{{inboundWebhookRequest.body.first_name}}` |
| `last_name` | Last Name | `{{inboundWebhookRequest.body.last_name}}` |
| `title` | Title | `{{inboundWebhookRequest.body.title}}` |
| `email` | Email | `{{inboundWebhookRequest.body.email}}` |
| `phone` | Phone | `{{inboundWebhookRequest.body.phone}}` |
| `location` | Address (or Notes) | `{{inboundWebhookRequest.body.location}}` |
| `lead_source` | Source | `{{inboundWebhookRequest.body.lead_source}}` (always = `intake-form`) |

> **Note on `location`:** The form asks "Where is your business based?" as a single text input. GHL has separate City/State fields. Easiest path: store the whole string in **Notes** or create a single custom field `Business Location`. Recommended: put it in **Address** field 1 and let the user clean up later.

---

## Custom Fields (35)

All 35 custom fields below were created via API on Apr 30, 2026. In the workflow, add **"Update Contact Field"** actions for each:

### Section 1 — About You & Your Business (7 fields)

| HTML form name | GHL Custom Field Name | Field Key | Field ID | Type |
|---|---|---|---|---|
| `business_entity_type` | Business Entity Type | `contact.business_entity_type` | `WJy5XNaoZKNowVeQudVx` | SINGLE_OPTIONS |
| `industry` | Industry | `contact.industry` | `ZZVEvimnsaAjPgQQm2yj` | SINGLE_OPTIONS |
| `years_in_business` | Years in Business | `contact.years_in_business` | `phWbX45r6pVXHGZ5545R` | SINGLE_OPTIONS |
| `founder_role` | Founder Role | `contact.founder_role` | `DyhinT7lANGU7enTrRt6` | SINGLE_OPTIONS |
| `team_size` | Team Size | `contact.team_size` | `FcXXfZrHymXDFO8rexii` | SINGLE_OPTIONS |
| `bookkeeping_handler` | Bookkeeping Handler | `contact.bookkeeping_handler` | `Xpbqe9Q3jmODCg2l72jJ` | SINGLE_OPTIONS |
| `books_cleanup_period` | Books Cleanup Period | `contact.books_cleanup_period` | `rqB4XsBnWarMJMNwx1c0` | SINGLE_OPTIONS |

### Section 2 — Financial Snapshot (16 fields)

| HTML form name | GHL Custom Field Name | Field Key | Field ID | Type |
|---|---|---|---|---|
| `annual_gross_revenue` | Annual Gross Revenue | `contact.annual_gross_revenue` | `xnrBHTVkFNoUJD16WhT8` | SINGLE_OPTIONS |
| `bookkeeping_state` | Bookkeeping State | `contact.bookkeeping_state` | `aA6tOMsxqRMwevo3rg8b` | SINGLE_OPTIONS |
| `accounting_software` | Accounting Software | `contact.accounting_software` | `PPCQEPx7F7mpfYDzm2Ea` | MULTIPLE_OPTIONS |
| `accounting_software_other` | Accounting Software Other | `contact.accounting_software_other` | `LFsyLlJ6MeSIcnWRJYNW` | TEXT |
| `payroll_method` | Payroll Method | `contact.payroll_method` | `2yHQEWXq7Dins5vi9WKe` | SINGLE_OPTIONS |
| `tracks_expenses` | Tracks Expenses | `contact.tracks_expenses` | `cNEL4KzVYO9XMYP7XNA4` | SINGLE_OPTIONS |
| `business_bank_setup` | Business Bank Setup | `contact.business_bank_setup` | `pIYt4V4405OvvcJVaFy0` | SINGLE_OPTIONS |
| `business_credit_status` | Business Credit Status | `contact.business_credit_status` | `lJVBu6DV7dGX9Q5nxcYY` | SINGLE_OPTIONS |
| `num_business_bank_accounts` | # Business Bank Accounts | `contact._business_bank_accounts` | `ecGSE4pnd2D8mpuBez5x` | NUMERICAL |
| `num_business_credit_cards` | # Business Credit Cards | `contact._business_credit_cards` | `AuahLQBSqlCCr8SwzglD` | NUMERICAL |
| `num_business_loans` | # Business Loans | `contact._business_loans` | `unJt4LRSU19MpKsphFHP` | NUMERICAL |
| `monthly_transactions` | Monthly Transactions | `contact.monthly_transactions` | `JlZRRggH2zLMhXz4hRvP` | SINGLE_OPTIONS |
| `mixes_personal_accounts` | Mixes Personal Accounts | `contact.mixes_personal_accounts` | `g6QSZDLYeQcciXH8YyJy` | SINGLE_OPTIONS |
| `num_personal_cards_used` | # Personal Cards Used for Business | `contact._personal_cards_used_for_business` | `n2fbMLzeJwz1mUBZfmsQ` | NUMERICAL |
| `personal_acct_monthly_transactions` | Personal Acct Monthly Transactions | `contact.personal_acct_monthly_transactions` | `wtGqaPWG5tEmVfBlNZNW` | NUMERICAL |
| `tax_status` | Tax Status | `contact.tax_status` | `kAySQMyQNc0ODa9NECTf` | SINGLE_OPTIONS |

### Section 3 — Goals & Support (12 fields)

| HTML form name | GHL Custom Field Name | Field Key | Field ID | Type |
|---|---|---|---|---|
| `services_interested_in` | Services Interested In | `contact.services_interested_in` | `pgxYb4KjkyoNBWu1bEMv` | MULTIPLE_OPTIONS |
| `top_2_priorities` | Top 2 Financial Priorities | `contact.top_2_financial_priorities` | `3z3PGj51qepZpbJhseBZ` | MULTIPLE_OPTIONS |
| `other_priority` | Other Priority | `contact.other_priority` | `uzmPi8jNVfsogp3EHpMV` | TEXT |
| `biggest_frustration` | Biggest Financial Frustration | `contact.biggest_financial_frustration` | `ToXMos312FKx2oueMmZt` | LARGE_TEXT |
| `past_pro_experience` | Past Pro Experience | `contact.past_pro_experience` | `gfhuFWt9qDo2xtbHVvSw` | SINGLE_OPTIONS |
| `currently_working_with` | Currently Working With | `contact.currently_working_with` | `ma3Rs5fQbo6zUees4dxN` | SINGLE_OPTIONS |
| `pro_experience_details` | Pro Experience Details | `contact.pro_experience_details` | `Tn40usgcyf5d1pz7kT2P` | LARGE_TEXT |
| `ideal_partner_traits` | Ideal Partner Traits | `contact.ideal_partner_traits` | `2JnRkhNmtCyvhuzIwRHj` | MULTIPLE_OPTIONS |
| `ready_to_start` | Ready to Start | `contact.ready_to_start` | `X4G4mFBOH1U5F9Tn12gM` | SINGLE_OPTIONS |
| `how_did_you_hear_about_us` | How Did You Hear About Us? | `contact.how_did_you_hear_about_us` | `DeVi858U06SzW9K3aZhX` | SINGLE_OPTIONS |
| `how_did_you_hear_about_us_other` | Heard About Us - Other | `contact.heard_about_us__other` | `CbtruQXbXkBr9RI6Bwl5` | TEXT |
| `anything_else` | Anything Else to Share | `contact.anything_else_to_share` | `8Aps4CDwczcUdEo2FQ1h` | LARGE_TEXT |

---

## Sample Webhook Payload

This is what the HTML form posts when a user submits. Use this for testing in GHL's webhook trigger setup (paste into "Capture Sample Payload"):

```json
{
  "business_name": "Acme Co",
  "first_name": "Jane",
  "last_name": "Doe",
  "title": "Founder",
  "email": "jane@acme.com",
  "phone": "(404) 555-1234",
  "location": "Atlanta, GA",
  "business_entity_type": "Single-Member LLC",
  "industry": "Professional Services",
  "years_in_business": "3-5 years",
  "founder_role": "Founder",
  "team_size": "2-5",
  "bookkeeping_handler": "Owner",
  "books_cleanup_period": "1-3 years",
  "annual_gross_revenue": "$250K-$500K",
  "bookkeeping_state": "Behind but manageable",
  "accounting_software": "QuickBooks Online, Excel/Google Sheets",
  "accounting_software_other": "",
  "payroll_method": "Outsourced",
  "tracks_expenses": "Sometimes",
  "business_bank_setup": "Business only",
  "business_credit_status": "Business card only",
  "num_business_bank_accounts": "2",
  "num_business_credit_cards": "1",
  "num_business_loans": "0",
  "monthly_transactions": "101-300",
  "mixes_personal_accounts": "Yes",
  "num_personal_cards_used": "1",
  "personal_acct_monthly_transactions": "10",
  "tax_status": "Behind",
  "services_interested_in": "Bookkeeping Cleanup, Tax Prep, Financial Strategy",
  "top_2_priorities": "Get books in order, Reduce taxes",
  "other_priority": "",
  "biggest_frustration": "I don't know if I'm profitable month-to-month.",
  "past_pro_experience": "Bookkeeper",
  "currently_working_with": "First time",
  "pro_experience_details": "",
  "ideal_partner_traits": "Proactive communication, Strategic guidance, Clear pricing",
  "ready_to_start": "Within 1 month",
  "how_did_you_hear_about_us": "Referral",
  "how_did_you_hear_about_us_other": "",
  "anything_else": "Looking forward to getting started.",
  "lead_source": "intake-form",
  "submitted_at": "2026-04-30T01:45:00.000Z"
}
```

---

## WF #7 Setup Checklist

In GHL → Automation → Workflows → **QW Form Submission Entry Point**:

### 1. Trigger
- Type: **Inbound Webhook**
- URL: (auto-generated, already in use): `https://services.leadconnectorhq.com/hooks/sTlvUPTx6xuouNAJ2JvA/webhook-trigger/129d0c9e-5ce7-4c2b-8a2b-74f8a66141a4`
- Click **"Capture Sample Payload"** and either submit the form once OR paste the JSON above to register the field map

### 2. Action 1 — Create / Update Contact
Map standard fields:
- Email → `{{inboundWebhookRequest.body.email}}`
- First Name → `{{inboundWebhookRequest.body.first_name}}`
- Last Name → `{{inboundWebhookRequest.body.last_name}}`
- Phone → `{{inboundWebhookRequest.body.phone}}`
- Company Name → `{{inboundWebhookRequest.body.business_name}}`
- Title → `{{inboundWebhookRequest.body.title}}`
- Source → `intake-form` (literal)

### 3. Action 2 — Update Contact Custom Fields (35 fields)
Add an "Update Contact Field" action for each row in the Custom Fields tables above. Pattern:
- **Field**: pick the GHL Custom Field by name
- **Value**: `{{inboundWebhookRequest.body.<html_name>}}`

> **Pro tip**: GHL lets you batch multiple custom field updates in a single "Update Contact" action — use that to keep the workflow clean (1 contact-update step instead of 35 separate ones).

### 4. Action 3 — Add Tag
- Tag: `lead-source-intake-form`

### 5. Action 4 — Create Opportunity
- Pipeline: **QW Founder Journey** (`3hbvJmywj30gNlMdBilT`)
- Stage: **Warm Lead** (`7e645a50-404c-4840-9471-07b8bfd27949`)
- Status: **Open**
- Lead Value: $0 (or your default)

### 6. Publish
- Toggle Draft → Published when ready
- Once stage = Warm Lead is set, **WF #1 (QW Founder Warm Lead Nurture)** auto-fires the Day 1 Welcome email

---

## Special Handling Notes

### Multi-select fields (3 fields)
`accounting_software`, `services_interested_in`, `top_2_priorities`, `ideal_partner_traits` are MULTIPLE_OPTIONS. The form sends these as **comma-separated strings** (e.g., `"Bookkeeping Cleanup, Tax Prep, Financial Strategy"`).

GHL MULTIPLE_OPTIONS fields accept comma-separated string values. ✅ No transformation needed.

### Conditional fields (5 fields — may be empty)
- `accounting_software_other` — only populated if user selected "Other" for accounting software
- `other_priority` — only populated if user selected "Other" for top priorities
- `pro_experience_details` — only populated if user selected "Other" for currently working with
- `how_did_you_hear_about_us_other` — only populated if user selected "Other" for how heard
- `num_personal_cards_used` / `personal_acct_monthly_transactions` — only populated if `mixes_personal_accounts = "Yes"`

These will arrive as **empty strings**, which GHL handles fine. No special logic needed.

### `submitted_at`
ISO timestamp added by the form. Optional — don't need to map this anywhere unless you want it in a "First Submission Date" custom field (would need to create one).

---

## Validation: Did It Work?

After deploying form + publishing workflow:

1. Submit the form yourself with test data
2. In GHL → Contacts, find the new contact
3. Verify all 35 custom fields populated on contact record
4. Verify Opportunity created in QW Founder Journey at Stage 0
5. Verify tag `lead-source-intake-form` added
6. Wait ~5 min — Day 1 Welcome email should fire from WF #1

If any field is blank on contact but had a value in form: webhook mapping in workflow has a typo. Re-check the `{{inboundWebhookRequest.body.<name>}}` reference.

---

*Mapping reference v1 — Apr 30, 2026 · 35 custom fields + 8 standard fields = 43 total mapped*
