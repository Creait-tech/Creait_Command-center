# 5 Forms to Build — Paste-Ready Specs

**Why:** Forms are the funnel mouths. Each one captures a different revenue lane. Build all 5 in Sites → Forms.

**Build time:** ~10 min per form × 5 = 50 min. One sitting.

**Date:** 2026-05-25 · updated 2026-05-26

> ## ✅ ALL CUSTOM FIELDS ARE LIVE
>
> As of 2026-05-26, **every custom field referenced below is already created in CreateOS** (70 total custom fields, +25 created in batch). You can walk straight into the form builder and pick fields from the dropdown — no need to create any new ones first.
>
> Status verified by `bash scripts/agn-health.sh` → "Custom fields: 70" → matches form requirements 100%.
>
> Also created 6 location-level **Custom Values** for the broadcast email templates: `drop_name`, `holiday_name`, `discount`, `discount_code`, `sale_end_date`, `years`. Edit them per campaign at: Settings → Custom Values & Templates → Values tab.

---

## FORM 1 — Sponsorship Inquiry

**Embed on:** dedicated `/sponsor` page on website + linked from social bio + linked from comment auto-DMs

### Fields

| Field | Type | Required | Custom Field Key |
|---|---|---|---|
| First Name | Text | ✅ | (standard) |
| Last Name | Text | ✅ | (standard) |
| Business Name | Text | ✅ | `business_name` (create new) |
| Email | Email | ✅ | (standard) |
| Phone | Phone | ❌ | (standard) |
| Brand Vertical | Dropdown | ❌ | `brand_vertical` (create new) — options: Liquor / Cannabis / Lifestyle / Tech / Restaurant / Other |
| Products to Sponsor | Multi-select | ✅ | `products_to_sponsor` (create new) — Liquor Store / Smoking Section / Sex Store / Live events / All |
| Budget Range | Dropdown | ✅ | `budget_range` (create new) — <$1K / $1K-5K / $5K-15K / $15K-50K / $50K+ |
| Timeline | Dropdown | ❌ | `timeline` (create new) — ASAP / 30-60d / Q3 2026 / Q4 2026 / Exploring |
| Message | Textarea | ❌ | (standard) |

### Settings
- On submit, add tags: `sponsor-lead`, `source-sponsor-inquiry`
- On submit, create opportunity in pipeline: `Sponsorship & B2B` → stage `Lead`
- Opportunity name: `{{contact.first_name}} {{contact.last_name}} — {{custom_values.business_name}}`
- Confirmation message: "Bet — we got your inquiry. Thomas or AGN will pull up within 24 hours. — AGN"

### Triggers workflow: `Sponsor Pipeline B2B`

---

## FORM 2 — Event Registration General

**Embed on:** `/events` page + each event's individual landing page

### Fields

| Field | Type | Required | Custom Field Key |
|---|---|---|---|
| First Name | Text | ✅ | (standard) |
| Last Name | Text | ✅ | (standard) |
| Email | Email | ✅ | (standard) |
| Phone | Phone | ✅ | (standard) — needed for day-of SMS |
| SMS Opt-In | Checkbox | ✅ | (TCPA compliance — must be checked) |
| Event Selection | Hidden | ✅ | `event_name` (set per landing page) |
| Event Date | Hidden | ✅ | `event_date` (set per landing page) |
| Headcount | Dropdown | ❌ | "Just me / +1 / +2-3 / Bringing a crew (4+)" |
| How'd you hear about us? | Dropdown | ❌ | "Friend / IG / TikTok / Already a buyer / Other" |
| Anything we should know? | Textarea | ❌ | dietary, accessibility, etc. |

### Settings
- On submit, add tags: `source-event`, `event-attendee`, `event-{{slugify(event_name)}}`
- On submit, create opportunity in pipeline: `Event Attendees` → stage `Registered`
- Confirmation message: "Locked in 🎲 We'll text you the day before with the address. Pull up."

### Triggers workflow: `Event Registration General`

---

## FORM 3 — Wholesale Inquiry

**Embed on:** dedicated `/wholesale` page + linked from comment auto-DM (keyword WHOLESALE)

### Fields

