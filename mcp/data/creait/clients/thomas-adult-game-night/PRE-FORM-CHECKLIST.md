# Pre-Form Build Checklist

**Read this. Do the 2 quick UI clicks. Then go build forms.**

**Date:** 2026-05-26

---

## ✅ Already done for you (no action needed)

| Asset | Status | Where |
|---|---|---|
| **Custom Fields** (per-contact form data) | 70 total — all 24 new ones live | Settings → Custom Fields & Values → Fields |
| **Custom Values** (broadcast template vars) | 14 total — all 6 new ones live | Settings → Custom Fields & Values → Values |
| **Tags** (form auto-tagging) | 52 total — all 8 new ones live | Settings → Tags |
| **Email templates** | 25/25 branded + correctly named | Email Marketing → Templates |
| **Pipelines: Game Sales / Service / Event** | 3 of 4 live | Opportunities → Pipelines |
| **Workflows** | 10 (4 published, 6 drafts) | Automation → Workflows |
| **Master KB FAQs** | 67 entries | AI Agents → Knowledge Base |

---

## ⏳ 2 UI clicks needed before form-building (~5 min total)

These two things blocked the API (scope-restricted endpoints). They take 5 minutes in the UI.

### Click #1 — Build the Sponsorship & B2B pipeline (3 min)

Form 1 (Sponsorship Inquiry) needs this pipeline so submissions can drop opportunities into the "Lead" stage.

**Steps:**
1. CreateOS → **Opportunities** → **Pipelines** (top-right tab)
2. Click **Create Pipeline**
3. Name: `Sponsorship & B2B`
4. Add stages in order (click + Add Stage between each):
   - `Lead`
   - `Pitched`
   - `Negotiating`
   - `Signed`
5. **Save**

That's it. You'll see the new pipeline appear in the Opportunities pipeline switcher.

### Click #2 — Paste 10 SMS snippets (15 min, optional but recommended)

These are referenced by future workflows (Sponsor B2B, Wholesale, Refer-a-Friend, etc.). **Forms themselves don't need these to be built** — you can come back to this after forms ship. Skip if you want to focus purely on forms today.

**Path:** Settings → **Custom Values & Templates** → **Templates** tab → **+ New Template** → Type: SMS

Each snippet is in `docs/SMS-SNIPPETS-10.md`. Paste name + body for each:

1. `birthday_sms`
2. `vip_welcome_sms`
3. `sponsor_internal_alert_sms`
4. `wholesale_internal_alert_sms`
5. `service_booking_internal_sms`
6. `service_reminder_7d_sms`
7. `post_service_review_sms`
8. `referral_credit_earned_sms`
9. `event_day_of_sms`
10. `win_back_sms`

**Skip for now** if you'd rather batch-do them later — none of the 5 forms need these snippets to be built.

---

## 🎯 Then: build the 5 forms

Once the pipeline is built (~3 min), every other dependency is pre-staged. Open `docs/FORMS-SPEC-5.md` and walk through the 5 forms in order:

1. **Sponsorship Inquiry** (uses new Sponsorship & B2B pipeline)
2. **Event Registration General** (uses existing Event Attendees pipeline)
3. **Wholesale Inquiry** (no pipeline — just tags + Wholesale Response email)
4. **Newsletter Signup** (no pipeline — just tags + Welcome Email)
5. **Creator UGC Inquiry** (no pipeline — just tags + internal email to you)

**Build time:** ~10 min per form × 5 = 50 min. One sitting.

When you pick fields in the form builder, all 70 fields appear in the dropdown — including the ones we just created (`brand_vertical`, `budget_range`, `timeline`, `business_type`, `quantity_target`, `tiktok_handle`, `avg_views_per_post`, etc.).

---

## After all 5 forms are built

Run the health check to confirm clean state:

```bash
cd "/Users/reecebyob/creait/Creait Clients/Thomas- Adult Game Night/adult-game-nights-build"
bash scripts/agn-health.sh
```

Target output:
- Workflows: 10 (4 published, 6 drafts)
- Email templates: Total 25
- Custom fields: Total 70
- Pipelines: Total 4
- Forms: Total 7 (2 existing + 5 new)

---

## What ships automatically once forms are live

The moment you publish each form, downstream automation activates:

- **Form 1 (Sponsor) submission** → contact tagged `sponsor-lead` + `source-sponsor-inquiry` → opportunity created in Sponsorship & B2B → Lead stage → Sponsor Pipeline B2B workflow fires (build prompt in `docs/AI-BUILDER-PROMPTS-BATCH.md` #5)
- **Form 2 (Event) submission** → tagged `source-event` + `event-attendee` → opportunity in Event Attendees → Registered stage → Event Registration General workflow fires (prompt in `docs/AI-BUILDER-PROMPTS-BATCH.md` #8)
- **Form 3 (Wholesale) submission** → tagged `wholesale-lead` + `source-wholesale-inquiry` → fires Wholesale Response email automatically
- **Form 4 (Newsletter) submission** → tagged `subscriber` + `source-newsletter` + `lead-magnet-3-free-cards` → fires Welcome Email + delivers 3 free game card PDFs (need to create + host the PDFs separately)
- **Form 5 (Creator) submission** → tagged `creator-lead` + `source-creator-inquiry` → internal email to you for review

---

## Quick wire-up notes per form

When you're in the form builder for each one, after picking the fields:

### Form 1 — Settings tab
- On submit: Add tags `sponsor-lead`, `source-sponsor-inquiry`
- Create opportunity in: **Sponsorship & B2B** (the pipeline you just built) → stage: **Lead**
- Opportunity name template: `{{contact.first_name}} {{contact.last_name}} — {{contact.business_name}}`
- Confirmation message: "Bet — we got your inquiry. Thomas or AGN will pull up within 24 hours. — AGN"

### Form 2 — Settings tab
- On submit: Add tags `source-event`, `event-attendee`
- Create opportunity in: **Event Attendees** → stage: **Registered**
- Confirmation message: "Locked in 🎲 We'll text you the day before with the address. Pull up."

### Form 3 — Settings tab
- On submit: Add tags `wholesale-lead`, `source-wholesale-inquiry`
- On submit: Send email template `Wholesale Response`
- Confirmation message: "Bet — quote heading your way within 24h. — AGN"

### Form 4 — Settings tab
- On submit: Add tags `subscriber`, `source-newsletter`, `lead-magnet-3-free-cards`
- On submit: Send email template `Welcome Email`
- Redirect to: `/thank-you-3-free-cards` (or just leave at confirmation message for now)

### Form 5 — Settings tab
- On submit: Add tags `creator-lead`, `source-creator-inquiry`
- On submit: Send Internal Email Notification → `adultgamenights@gmail.com` (subject: "🎬 Creator Inquiry — {{contact.first_name}}", body includes IG/TikTok handles + follower count)
- Confirmation message: "Got it — Thomas reviews these every Friday. If we're a fit you'll hear back within a week."

---

## TL;DR

1. Build the Sponsorship & B2B pipeline (3 min, UI)
2. Build the 5 forms in order (50 min, UI)
3. Optional: paste 10 SMS snippets (15 min, UI — can do later)

Total: ~1 hour of UI work and the entire CRM funnel is fully wired.

---

**Author:** Maurice / CREAIT
**Date:** 2026-05-26
**Status:** All API-buildable dependencies pre-staged. Only UI-only work remaining.
