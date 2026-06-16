# Forms Manual Build Guide

**Why manual:** The GHL API endpoint `POST /forms/` returns:
> `401 — This route is not yet supported by the IAM Service. Please update your IAM config.`

This is a platform-wide limitation, not a scope issue. Forms must be built in the UI. Spec source of truth is [`/config/forms.json`](../config/forms.json).

---

## Build path
**CreateOS UI → Sites → Forms → + Create Form**

For each form below, use the **Form Builder**, set the name, drag in the fields (standard or custom — custom fields IDs already exist), and configure submit-side actions.

After each form is created in UI, take its **form ID** (in URL: `…/forms/builder/{formId}`) and add it to [`/logs/forms-created.json`](../logs/forms-created.json) under the matching `id_placeholder` (`form_1` … `form_6`).

---

## Form 1 — Game Night Service Booking

| Setting | Value |
|--------|------|
| Name | Game Night Service Booking |
| Submit button | "Book My Game Night" |
| Success message | 🎲 You're booked! Check your email for confirmation and next steps. |
| Redirect URL | `/booking-confirmed` |
| Internal notification email | adultgamenights@gmail.com |

**Fields (in order):**
1. First Name (standard, required)
2. Last Name (standard, required)
3. Email (standard, required)
4. Phone (standard, required)
5. Event Date (custom, DATE, required)
6. Event Address (custom, LARGE_TEXT, required)
7. Event Zip (custom, TEXT, required)
8. Package Selection (custom, dropdown, required) — options: Drop-Off Only ($199), Drop-Off + Host ($299), Premium Full Event ($499+), Backyard Package
9. Event Type (custom, dropdown, required)
10. Headcount (custom, NUMERICAL, required)
11. Special Requests (custom, LARGE_TEXT, optional)

**Submit actions:**
- Add tags: `source-game-night-booking`, `service-booker`
- Create opportunity in **Game Night Service** pipeline → **Inquiry** stage
- Notify adultgamenights@gmail.com
- Trigger workflow: `Game Night Service Booking → Quote` (built in Phase 4)

---

## Form 2 — Sponsorship Inquiry

| Setting | Value |
|--------|------|
| Name | Sponsorship Inquiry |
| Submit button | "Submit Sponsorship Interest" |
| Success message | Thanks! Thomas will reach out within 24 hours. |
| Internal notification email | adultgamenights@gmail.com |

**Fields:**
1. Business Name (custom, TEXT, required)
2. First Name (standard, required)
3. Last Name (standard, required)
4. Email (standard, required)
5. Phone (standard, required)
6. Products to Sponsor (custom, LARGE_TEXT, required)
7. Business Website (custom, TEXT)
8. Instagram Handle (custom, TEXT)
9. Other Socials (custom, LARGE_TEXT)

**Submit actions:**
- Tags: `source-sponsor-inquiry`, `sponsor-lead`
- Pipeline: **Sponsorship/B2B → Lead**
- Trigger workflow: `Sponsor Lead Nurture` (Phase 4)

---

## Form 3 — Event Registration

| Setting | Value |
|--------|------|
| Name | Event Registration |
| Submit button | "Register Me" |
| Success message | 🎉 You're on the list! See you there. |

**Fields:**
1. First Name, Last Name, Email, Phone (standard, all required)
2. How Heard (custom, dropdown, required)
3. Event Selection (custom, dropdown, required) — options: Russell Center July 3, Other (TBD)

**Submit actions:**
- Tag: `source-event`
- Pipeline: **Event Attendees → Registered**
- Trigger workflow: `Event Reminder Sequence` (Phase 4)

---

## Form 4 — Wholesale Inquiry

| Setting | Value |
|--------|------|
| Name | Wholesale Inquiry |
| Submit button | "Submit Wholesale Request" |
| Success message | We'll get back to you within 48 hours with B2B pricing. |
| Internal notification email | adultgamenights@gmail.com |

**Fields:**
1. Business Name (custom, required)
2. First/Last Name, Email, Phone (standard, required)
3. Quantity Needed (custom, NUMERICAL, required)
4. Ship Date (custom, DATE)
5. Business Location (custom, TEXT)
6. Additional Info (custom, LARGE_TEXT)