| Field | Type | Required | Custom Field Key |
|---|---|---|---|
| First Name | Text | ✅ | (standard) |
| Last Name | Text | ✅ | (standard) |
| Business Name | Text | ✅ | `business_name` |
| Business Type | Dropdown | ✅ | `business_type` (create new) — Liquor store / Specialty retail / Online / Distributor / Bar/Restaurant / Other |
| Email | Email | ✅ | (standard) |
| Phone | Phone | ✅ | (standard) |
| Shipping City + State | Text | ✅ | `shipping_city_state` (create new) |
| Quantity Target | Dropdown | ✅ | `qty_target` (create new) — 12-24 units / 25-49 / 50-99 / 100+ / Just exploring |
| Re-order frequency | Dropdown | ❌ | `reorder_freq` (create new) — Monthly / Quarterly / One-time |
| Tax-Exempt? | Checkbox | ❌ | If yes, ask for resale cert in follow-up |

### Settings
- On submit, add tags: `wholesale-lead`, `source-wholesale-inquiry`
- On submit, fire email template `Wholesale Response` (already branded)
- Confirmation message: "Bet — quote heading your way within 24h. — AGN"

### Triggers workflow: build "Wholesale Inquiry" workflow with internal email to Thomas + branded template send + 7-day follow-up

---

## FORM 4 — Newsletter Signup (Lead Magnet)

**Embed on:** website footer + exit-intent popup + dedicated `/free` page

### Lead Magnet to offer
"3 free AGN-style drinking game card PDFs" — instant download after signup.

### Fields

| Field | Type | Required |
|---|---|---|
| First Name | Text | ✅ |
| Email | Email | ✅ |
| Phone | Phone | ❌ (with SMS opt-in checkbox below) |
| SMS Opt-In | Checkbox | ❌ |

### Settings
- On submit, add tags: `subscriber`, `source-newsletter`, `lead-magnet-3-free-cards`
- On submit, redirect to `/thank-you-3-free-cards` page with download links to 3 PDFs
- Send email: `Welcome Email` (already branded) with download links inline

### Triggers workflow: build "Newsletter Welcome" — 5-email nurture over 14 days ending in 15% off code

---

## FORM 5 — Creator / UGC Collab Inquiry

**Embed on:** dedicated `/creators` page + linked from comment auto-DM (keyword CREATOR)

### Fields

| Field | Type | Required |
|---|---|---|
| First Name | Text | ✅ |
| Last Name | Text | ✅ |
| Email | Email | ✅ |
| Instagram Handle | Text | ✅ |
| TikTok Handle | Text | ❌ |
| Combined Follower Count | Dropdown | ✅ — <5K / 5K-25K / 25K-100K / 100K-500K / 500K+ |
| Avg views per post | Dropdown | ❌ — <1K / 1K-10K / 10K-100K / 100K+ |
| Why AGN? | Textarea | ✅ — gut check that they're a fit |
| Rate Card | URL or text | ❌ — if they have a rate card |

### Settings
- On submit, add tags: `creator-lead`, `source-creator-inquiry`
- On submit, internal email to Thomas
- Confirmation message: "Got it — Thomas reviews these every Friday. If we're a fit you'll hear back within a week."

### Triggers workflow: build "Creator Review Pipeline" — internal email + 7-day Thomas review window + auto-tag `creator-reviewed`

---

## After all 5 forms are built

1. Embed each on the appropriate website page (use the embed code or hosted link)
2. Test each form with a real submission (use your own info, tag yourself `test-submission` to clean up later)
3. Confirm tags fire + workflow enrollment count goes up by 1
4. Delete test submissions

---

## What this unlocks

Each form is a **revenue lane mouth**. Before these existed, the only way someone could buy was Shopify checkout. With these:

- **Sponsorship Inquiry** → unlocks $2K-$15K/qtr B2B deals
- **Event Reg General** → reusable for every event (Russell Center July 3, Luma, future)
- **Wholesale Inquiry** → opens retail/store distribution
- **Newsletter Signup** → top-of-funnel that feeds all the email automation
- **Creator Inquiry** → builds the UGC / influencer pipeline

---

**Author:** Maurice / CREAIT
**Date:** 2026-05-25
