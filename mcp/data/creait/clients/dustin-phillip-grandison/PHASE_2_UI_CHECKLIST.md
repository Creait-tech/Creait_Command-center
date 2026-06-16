# Phase 2 — UI Checklist (Dustin's Bespoke)

**Status after API build:** Phase 1A/1B/1C/1E are complete via API (Custom Values, Custom Fields, Tags, Calendars). Three Phase-1/2 items need UI work: **pipeline** (PIT scope-blocked), **forms** (no v2 API), **templates** (no v2 API + scope-blocked for SMS snippets).

Reference package files while working: `07_MESSAGING_TEMPLATES.md`, `08_EMAIL_SEQUENCES.md`, `11_INTERNAL_NOTIFICATIONS.md`.

Execute this checklist in order. Estimated time: **90–120 min**.

---

## 2.0 — Pipeline (was Phase 1D, moved here because PIT lacks `opportunities.write`)

**GHL Path:** Opportunities → Pipelines → **+ Create New Pipeline**

- [ ] Name: `Bespoke Client Journey`
- [ ] Enable **"Allow Multiple Opportunities Per Contact"** (critical for repeat clients)
- [ ] Create 12 stages in this exact order:

| Pos | Stage name | Default opp value |
|---|---|---|
| 0 | New Lead | $0 |
| 1 | Contacted | $0 |
| 2 | Consultation Booked | $0 |
| 3 | Consultation Completed | $3,500 |
| 4 | Fabric & Design Selected | $3,500 |
| 5 | Deposit Paid | $1,750 |
| 6 | In Production | $1,750 |
| 7 | Fitting Scheduled | $1,750 |
| 8 | Final Fitting | $1,750 |
| 9 | Delivered | $3,500 |
| 10 | Post-Delivery Follow-Up | $3,500 |
| 11 | VIP Client / Repeat | $3,500 |

- [ ] Show in Funnel: ON
- [ ] Show in Pie Chart: ON
- [ ] Save. Write the pipeline ID into `build-output/BUILD_LOG.md` "Manual additions" section.

**Alternative (faster):** Regenerate the PIT with `opportunities.write` scope and re-run `python3 build-output/phase1d_pipeline.py` — it's idempotent.

---

## 2.1 — Cleanup: existing snapshot workflows

The audit found **6 pre-existing workflows** from the snapshot that conflict with the new WF1–WF13 naming:

1. `1. New Lead Nurture (Fast 5) - Claim Offer`
2. `2. Appointment Confirmation + Reminders`
3. `3. Appt No Show`
4. `4. New Sale - Send Review Request`
5. `5. Long-Term Nurture`
6. (one more — review in UI)

**GHL Path:** Automation → Workflows

- [ ] Review each. Either **Archive** (recommended — keeps history) or **Rename** with prefix `_OLD_` so they don't collide with the new WF1–WF13.
- [ ] Do NOT delete until Phase 3 QA is complete and new workflows are live.

Also audited: **8 pre-existing calendars** from snapshot (Boutique Shopping Experience, The Manor Consultation, Custom Tailoring & Alterations, etc.). None conflict with our 2 new ones (`Private Style Consultation`, `Fitting Appointment`). Leave or archive per Dustin's preference — not blocking.

---

## 2.2 — Forms (2)

**GHL Path:** Sites → Forms → **+ Create Form**

### Form A — `Bespoke Inquiry` (primary lead capture)

Full spec in `06_FORMS.md` §Form 1. Quick build:

- [ ] Name: `Bespoke Inquiry`
- [ ] Submit button text: `Begin the conversation`
- [ ] Style: Standard, single column, generous spacing, no progress bar
- [ ] Add these fields **in this order**, mapping each to the corresponding custom field (the field picker will show "Bespoke Order Details" / contact.* fields):

| # | Label | Type | Required | Map to |
|---|---|---|---|---|
| 1 | First Name | Text | ✓ | `contact.first_name` |
| 2 | Last Name | Text | ✓ | `contact.last_name` |
| 3 | Email | Email | ✓ | `contact.email` |
| 4 | Phone | Phone | ✓ | `contact.phone` |
| 5 | What's the occasion? | Single Options | ✓ | `contact.occasion` |
| 6 | Event or target date (optional) | Date | — | `contact.event_date` |
| 7 | What's your budget range? | Single Options | ✓ | `contact.budget_range` |
| 8 | Custom or bespoke? | Single Options | — | `contact.suit_type_interest` (default "Not sure yet") |
| 9 | How should we reach you? | Single Options | ✓ | `contact.preferred_communication` |
| 10 | Have you commissioned bespoke before? | Single Options | — | `contact.experience_level` |
| 11 | Anything else you'd like to share? | Textarea | — | Contact note |

- [ ] Confirmation message (copy verbatim from `06_FORMS.md` §Form 1 confirmation). Replace `[LOOKBOOK LINK]` with `{{custom_values.lookbook_url}}`.
- [ ] **On-submit actions:** (a) Fire workflow WF1 on submit (wire this in Phase 3 when WF1 exists), (b) Add tag `Source: Website` (until UTM-based logic is added).
- [ ] Test-submit with your own email — verify the contact appears in CRM with all custom fields populated.