**Submit actions:**
- Tag: `wholesale-inquiry`
- Internal notify
- Trigger workflow: `Wholesale Response` (Phase 4)

---

## Form 5 — Affiliate Creator Application

| Setting | Value |
|--------|------|
| Name | Affiliate Creator Application |
| Submit button | "Apply to Join" |
| Success message | Application received! We'll review and respond within 5 business days. |

**Fields:**
1. First/Last Name, Email, Phone (standard, required)
2. Primary Platform (custom, dropdown, required)
3. Social Handle (custom, TEXT, required)
4. Follower Count (custom, dropdown, required) — options: <1K, 1K-10K, 10K-50K, 50K-100K, 100K+
5. Why Good Fit (custom, LARGE_TEXT, required)

**Submit actions:**
- Tag: `affiliate-applicant`
- Trigger workflow: `Affiliate Application Review` (Phase 4)

---

## Form 6 — 3D Print Custom Order

| Setting | Value |
|--------|------|
| Name | 3D Print Custom Order |
| Submit button | "Request Custom Order" |
| Success message | 🎨 Thanks! We'll send a quote within 24 hours. |
| Internal notification email | adultgamenights@gmail.com |

**Fields:**
1. First/Last Name, Email, Phone (standard, required)
2. **Logo Upload (FILE_UPLOAD component)** — when building in UI, use a native file-upload field. The custom field "Logo Upload URL" stores the resulting URL. (Optional)
3. Product Type (custom, dropdown, required)
4. Quantity (custom, NUMERICAL, required)
5. Color Preference (custom, dropdown, required)
6. Special Instructions (custom, LARGE_TEXT, optional)

**Submit actions:**
- Tag: `source-3d-print-inquiry`
- Internal notify
- Trigger workflow: `3D Print Quote Flow` (Phase 4)

---

## Custom Field IDs (cross-reference)

| Custom Field | Field ID |
|--------------|----------|
| Event Date | `8PRbj0wHXbyRKOvmLfv5` |
| Event Address | `rMT3JnGWowlRloDcQX2V` |
| Event Zip | `sdcEpsDLntpDIWiXyOlJ` |
| Package Selection | `mPi74gbYg151s4Wem5jF` |
| Event Type | `9xcuo49mnWpYZgSkKjPW` |
| Headcount | `I0sBE4XGmS1xCuyVBrZy` |
| Special Requests | `BsR42xPM9ouXfPTN3RZ1` |
| Business Name | `imzap2kIaFlzQBXGBM7R` |
| Products to Sponsor | `7oNceHdb0iqNN8y8L7am` |
| Business Website | `dINMvMVcVTuwbNLAa5Nr` |
| Instagram Handle | `vB7GIpUREt1pcfUxuWoY` |
| Other Socials | `59hStftKW7dwyd49QG9W` |
| How Heard | `YGP6xb8DQEcCSJ5a3nH4` |
| Event Selection | `I51hgjgos72Q22kePOvL` |
| Quantity Needed | `dk87hPG2IowFlwzJpTZe` |
| Ship Date | `vkIf7Ev5T0QlxgnQKyYz` |
| Business Location | `NDpPZkM5b4lzkDKCGtiv` |
| Additional Info | `AEV38LpMTOAAtT6OWQwx` |
| Primary Platform | `vE5e5AYnYK1II3Pqx4v6` |
| Social Handle | `H8HJeyTGcIXEkQDlwRWr` |
| Follower Count | `ICFyQ7VetzrkzVxqGD6G` |
| Why Good Fit | `kcbemJj4v47mdQkEbJDe` |
| Logo Upload URL | `NsTKeeuRAnpdfzmzFQYz` |
| Product Type | `KcujtRWSim6BeMCJ80BX` |
| Quantity | `nIDOwYm9795ciOWoX9rN` |
| Color Preference | `XadttxHDw7smgdGAEYjb` |
| Special Instructions | `zZbprEtaR1WUUuSVVKOr` |

---

## After UI build: capture form IDs

Once forms exist, run:

```bash
node scripts/06-fetch-form-ids.js
```

This pulls all forms via `GET /forms/` and writes the IDs to `/logs/forms-created.json` keyed by name. Phase 4 workflows will reference these IDs.
