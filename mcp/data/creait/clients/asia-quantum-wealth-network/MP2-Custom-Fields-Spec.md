# MP2 Custom Fields & Automations Specification
## QWN Founder Onboarding — GHL API Build Guide
**Date**: 2026-04-14 | **Location ID**: sTlvUPTx6xuouNAJ2JvA

---

## API Reference

**Endpoint**: `POST https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields`

**Headers**:
```
Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c
Version: 2021-07-28
Content-Type: application/json
```

**Valid dataTypes**: `TEXT, LARGE_TEXT, NUMERICAL, PHONE, MONETORY, CHECKBOX, SINGLE_OPTIONS, MULTIPLE_OPTIONS, FLOAT, TIME, DATE, TEXTBOX_LIST, FILE_UPLOAD, SIGNATURE, RADIO`

**Key findings from API testing**:
- CHECKBOX requires `"options": ["Yes"]` in the body
- Dropdowns use `SINGLE_OPTIONS` (not "DROPDOWN")
- DATE and NUMERICAL do not require options
- TEXT does not require options

---

## Section 1: Custom Fields

### 1A. Fields Already Created (API-verified)

| # | Field Name | dataType | Field Key | GHL ID | Status |
|---|-----------|----------|-----------|--------|--------|
| 1 | QBO Access Confirmed | CHECKBOX | contact.qbo_access_confirmed | flYScurPVOObR01D9ch7 | CREATED |
| 2 | Service Tier | SINGLE_OPTIONS | contact.service_tier | 9338keDi9WmOA1KKXZr3 | CREATED |
| 3 | Kickoff Call Date | DATE | contact.kickoff_call_date | kDg6iDQwlTOD9JpiVdtI | CREATED |
| 4 | Monthly Deliverable Day | NUMERICAL | contact.monthly_deliverable_day | MM2hm3Oj3eIc0H6wUZiC | CREATED |

### 1B. Fields Still Needed — Document Collection Checklist

These track each required document on the contact record. When all are checked, the system can auto-tag "Ready for Orientation."

| # | Field Name | dataType | Options | Purpose |
|---|-----------|----------|---------|---------|
| 5 | Doc: Engagement Letter Signed | CHECKBOX | ["Yes"] | Stage 1 exit criterion, confirmed again at Stage 2 |
| 6 | Doc: Business Entity Documents | CHECKBOX | ["Yes"] | LLC/Corp/Articles of Incorporation |
| 7 | Doc: EIN Letter | CHECKBOX | ["Yes"] | IRS confirmation of tax ID |
| 8 | Doc: Bank Statements | CHECKBOX | ["Yes"] | All accounts, all months per scope |
| 9 | Doc: Credit Card Statements | CHECKBOX | ["Yes"] | All cards, all months per scope |
| 10 | Doc: Tax Returns | CHECKBOX | ["Yes"] | Prior year business tax return |
| 11 | Doc: Payroll Info | CHECKBOX | ["Yes"] | Payroll provider + quarterly reports |
| 12 | Doc: Loan/Lease Agreements | CHECKBOX | ["Yes"] | Lines of credit, leases |
| 13 | Doc: Asset List | CHECKBOX | ["Yes"] | Equipment, vehicles with values |
| 14 | Doc: Merchant Account Statements | CHECKBOX | ["Yes"] | PayPal, Stripe, Square statements |

### 1C. Fields Still Needed — Module Completion Tracking

| # | Field Name | dataType | Options | Purpose |
|---|-----------|----------|---------|---------|
| 15 | Module 1: Orientation Complete | CHECKBOX | ["Yes"] | Week 1 webinar completion |
| 16 | Module 2: Business Foundations Complete | CHECKBOX | ["Yes"] | Week 2 webinar completion |
| 17 | Module 3: Profit First Complete | CHECKBOX | ["Yes"] | Week 3 webinar completion |
| 18 | Module 4: CFO Strategy Complete | CHECKBOX | ["Yes"] | Week 4 webinar completion |

### 1D. Fields Still Needed — Other Contact Fields

| # | Field Name | dataType | Options/Notes | Purpose |
|---|-----------|----------|---------------|---------|
| 19 | Documents Complete | CHECKBOX | ["Yes"] | Master flag: all docs received |
| 20 | Assigned Strategist | TEXT | -- | Name of assigned QWS strategist |
| 21 | Founder Portal Access | TEXT | -- | Portal login URL for founder |
| 22 | Communication Preference | SINGLE_OPTIONS | ["Email", "Text", "Phone", "Slack"] | From kickoff call |
| 23 | 30-Day Review Call Date | DATE | -- | Graduation review scheduling |
| 24 | Onboarding Start Date | DATE | -- | Tracks Day 1 for timed automations |

