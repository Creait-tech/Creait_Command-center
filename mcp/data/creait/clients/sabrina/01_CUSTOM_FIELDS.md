# Custom Fields — Contact & Opportunity

Create these in **Settings → Custom Fields** in the Franklin Insurance Solutions sub-account.

## Contact Custom Fields

### Business Info
| Field Name | Type | Picklist / Notes |
|---|---|---|
| Business Legal Name | Single Line | |
| DBA | Single Line | |
| Business Website | Single Line (URL) | |
| Business Phone | Phone | |
| Business Address Line 1 | Single Line | |
| Business Address Line 2 | Single Line | |
| Business City | Single Line | |
| Business State | Dropdown | 50 states |
| Business ZIP | Single Line | |
| Industry / NAICS Description | Single Line | |
| Annual Revenue (Estimated) | Numeric | |
| Years in Business | Numeric | |
| Number of Employees | Numeric | |
| EIN | Single Line (encrypted) | Sensitive — masked display |

### Insurance Product Interest
| Field Name | Type | Picklist |
|---|---|---|
| Primary Product Interest | Dropdown | Cyber, Professional Liability, Surety Bond, Commercial GL, Workers Comp, Other |
| Secondary Product Interest | Multi-select | Same list |
| Current Carrier | Single Line | |
| Current Policy Expiration | Date | |
| Current Annual Premium | Numeric | |
| Has Had a Claim (Last 5 Yrs) | Radio | Yes / No / Unknown |

### Cyber-Specific (conditional, show when Primary = Cyber)
| Field Name | Type | Notes |
|---|---|---|
| Takes Credit Cards | Radio | Yes / No |
| Stores PII | Radio | Yes / No |
| Website CMS | Dropdown | WordPress, Shopify, Wix, Squarespace, Custom, Other |
| Uses MFA Company-wide | Radio | Yes / No / Partial |
| Had a Cyber Incident Before | Radio | Yes / No |

### Pro-Liability-Specific (conditional)
| Field Name | Type | Notes |
|---|---|---|
| Service Type | Dropdown | Consulting, Coaching, Design, Tech, Beauty/Salon, Medical, Legal, Accounting, Other |
| License or Certification Required | Radio | Yes / No |
| Offers Advice / Opinions | Radio | Yes / No |
| Retroactive Date Needed | Date | |

### Surety-Specific (conditional)
| Field Name | Type | Notes |
|---|---|---|
| Bond Type | Dropdown | Medicare DMEPOS, Medicaid, Contract Performance, License/Permit, Other |
| Bond Amount Required | Numeric | |
| Obligee | Single Line | |
| Credit Score Range | Dropdown | 720+, 680–719, 640–679, <640 |

### Lifecycle / CRM State
| Field Name | Type | Picklist |
|---|---|---|
| Lead Source | Dropdown | Website Form, Social IG, Social FB, Social LI, Social TT, Referral, Networking Event, Business Card, Google, ChatGPT/LLM, Direct Call, Other |
| Lead Source Detail | Single Line | (e.g., event name, referrer's name) |
| Assigned Producer | User | For future multi-agent setup; default = Sabrina |
| Marketing Opt-In (Email) | Checkbox | Required before any bulk email |
| Marketing Opt-In (SMS) | Checkbox | Required before any bulk SMS |
| Unsubscribe Reason | Dropdown | Not Interested, Too Frequent, Bought Elsewhere, Other |
| Compliance Class | Dropdown | Standard (5-yr), Medicare/Medicaid (10-yr) |

### Sync / System
| Field Name | Type | Notes |
|---|---|---|
| Easy Links Contact ID | Single Line | populated by sync |
| Last Synced to Easy Links | Date/Time | |
| ProWriters Submission Date | Date | manual |
| Carrier Referral Link Sent | Date/Time | |
| Business Card Scan Source | Single Line | event/source tag |

## Opportunity Custom Fields (per pipeline)

| Field | Type | Used In |
|---|---|---|
| Quote Amount | Numeric | Cyber, Pro-Liab, Surety |
| Quote PDF | File | Cyber, Pro-Liab |
| Carrier | Dropdown | all |
| Quote Expires | Date | all |
| Bind Date | Date | all |
| Bound Premium | Numeric | all |
| Commission % | Numeric | all |
| Policy Number | Single Line | all |
| Policy Effective Date | Date | all |
| Policy Expiration | Date | all (drives renewal workflow) |
| Decline Reason | Dropdown | Price, Coverage, Timing, Competitor, No Response, Other |