### Form B — `Refer a Friend`

Full spec in `06_FORMS.md` §Form 4.

- [ ] Name: `Refer a Friend`, URL slug: `refer`
- [ ] Submit action: Create a **new contact** tagged `Source: Referral` + `New Lead`, populate custom field `referred_by` = referrer's name, fire WF1.
- [ ] Fields:

| # | Label | Type | Required |
|---|---|---|---|
| 1 | Your name | Text | ✓ |
| 2 | Your friend's first name | Text | ✓ |
| 3 | Your friend's phone or email | Text | ✓ |
| 4 | What's the occasion? | Single Options | — |
| 5 | Anything we should know about them? | Textarea | — |

- [ ] Confirmation: copy verbatim from `06_FORMS.md` §Form 4.

Forms 3 & 4 (Post-Consultation Feedback, Post-Delivery Satisfaction) are in **Phase 4**.

---

## 2.3 — Template folders (5)

**GHL Path:** Marketing → Templates → **+ New Folder**

- [ ] `Welcome`
- [ ] `Appointments`
- [ ] `Payments`
- [ ] `Follow-Up`
- [ ] `Retention`

---

## 2.4 — SMS + Email templates (22 total)

Naming convention: `[Folder] [Number] — [Short name]`. Paste copy **verbatim** from `07_MESSAGING_TEMPLATES.md` and `08_EMAIL_SEQUENCES.md` — copy is intentional.

### Welcome folder (4)

- [ ] SMS — `Welcome 1.1 — Welcome SMS` (file 07 §T1.1)
- [ ] Email — `Welcome 1.2 — Welcome Email` — Subject: `A note from Dustin` (file 07 §T1.2)
- [ ] SMS — `Welcome 1.3 — No-Reply Check-In SMS` (file 07 §T1.3)
- [ ] SMS — `Welcome 1.4 — AI Handoff SMS` (file 07 §T1.4)

### Appointments folder (6)

- [ ] SMS — `Appointments 2.1 — Consult Confirmation SMS` (file 07 §T2.1)
- [ ] Email — `Appointments 2.2 — Consult Confirmation Email` — Subject: `Your consultation is confirmed, {{contact.first_name}}` (file 07 §T2.2)
- [ ] SMS — `Appointments 2.3 — 24-Hour Reminder SMS` (file 07 §T2.3)
- [ ] SMS — `Appointments 2.4 — 2-Hour Reminder SMS` (file 07 §T2.4)
- [ ] SMS — `Appointments 2.5 — No-Show SMS` (file 07 §T2.5)
- [ ] SMS — `Appointments 2.6 — Fitting Confirmation SMS` (file 07 §T2.6)

### Payments folder (4)

- [ ] SMS — `Payments 3.1 — Deposit Request SMS` (file 07 §T3.1)
- [ ] SMS — `Payments 3.2 — Deposit Received SMS` (file 07 §T3.2)
- [ ] SMS — `Payments 3.3 — Final Balance SMS` (file 07 §T3.3)
- [ ] SMS — `Payments 3.4 — Final Balance Received SMS` (file 07 §T3.4)

### Follow-Up folder (5)

- [ ] SMS — `Follow-Up 4.1 — Post-Consult Thank You SMS` (file 07 §T4.1)
- [ ] Email — `Follow-Up 4.2 — Post-Consult Next Steps Email` — Subject: `The fabrics we discussed + next steps` (file 07 §T4.2). **Note:** Leave the `[fabric recommendations]` placeholder section — WF4 task #8 tells Dustin to personalize before it sends.
- [ ] SMS — `Follow-Up 4.3 — Fabric Follow-Up SMS` (file 07 §T4.3)
- [ ] Email — `Follow-Up 4.4 — What Bespoke Actually Means` — Subject: `What bespoke actually means` (file 07 §T4.4)
- [ ] SMS — `Follow-Up 4.5 — Re-Engagement SMS` (file 07 §T4.5)

### Retention folder (4)

- [ ] SMS — `Retention 5.1 — Post-Delivery Check-In SMS` (file 07 §T5.1)
- [ ] Email — `Retention 5.2 — Testimonial Request Email` — Subject: `A favor, if you're willing` (file 07 §T5.2)
- [ ] Email — `Retention 5.3 — Referral Invitation Email` — Subject: `One ask` (file 07 §T5.3)
- [ ] SMS — `Retention 5.4 — Birthday SMS` (file 07 §T5.4)

Template check (22 = 15 SMS + 7 email):
- Welcome: 3 SMS + 1 email
- Appointments: 5 SMS + 1 email
- Payments: 4 SMS
- Follow-Up: 3 SMS + 2 emails
- Retention: 2 SMS + 2 emails

---

## 2.5 — Email sequence templates (14 emails across 3 sequences)