---

## Section 2: Tags

### 2A. Tags That Already Exist (no action needed)

| Tag Name | GHL ID | Notes |
|----------|--------|-------|
| active-founder | LoAiOXrIxQhCXeL7MgfF | Stage 4 |
| founder | tAahUOQu1nVm8zZINCG7 | General |
| warm-lead | eaxLx4nfsGoAuHHzDrPN | Stage 0 |
| warm lead | 8r1OotD511HF4JevRa01 | Duplicate (consider cleanup) |
| onboarded | 4LJyA9hzeRRl3ItZ7Acy | General |
| new lead | qP6zdPd3pPEcin2k2MwY | Stage 0 entry |
| follow-up | a2H25WM9lCaIIIsTyYds | Stage 5 |

### 2B. Tags to Create

| # | Tag Name | Trigger/Purpose |
|---|---------|----------------|
| 1 | ready-for-orientation | All Stage 2 docs checked complete -> auto-advance signal |
| 2 | jumpstart-active | Founder enters Stage 3 educational series |
| 3 | jumpstart-week1-active | Week 1 webinar unlocked/in progress |
| 4 | jumpstart-week2-active | Week 2 webinar unlocked/in progress |
| 5 | jumpstart-week3-active | Week 3 webinar unlocked/in progress |
| 6 | jumpstart-week4-active | Week 4 webinar unlocked/in progress |
| 7 | jumpstart-graduate | All 4 modules complete, graduated to Active Founder |
| 8 | module-1-complete | Orientation webinar completed |
| 9 | module-2-complete | Business Foundations webinar completed |
| 10 | module-3-complete | Profit First webinar completed |
| 11 | module-4-complete | CFO Strategy webinar completed |
| 12 | docs-pending | Documents still outstanding at Stage 2 |
| 13 | engagement-letter-sent | Stage 1: engagement letter dispatched |
| 14 | engagement-letter-signed | Stage 1: engagement letter returned signed |
| 15 | qws-founder | QWS service client (from SOP) |
| 16 | service-starter | Service tier: Starter |
| 17 | service-growth | Service tier: Growth |
| 18 | service-legacy | Service tier: Legacy |
| 19 | active-founder-ongoing | Monthly retainer active, SOW fulfilled |
| 20 | paused-needs-outreach | Stage 5: requires re-engagement |

**Note**: Tags in GHL are created automatically when first applied to a contact via workflow or API. The tag creation API endpoint is `POST /locations/{locationId}/tags` with body `{"name": "tag-name"}`.

---

## Section 3: Curl Commands — Custom Fields (Remaining)

All commands use the same headers. Run these sequentially.

### Document Collection Checklist Fields (5-14)

```bash
# 5. Doc: Engagement Letter Signed
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Doc: Engagement Letter Signed", "dataType": "CHECKBOX", "model": "contact", "options": ["Yes"]}'

# 6. Doc: Business Entity Documents
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Doc: Business Entity Documents", "dataType": "CHECKBOX", "model": "contact", "options": ["Yes"]}'

# 7. Doc: EIN Letter
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Doc: EIN Letter", "dataType": "CHECKBOX", "model": "contact", "options": ["Yes"]}'

# 8. Doc: Bank Statements
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Doc: Bank Statements", "dataType": "CHECKBOX", "model": "contact", "options": ["Yes"]}'

# 9. Doc: Credit Card Statements
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Doc: Credit Card Statements", "dataType": "CHECKBOX", "model": "contact", "options": ["Yes"]}'

# 10. Doc: Tax Returns
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Doc: Tax Returns", "dataType": "CHECKBOX", "model": "contact", "options": ["Yes"]}'

# 11. Doc: Payroll Info
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Doc: Payroll Info", "dataType": "CHECKBOX", "model": "contact", "options": ["Yes"]}'

# 12. Doc: Loan/Lease Agreements
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Doc: Loan/Lease Agreements", "dataType": "CHECKBOX", "model": "contact", "options": ["Yes"]}'

# 13. Doc: Asset List
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Doc: Asset List", "dataType": "CHECKBOX", "model": "contact", "options": ["Yes"]}'

# 14. Doc: Merchant Account Statements
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Doc: Merchant Account Statements", "dataType": "CHECKBOX", "model": "contact", "options": ["Yes"]}'
```

