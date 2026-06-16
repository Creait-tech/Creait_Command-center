# Sponsor Pipeline B2B — Complete Build Spec

**Status:** Spec ready — pipeline + form + workflow all need manual build (~25 min)
**Why this matters:** "Adult Game Nights Live" sponsor contract is the biggest B2B revenue line; Maurice sold "founder rates locked through Q3"
**Date:** 2026-05-25

---

## Build order (do in sequence)

1. Pipeline (5 min) → 2. Form (10 min) → 3. Workflow (10 min)

---

## STEP 1 — Build the "Sponsorship & B2B" pipeline

**Why API didn't auto-create:** the `/opportunities/pipelines` POST endpoint requires elevated scope not on the current PIT. Manual build is fast.

### Steps
1. CreateOS → **Opportunities** → **Pipelines** (top-right tab)
2. Click **Create Pipeline**
3. Name: `Sponsorship & B2B`
4. Stages (in order):

| Position | Stage Name | Notes |
|---|---|---|
| 1 | Lead | New form submission lands here |
| 2 | Pitched | After Thomas sends the Sponsor Pitch email |
| 3 | Negotiating | After their first reply |
| 4 | Signed | When the contract is signed |

5. Save → confirm the pipeline appears in the Opportunities list

---

## STEP 2 — Build the "Sponsorship Inquiry" form

### Steps
1. **Sites** → **Forms** → **+ Create New Form**
2. Name: `Sponsorship Inquiry`
3. Add these fields (in order):

| Field | Type | Required | Placeholder/Options |
|---|---|---|---|
| First Name | Text | ✅ | "First name" |
| Last Name | Text | ✅ | "Last name" |
| Business Name | Text (custom field: `business_name`) | ✅ | "Your brand / company" |
| Email | Email | ✅ | "you@brand.com" |
| Phone | Phone | ❌ | "(404) 555-0100" |
| Products to Sponsor | Multi-select dropdown (custom field: `products_to_sponsor`) | ✅ | Options: "Liquor Store game", "Smoking Section", "Sex Store", "Live events", "All of the above" |
| Budget Range | Dropdown (custom field: `budget_range`) | ✅ | Options: "<$1K", "$1K-5K", "$5K-15K", "$15K-50K", "$50K+" |
| Timeline | Dropdown (custom field: `timeline`) | ❌ | "ASAP / This month", "Next 30-60 days", "Q3 2026", "Q4 2026", "Just exploring" |
| Message | Textarea | ❌ | "Anything else we should know?" |

### Form settings (Settings tab on form builder)

- **On submit, add tags:** `sponsor-lead` + `source-sponsor-inquiry`
- **On submit, create opportunity in:** Pipeline `Sponsorship & B2B`, Stage `Lead`
- **Opportunity name:** `{{contact.first_name}} {{contact.last_name}} — {{custom_values.business_name}}`
- **Confirmation message:** "Bet — we got your inquiry. Thomas or someone from AGN will pull up within 24 hours. — AGN"

### Then embed on adultgamenights.com
Add the form embed code to a `/sponsor` or `/partner` page (or just to the footer of the homepage). The form's hosted URL also works as a direct link in DMs.

---

## STEP 3 — Build the Sponsor Pipeline B2B workflow

### Via AI Builder (Workflows → Build using AI)

```
Workflow name: Sponsor Pipeline B2B. Trigger: form submitted, form is "Sponsorship Inquiry". Step 1: Send Internal Email Notification to adultgamenights@gmail.com with subject "🎯 NEW SPONSOR INQUIRY — {{custom_values.business_name}}" and body: "New sponsor inquiry from {{contact.first_name}} {{contact.last_name}} ({{contact.email}} / {{contact.phone}}). Business: {{custom_values.business_name}}. Products to sponsor: {{custom_values.products_to_sponsor}}. Budget range: {{custom_values.budget_range}}. Timeline: {{custom_values.timeline}}. Message: {{custom_values.message}}. Reply within 24h." Step 2: Send Internal Notification to phone number +14049542115 with text: "🎯 SPONSOR LEAD: {{contact.first_name}} from {{custom_values.business_name}}. Budget {{custom_values.budget_range}}. Check email." Step 3: Send the contact the email template named "Sponsor Pitch". Step 4: Wait 7 days. Step 5: End workflow. Stop conditions: tag 'sponsor-engaged' OR tag 'signed-sponsor' OR tag 'unsubscribed'. Do NOT include any if/else branches. Keep flat and linear.
```

### After AI Builder finishes — manual verification (~3 min)

1. Click the **Send Internal Email Notification** node → verify "To" field = `adultgamenights@gmail.com` (not the contact)
2. Click the **Send Internal Notification (SMS)** node → verify:
   - Type = SMS
   - To User Type = Custom Number
   - To Custom Number = `+14049542115`
3. Click the **Send Email** node → verify it's bound to the `Sponsor Pitch` template (not Quick Compose)
4. If "Sponsor Pitch" template is still a scaffold: paste branded HTML from `docs/EMAIL-TEMPLATES-HTML-9.md` first, then re-link in workflow
5. Test send: submit a test entry via the form → check both Thomas's email + phone get notified → check the contact got the Sponsor Pitch
6. Flip Draft → Publish

### Sprint 2 extension (not in MVP)

Add follow-up emails at days 7 and 14 if no `sponsor-engaged` tag. Build via + button after the AI Builder version is published — keeps the MVP linear and avoids AI Builder branching hallucinations.

---

## Manual fallback if AI Builder breaks

Build node-by-node:
1. Drag Form Submitted trigger → select Sponsorship Inquiry
2. + → Internal Notifications → Email Internal → fill in adultgamenights@gmail.com + subject + body
3. + → Internal Notifications → SMS Internal → Custom Number → +14049542115
4. + → Email → Existing Template → Sponsor Pitch
5. + → Wait → 7 days
6. + → End
7. Set Stop Conditions in workflow Settings

Takes ~10 min manually. More reliable than the AI Builder for the conditional Internal Notification action type.

---

## Tags to verify already exist (per audit)

- `sponsor-lead` ✅
- `source-sponsor-inquiry` ✅
- `sponsor-engaged` (added manually by Thomas when prospect replies)
- `signed-sponsor` (added manually by Thomas when contract is signed)
- `lapsed-sponsor` (set by Sprint 2 follow-up workflow after 14 days no response)

If any don't exist: Settings → Tags → Add Tag.

---

## What ROI to expect

Per the original CREAIT sales conversation:
- Founder-rate sponsors are typically **$2-15K per quarter**
- Even 1 signed deal in a quarter = 3-6x the entire CREAIT monthly fee
- Pipeline visibility (which lead is at which stage) is the #1 thing Thomas needed before this — used to lose track in DMs

---

**Date:** 2026-05-25
**Author:** Maurice / CREAIT