These live inside the **Email Builder** so workflows can reference them. Copy from `08_EMAIL_SEQUENCES.md`. You can build these here OR inline them directly in the WF4/WF8/WF10 workflow email-send steps — both work in GHL. Recommend building in Email Builder for reusability.

**Sequence A — Welcome Nurture (used in WF8):** 7 emails

- [ ] `Nurture A1 — Why I Do This` — Day 0 — Subject: `Why I do this`
- [ ] `Nurture A2 — The Process` — Day 3 — Subject: `What actually happens when you commission a suit`
- [ ] `Nurture A3 — Fabric Education` — Day 6 — Subject: `A short guide to fabric`
- [ ] `Nurture A4 — The Comparison` — Day 10 — Subject: `Off-the-rack, made-to-measure, bespoke — clarified`
- [ ] `Nurture A5 — Style Rules` — Day 14 — Subject: `Five style rules I stand behind`
- [ ] `Nurture A6 — Testimonials` — Day 18 — Subject: `What clients have said` (leave dynamic block for Dustin to populate)
- [ ] `Nurture A7 — Behind the Craft` — Day 22 — Subject: `A day in the studio`

**Sequence B — Post-Consult Conversion (used in WF4):** 2 additional emails (B1 is reused from Follow-Up 4.2)

- [ ] `Nurture B2 — Fabric Follow-Up Email` — Day 3 — Subject: `The fabric decision, whenever you're ready`
- [ ] `Nurture B3 — Gentle Close Email` — Day 7 — Subject: `One more thought`

**Sequence C — Post-Delivery Retention (used in WF10):** 5 pieces (C1/C2/C4 already templated above; C3 SMS + C5 email new)

- [ ] SMS — `Retention 5.5 — Day 8 Photo Request SMS` (file 08 §C3) — add to Retention folder
- [ ] Email — `Retention 5.6 — Wardrobe Continuation` — Day 30 — Subject: `What comes next for your wardrobe` (file 08 §C5)

Total new here: **2 SMS + 7 emails + 2 emails = 9 sequence pieces** plus the 22 base templates = **31 template pieces** in GHL when done.

---

## 2.6 — Internal Notifications (pre-wire now, will be attached in Phase 3 workflows)

**GHL Path:** Settings → Notifications

You cannot create "notification templates" in GHL — internal notifications are actions added inside each workflow. So this step is just **preparation**:

- [ ] **Confirm Dustin's contact settings for in-app + SMS notifications:** Settings → My Profile → Notifications. Turn on SMS for high-urgency events.
- [ ] **Add Dustin's assistant as a user** (Settings → My Staff → Add Employee) — role: User, not Admin. Capture the assistant's user ID.
- [ ] **Update custom value `assistant_name`** from `REPLACE_ME` to the assistant's first name (Settings → Custom Values).
- [ ] **Configure DND (Do Not Disturb) windows** on Dustin's notification prefs for blocks when he's in booked consultations.
- [ ] **Plan notification delivery per file 11:** 11 notifications, channel matrix documented. Workflow build steps in Phase 3 will each include an "Internal Notification" action that points to Dustin (SMS+in-app) and the assistant (in-app only) per the §11 routing table.

---

## 2.7 — Settings items NOT covered by API (flag for Dustin + manual ops)

These are Phase 1 Day 1 items the runbook lists but that require OAuth/DNS/regulatory paperwork — not API:

- [ ] **Business Profile:** Settings → Business Profile. Current name is `Dustin Smith` — change to `Dustin's Bespoke`. Verify address/phone/timezone (already `America/New_York`).
- [ ] **Business Hours:** Settings → Business Hours. Set Tue–Sat 10 AM – 6 PM (closed Sun + Mon).
- [ ] **Domain + email auth:** Add Dustin's sending domain, configure SPF, DKIM, DMARC with the registrar. 24–48h DNS propagation.
- [ ] **Phone numbers + A2P 10DLC:** Settings → Phone Numbers → A2P 10DLC. **Start Day 1** — approval takes 2–10 business days and blocks outbound SMS if not done.
- [ ] **Stripe connect:** Integrations → Stripe → Connect. Test with $1 payment.
- [ ] **SaaS subscription status:** Audit found location subscription status is `canceled`. **Verify with agency** whether this account still has full feature access (SMS, AI, etc.) before launching. If cancelled, some features may degrade.
- [ ] **Conversation AI (bot service):** Audit showed `botServiceEnabled: false` at the location level. If it stays false, the AI Concierge (Phase 4) cannot be built. Toggle it on from the agency panel before Phase 4.

---

## 2 — Gate to Phase 3

You may proceed to Phase 3 (workflows) when:
- [ ] Pipeline `Bespoke Client Journey` exists with all 12 stages
- [ ] Both forms (`Bespoke Inquiry`, `Refer a Friend`) tested with a dummy submission
- [ ] All 22 base + 9 sequence templates are in the correct folders with the naming convention
- [ ] Custom values `booking_consultation_url` and `booking_fitting_url` updated with real branded URLs (see build log)
- [ ] `assistant_name` custom value updated
- [ ] A2P 10DLC registration submitted (not necessarily approved — just submitted)