### Module Completion Fields (15-18)

```bash
# 15. Module 1: Orientation Complete
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Module 1: Orientation Complete", "dataType": "CHECKBOX", "model": "contact", "options": ["Yes"]}'

# 16. Module 2: Business Foundations Complete
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Module 2: Business Foundations Complete", "dataType": "CHECKBOX", "model": "contact", "options": ["Yes"]}'

# 17. Module 3: Profit First Complete
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Module 3: Profit First Complete", "dataType": "CHECKBOX", "model": "contact", "options": ["Yes"]}'

# 18. Module 4: CFO Strategy Complete
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Module 4: CFO Strategy Complete", "dataType": "CHECKBOX", "model": "contact", "options": ["Yes"]}'
```

### Other Contact Fields (19-24)

```bash
# 19. Documents Complete (master flag)
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Documents Complete", "dataType": "CHECKBOX", "model": "contact", "options": ["Yes"]}'

# 20. Assigned Strategist
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Assigned Strategist", "dataType": "TEXT", "model": "contact"}'

# 21. Founder Portal Access
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Founder Portal Access", "dataType": "TEXT", "model": "contact"}'

# 22. Communication Preference
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Communication Preference", "dataType": "SINGLE_OPTIONS", "model": "contact", "options": ["Email", "Text", "Phone", "Slack"]}'

# 23. 30-Day Review Call Date
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "30-Day Review Call Date", "dataType": "DATE", "model": "contact"}'

# 24. Onboarding Start Date
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/customFields' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "Onboarding Start Date", "dataType": "DATE", "model": "contact"}'
```

---

## Section 4: Curl Commands — Tags

Tags in GHL are auto-created when applied via workflows. However, to pre-create them for use in workflow builders:

```bash
# Tag creation endpoint
# POST https://services.leadconnectorhq.com/locations/{locationId}/tags
# Body: {"name": "tag-name"}

# 1. ready-for-orientation
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "ready-for-orientation"}'

# 2. jumpstart-active
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "jumpstart-active"}'

# 3. jumpstart-week1-active
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "jumpstart-week1-active"}'

# 4. jumpstart-week2-active
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "jumpstart-week2-active"}'

# 5. jumpstart-week3-active
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "jumpstart-week3-active"}'

# 6. jumpstart-week4-active
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "jumpstart-week4-active"}'

# 7. jumpstart-graduate
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "jumpstart-graduate"}'

# 8. module-1-complete
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "module-1-complete"}'

# 9. module-2-complete
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "module-2-complete"}'

# 10. module-3-complete
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "module-3-complete"}'

# 11. module-4-complete
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "module-4-complete"}'

# 12. docs-pending
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "docs-pending"}'

# 13. engagement-letter-sent
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "engagement-letter-sent"}'

# 14. engagement-letter-signed
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "engagement-letter-signed"}'

# 15. qws-founder
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "qws-founder"}'

# 16. service-starter
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "service-starter"}'

# 17. service-growth
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "service-growth"}'

# 18. service-legacy
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "service-legacy"}'

# 19. active-founder-ongoing
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "active-founder-ongoing"}'

# 20. paused-needs-outreach
curl -s -X POST 'https://services.leadconnectorhq.com/locations/sTlvUPTx6xuouNAJ2JvA/tags' \
  -H 'Authorization: Bearer pit-e86c7ac6-21a1-44bc-8afe-37e04bbc1a8c' \
  -H 'Version: 2021-07-28' \
  -H 'Content-Type: application/json' \
  -d '{"name": "paused-needs-outreach"}'
```

---

## Section 5: Automation Logic Specification

These are the workflow automations that USE the custom fields and tags above. They cannot be created via API -- they must be built in the GHL workflow builder. This section specifies the exact logic.

### 5A. Auto-Advance: Stage 1 -> Stage 2 (Engagement Letter Signed)

**Trigger**: Tag `engagement-letter-signed` added to contact
**Conditions**: Contact is in pipeline "QW Founder Journey" at Stage 1
**Actions**:
1. Set custom field "Doc: Engagement Letter Signed" = Yes
2. Move opportunity to Stage 2 (Onboarding Kickoff)
3. Add tag `docs-pending`
4. Send email template DOC-01 (Document Request)
5. Create internal notification: "Founder [Name] signed engagement letter -- begin doc collection"
6. Set custom field "Onboarding Start Date" = current date

### 5B. Document Reminder Loop (Stage 2)

**Trigger**: Tag `docs-pending` added to contact
**Conditions**: Custom field "Documents Complete" is NOT checked
**Actions**:
1. Wait 3 days
2. If "Documents Complete" still unchecked:
   - Send SMS: "Q-Pilot here -- just checking in. We're still missing a few documents to get your books rolling. Reply if you need help with anything."
3. Wait 4 days
4. If "Documents Complete" still unchecked:
   - Send email: follow-up requesting missing documents
5. Wait 3 days
6. If "Documents Complete" still unchecked:
   - Create internal task: "Follow up manually with [Name] -- documents outstanding 10+ days"

### 5C. Auto-Advance: Stage 2 -> Stage 3 (Ready for Orientation)

**Trigger**: Custom field "Documents Complete" set to Yes OR tag `ready-for-orientation` added
**Conditions**: Contact is at Stage 2 in pipeline
**Actions**:
1. Move opportunity to Stage 3 (Onboarding)
2. Remove tag `docs-pending`
3. Add tags: `jumpstart-active`, `jumpstart-week1-active`
4. Send email template W1-01 (Week 1 Webinar Unlock)
5. Create internal notification: "Founder [Name] docs complete -- JumpStart Week 1 unlocked"

### 5D. Module 1 Completion -> Week 2 Unlock

**Trigger**: Tag `module-1-complete` added OR custom field "Module 1: Orientation Complete" set to Yes
**Actions**:
1. Set custom field "Module 1: Orientation Complete" = Yes (if triggered by tag)
2. Add tag `module-1-complete` (if triggered by field)
3. Send congratulatory email: "Module 1 complete! You're building momentum, Captain."
4. Wait until Day 7 from Onboarding Start Date (or immediately if past Day 7)
5. Add tag `jumpstart-week2-active`
6. Send email template W2-01 (Week 2 Webinar Unlock)

### 5E. Module 2 Completion -> Week 3 Unlock

**Trigger**: Tag `module-2-complete` added OR custom field "Module 2: Business Foundations Complete" set to Yes
**Actions**:
1. Sync field and tag (set both)
2. Send congratulatory email
3. Wait until Day 14 from Onboarding Start Date
4. Add tag `jumpstart-week3-active`
5. Send email template W3-01 (Week 3 Webinar Unlock)
6. Create internal task: "Send first financial deliverable to [Name]"

### 5F. Module 3 Completion -> Week 4 Unlock

**Trigger**: Tag `module-3-complete` added OR custom field "Module 3: Profit First Complete" set to Yes
**Actions**:
1. Sync field and tag
2. Send congratulatory email
3. Wait until Day 21 from Onboarding Start Date
4. Add tag `jumpstart-week4-active`
5. Send email template W4-01 (Week 4 Webinar Unlock)
6. Send 30-day review booking link

### 5G. Auto-Advance: Stage 3 -> Stage 4 (Graduation)

**Trigger**: Tag `module-4-complete` added OR custom field "Module 4: CFO Strategy Complete" set to Yes
**Conditions**: All 4 module fields are checked Yes
**Actions**:
1. Set "Module 4: CFO Strategy Complete" = Yes
2. Add tags: `jumpstart-graduate`, `active-founder-ongoing`
3. Remove tags: `jumpstart-active`, `jumpstart-week1-active`, `jumpstart-week2-active`, `jumpstart-week3-active`, `jumpstart-week4-active`
4. Move opportunity to Stage 4 (Active Founder)
5. Send email template GRAD-01 (Graduation Email)
6. Create internal notification: "Founder [Name] graduated JumpStart -- now Active Founder"

### 5H. Entry Point: Calendar Booking -> Stage 0

**Trigger**: Calendar event booked (discovery call calendar)
**Actions**:
1. Create contact if not exists
2. Add tag `warm-lead`
3. Create opportunity in pipeline "QW Founder Journey" at Stage 0
4. Send Q-Pilot welcome email (Day 1 nurture sequence)

### 5I. Entry Point: Form Submission -> Stage 0

**Trigger**: Form submitted (Client Intake Form)
**Actions**:
1. Create contact if not exists
2. Add tag `warm-lead`
3. Create opportunity in pipeline at Stage 0
4. Send Q-Pilot welcome email

---

## Section 6: Field-to-Spec Traceability

Maps each field/tag back to the source document requirement.

| Field/Tag | Master Spec Reference | SOP Reference |
|-----------|----------------------|---------------|
| Doc: Engagement Letter Signed | MP2 Phase 1 -- Stage 1 exit criterion | Stage 1: Contract & Payment |
| Doc: Business Entity Documents | MP2 Phase 2 -- doc collection list | Stage 2: Founder checklist item |
| Doc: EIN Letter | MP2 Phase 2 -- doc collection list | Stage 2: Founder checklist item |
| Doc: Bank Statements | MP2 Phase 2 -- doc collection list | Stage 2 + Stage 3 doc verification |
| Doc: Credit Card Statements | MP2 Phase 2 -- doc collection list | Stage 2: Founder checklist item |
| Doc: Tax Returns | MP2 Phase 2 -- doc collection list | Stage 2: Founder checklist item |
| Doc: Payroll Info | MP2 Phase 2 -- doc collection list | Stage 2: Founder checklist item |
| Doc: Loan/Lease Agreements | MP2 Phase 2 -- doc collection list | Stage 2: Founder checklist item |
| Doc: Asset List | MP2 Phase 2 -- doc collection list | Stage 2: Founder checklist item |
| Doc: Merchant Account Statements | MP2 Phase 2 -- doc collection list | Stage 2: Financial statements |
| QBO Access Confirmed | MP2 Phase 2 -- QB setup requirement | Stage 2: QBO access verification |
| Documents Complete | MP2 Phase 2 -- gate to Stage 3 | Stage 3: All docs received |
| Module 1-4 fields | MP2 Phase 3 -- educational series tracking | Weeks 1-4 webinar completion |
| Service Tier | SOP custom fields table | Dropdown: Starter/Growth/Legacy |
| Kickoff Call Date | SOP custom fields table | Week 1 scheduling |
| Monthly Deliverable Day | SOP custom fields table | Ongoing monthly workflow |
| Assigned Strategist | SOP custom fields table | Team assignment |
| Founder Portal Access | SOP custom fields table | Portal URL tracking |
| Communication Preference | SOP kickoff call agenda item 5 | Email/Text/Phone/Slack |
| 30-Day Review Call Date | SOP Week 4 action | Graduation review scheduling |
| Onboarding Start Date | Derived -- needed for Day+N triggers | Tracks Day 1 for timed sequences |
| ready-for-orientation | Master spec MP2 -- "Ready for Orientation" tag | Stage 2 -> 3 gate |
| module-N-complete tags | Spec audit P1 gap #14 | Module tracking mechanism |
| jumpstart-weekN-active tags | SOP "Tags to Configure" section | Week-level tracking |

---

## Section 7: Gaps This Spec Closes (from BUILD-STATUS.md)

| BUILD-STATUS Gap # | Gap Description | How This Spec Addresses It |
|-------------------|-----------------|---------------------------|
| P1-6 | No Stage 3 educational series workflow | Section 5D-5F: Module unlock workflows |
| P1-7 | No Stage 4 auto-activation workflow | Section 5G: Graduation auto-advance |
| P1-8 | Stage 2 document checklist not built | Section 1B: 10 Doc checkbox fields |
| P1-9 | No entry point automations | Section 5H-5I: Calendar + Form entry points |
| P1-10 | No auto-advance logic between stages | Sections 5A, 5C, 5G: Stage transition automations |
| P1-12 | "Ready for Orientation" tag missing | Section 2B tag #1 |
| P1-14 | No module completion tracking | Section 1C: 4 module fields + Section 2B: 4 module tags |

---

## Section 8: Execution Checklist

- [x] API tested and verified (CHECKBOX, SINGLE_OPTIONS, DATE, NUMERICAL, TEXT all confirmed)
- [x] 4 custom fields created during testing (QBO Access, Service Tier, Kickoff Call Date, Monthly Deliverable Day)
- [ ] Run remaining 20 custom field curl commands (Section 3)
- [ ] Run 20 tag creation curl commands (Section 4)
- [ ] Build 9 workflows in GHL workflow builder (Section 5A-5I)
- [ ] Verify all fields appear in contact records
- [ ] Test auto-advance logic with a test contact
- [ ] Update BUILD-STATUS.md with results
