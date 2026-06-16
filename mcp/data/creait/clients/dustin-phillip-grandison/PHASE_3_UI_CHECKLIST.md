# Phase 3 — UI Checklist (Dustin's Bespoke)

**Scope:** Build 13 workflows (WF1–WF13) in GHL's workflow UI. Workflows are **not API-creatable** in GHL v2 for anything beyond trivial stubs — the visual builder is required for triggers, branches, wait conditions, and field assignments.

**Reference files open on second monitor:**
- `09_WORKFLOWS.md` — workflow bible (full trigger, action, timing, copy for each WF)
- `07_MESSAGING_TEMPLATES.md` — referenced by template name
- `08_EMAIL_SEQUENCES.md` — referenced by email ID
- `11_INTERNAL_NOTIFICATIONS.md` — notification copy + channel matrix

**Global workflow settings** (apply to every workflow):
- **Build in Draft mode** — do NOT publish until ALL 13 are built and full QA pass complete.
- **Stop on Reply:** ON (unless WF explicitly says otherwise)
- **Prevent duplicate enrollment:** ON for WF1, WF4, WF5, WF7, WF8, WF10
- **SMS send window:** 10 AM – 8 PM local. Outside this window, shift to next 10 AM.
- **Workflow failure alerts:** route to Dustin's email — configure once at the account level.

---

## WF1 — New Lead Welcome & Qualification

Spec: `09_WORKFLOWS.md` §WF1.

**Builder path:** Automation → Workflows → + Create Workflow → From Scratch → name `WF1 — New Lead Welcome`.

- [ ] **Trigger A:** Contact Created (any source)
- [ ] **Trigger B:** Form Submitted — form `Bespoke Inquiry`
- [ ] (Add Trigger A *or* B — both feed this workflow)
- [ ] Settings → Stop on Reply: ON, Allow Re-entry: OFF
- [ ] Exit criteria: Tag `Deposit Paid` OR `Went Cold`

Steps in order:

1. [ ] Wait 2 minutes
2. [ ] Send SMS — template `Welcome 1.1 — Welcome SMS`
3. [ ] Send Email — template `Welcome 1.2 — Welcome Email`
4. [ ] Create Opportunity — pipeline `Bespoke Client Journey`, stage `New Lead`, value $0, name: `{{contact.full_name}} — {{contact.occasion}}`
5. [ ] Add Tag — `New Lead`
6. [ ] Add Tag conditionally — `Source: Website` (if trigger = form submit), `Source: Referral` (if `referred_by` populated), else leave for manual tagging
7. [ ] Internal Notification **#1** — SMS to Dustin + in-app to both. Copy from `11_INTERNAL_NOTIFICATIONS.md` §#1
8. [ ] Create Task — `Follow up personally with {{contact.first_name}}` — assignee Dustin — due 4 hours
9. [ ] Wait 24 hours
10. [ ] If/Else — Has Replied? **Yes** → Exit workflow; **No** → continue
11. [ ] Send SMS — template `Welcome 1.3 — No-Reply Check-In SMS`
12. [ ] Wait 24 hours
13. [ ] If/Else — Has Replied? **Yes** → Exit; **No** → continue
14. [ ] Add Tag — `Nurture Sequence` (this enrolls WF8)
15. [ ] Remove Tag — `New Lead`
16. [ ] Add Tag — `Cold`

---

## WF2 — Consultation Booking Confirmation & Reminders

Spec: `09_WORKFLOWS.md` §WF2.

- [ ] **Trigger:** Customer Booked Appointment — Calendar: `Private Style Consultation`
- [ ] Settings → Stop on Reply: **OFF** (reminders must fire), Allow Re-entry: ON (per booking)

Steps:

1. [ ] Update Opportunity — move to stage `Consultation Booked`
2. [ ] Remove Tag — `New Lead`, `Contacted`
3. [ ] Add Tag — `Ready to Book`, then `Hot`
4. [ ] Send SMS — `Appointments 2.1 — Consult Confirmation SMS`
5. [ ] Send Email — `Appointments 2.2 — Consult Confirmation Email`
6. [ ] Wait Until — 24 hours before appointment start
7. [ ] Send SMS — `Appointments 2.3 — 24-Hour Reminder SMS`
8. [ ] Wait Until — 2 hours before appointment start
9. [ ] Send SMS — `Appointments 2.4 — 2-Hour Reminder SMS`
10. [ ] Internal Notification **#2** — SMS to Dustin + in-app to both + Google Calendar invite

**Status-based branching (configure as additional workflows triggered by appointment status change on same calendar):**
- Status = Completed → ends WF2, starts WF4
- Status = No-Show → ends WF2, starts WF3

---

## WF3 — No-Show Follow-Up

Spec: `09_WORKFLOWS.md` §WF3.

- [ ] **Trigger:** Appointment Status = No-Show, Calendar: `Private Style Consultation`
- [ ] Settings → Stop on Reply: ON, Allow Re-entry: ON

Steps:

1. [ ] Add Tag — `No-Show`
2. [ ] Internal Notification **#3** — SMS to Dustin
3. [ ] Wait 30 minutes
4. [ ] Send SMS — `Appointments 2.5 — No-Show SMS`
5. [ ] Create Task — `Personal call to {{contact.first_name}}` — Dustin — due 24h
6. [ ] Wait 24 hours
7. [ ] If/Else Has Replied? Yes → Exit / No → continue
8. [ ] Send Email — inline copy:
   - Subject: `Still here when you are`
   - Body: short personal email acknowledging life happens, offer reschedule link `{{custom_values.booking_consultation_url}}`
9. [ ] Wait 48 hours
10. [ ] If/Else Has Replied? Yes → Exit / No → continue
11. [ ] Send SMS — inline: `{{contact.first_name}}, one final note — the door is open whenever you're ready. No hard feelings, ever. — Dustin`
12. [ ] Add Tag — `Went Cold`
13. [ ] Update Opportunity — move to stage `Contacted` (don't delete the opp)

---

## WF4 — Post-Consultation Follow-Up & Deposit Request

Spec: `09_WORKFLOWS.md` §WF4.

- [ ] **Trigger:** Appointment Status = Completed, Calendar: `Private Style Consultation`
- [ ] Settings → Stop on Reply: **OFF** (each touch independent), Allow Re-entry: OFF

Steps:

1. [ ] Update Opportunity — stage `Consultation Completed`, value $3,500
2. [ ] Remove Tag — `Hot`; Add Tag — `Qualified`
3. [ ] Wait 2 hours
4. [ ] Send SMS — `Follow-Up 4.1 — Post-Consult Thank You SMS`
5. [ ] Send Form — `Post-Consultation Feedback` (form exists in Phase 4 — wire this up post-Phase-4)
6. [ ] Wait 22 hours
7. [ ] Send Email — `Follow-Up 4.2 — Post-Consult Next Steps Email`
8. [ ] Create Task — `Personalize fabric recommendations in Day 1 email before sending` — Dustin — due immediately (this is a manual gate — Dustin personalizes the `[fabric recommendations]` block before it sends)
9. [ ] Wait 2 days
10. [ ] If/Else Tag `Fabric Approved`? Yes → Enroll in WF6A → Exit / No → continue
11. [ ] Send SMS — `Follow-Up 4.3 — Fabric Follow-Up SMS`
12. [ ] Wait 4 days
13. [ ] If/Else Has Replied OR Tag `Fabric Approved`? Yes → Exit / No → continue
14. [ ] Add Tag — `Objection - Nurture` (enrolls WF7)

---

## WF5 — Production Milestone Updates

Spec: `09_WORKFLOWS.md` §WF5.

- [ ] **Trigger:** Pipeline Stage = `In Production`
- [ ] Settings → Stop on Reply: OFF, Allow Re-entry: OFF

Steps:

1. [ ] Set Custom Field — `production_start_date` = today
2. [ ] Set Custom Field — `expected_delivery_date` = today + 28 days
3. [ ] Internal Notification **#7** — in-app to Dustin + assistant
4. [ ] Send SMS — inline: `{{contact.first_name}}, pattern work begins today. I'll check in at Week 2 with a progress update and again at Week 4 when we're ready for fitting. — Dustin`
5. [ ] Wait 14 days
6. [ ] Send SMS — inline: `{{contact.first_name}}, halfway point. Your suit is taking shape — jacket canvassing is complete and trousers are cut. Fitting appointment will land on your calendar around Week 3. — Dustin`
7. [ ] Wait 7 days
8. [ ] Send SMS — inline: `{{contact.first_name}}, ready to schedule your fitting. Here's the link: {{custom_values.booking_fitting_url}}. Looking forward to seeing you. — Dustin`
9. [ ] Create Task — `Send fitting link manually if not booked within 48h` — Dustin
10. [ ] Wait 5 days
11. [ ] Send SMS — inline: `{{contact.first_name}}, final stages — suit is in finishing. We should have everything ready for final fitting and delivery shortly. — Dustin`

---

## WF6A — Deposit Reminder

Spec: `09_WORKFLOWS.md` §WF6A.

- [ ] **Trigger:** Tag Added = `Deposit Requested`
- [ ] Settings → Stop on Reply: **OFF** (payment has no substitute), Allow Re-entry: OFF

Steps:

1. [ ] Send SMS — `Payments 3.1 — Deposit Request SMS` (with payment link)
2. [ ] Send Email — inline:
   - Subject: `Reserving your commission`
   - Body: repeat deposit ask with line-item summary + payment link
3. [ ] Wait 3 days
4. [ ] If/Else Tag `Deposit Paid`? Yes → Exit / No → continue
5. [ ] Send SMS — inline: `{{contact.first_name}}, gentle reminder — the deposit link is here whenever you're ready: {{payment_link}}. No rush, just didn't want it to slip. — Dustin`
6. [ ] Wait 4 days
7. [ ] If/Else Tag `Deposit Paid`? Yes → Exit / No → continue
8. [ ] Create Task — `Personal outreach — {{contact.first_name}} hasn't paid deposit in 7 days` — Dustin
9. [ ] Internal Notification **#8** — SMS to Dustin

---

## WF6B — Deposit Received / Final Balance Received

Spec: `09_WORKFLOWS.md` §WF6B.

- [ ] **Trigger:** Payment Received (Stripe) — filter amount ≥ $500
- [ ] Settings → Stop on Reply: OFF, Allow Re-entry: **ON** (same WF handles deposit + final balance paths)

Steps:

1. [ ] **If/Else** — Does contact have tag `Deposit Paid`?
   - **Yes** (this is the final balance): Send SMS `Payments 3.4 — Final Balance Received SMS`, Add Tag `Final Balance Paid`, Update Opportunity → stage `Delivered`
   - **No** (this is the deposit): Send SMS `Payments 3.2 — Deposit Received SMS`, Add Tag `Deposit Paid`, Update Opportunity → stage `Deposit Paid`, Set Custom Field `deposit_amount`
2. [ ] Send Email — receipt with itemized breakdown (use GHL's native Stripe receipt OR build a `Payments — Receipt Email` template)
3. [ ] Internal Notification **#5** — SMS to Dustin + in-app to both
4. [ ] Create Task (deposit path only) — `Begin pattern work for {{contact.first_name}}` — Dustin

---

## WF6C — Final Balance Reminder

Spec: `09_WORKFLOWS.md` §WF6C.

- [ ] **Trigger:** Pipeline Stage = `Final Fitting`
- [ ] Settings → Stop on Reply: OFF, Allow Re-entry: OFF

Steps:

1. [ ] Wait 4 hours
2. [ ] Add Tag — `Final Balance Requested`
3. [ ] Send SMS — `Payments 3.3 — Final Balance SMS`
4. [ ] Send Email — inline:
   - Subject: `Your garment is ready`
   - Body: recap of the journey + payment link + delivery logistics
5. [ ] Wait 3 days
6. [ ] If/Else Tag `Final Balance Paid`? Yes → Exit / No → continue
7. [ ] Send SMS — inline: `{{contact.first_name}}, a friendly nudge on the final balance — once settled, we'll arrange delivery. Link here: {{payment_link}}. — Dustin`
8. [ ] Wait 2 days
9. [ ] If/Else Tag `Final Balance Paid`? Yes → Exit / No → continue
10. [ ] Internal Notification **#9** — SMS to Dustin

---

## WF7 — Objection Handling Sequence

Spec: `09_WORKFLOWS.md` §WF7.

- [ ] **Trigger:** Tag Added = `Objection - Nurture`
- [ ] Settings → Stop on Reply: ON, Allow Re-entry: OFF

Steps:

1. [ ] Wait 1 day
2. [ ] Send Email — `Follow-Up 4.4 — What Bespoke Actually Means`
3. [ ] Wait 3 days
4. [ ] Send Email — inline:
   - Subject: `Three men who were where you are`
   - Body: 3 short testimonials (Dustin populates) of clients who hesitated on price/timing and their outcomes
5. [ ] Wait 3 days
6. [ ] Send Email — inline:
   - Subject: `Installment options`
   - Body: select commissions qualify for 2- or 3-payment plans; offer a call to walk through
7. [ ] Wait 3 days
8. [ ] Send SMS — inline: `{{contact.first_name}}, one last thought — I'd love for you to visit the studio just to see the fabrics. No commitment, no pressure. Sometimes touching the wool is what makes the decision click. — Dustin`
9. [ ] Wait 5 days
10. [ ] If/Else Has Replied? Yes → Exit / No → Add Tag `Went Cold`, Exit

---

## WF8 — 7-Email Nurture Sequence

Spec: `09_WORKFLOWS.md` §WF8 + `08_EMAIL_SEQUENCES.md` Sequence A.

- [ ] **Trigger:** Tag Added = `Nurture Sequence`
- [ ] Settings → Stop on Reply: ON (strip `Nurture Sequence`, apply `Contacted`, notify Dustin), Allow Re-entry: OFF

Steps (use the Email Builder templates you built in Phase 2.5):

1. [ ] Send Email — `Nurture A1 — Why I Do This` (Day 0)
2. [ ] Wait 3 days
3. [ ] Send Email — `Nurture A2 — The Process` (Day 3)
4. [ ] Wait 3 days
5. [ ] Send Email — `Nurture A3 — Fabric Education` (Day 6)
6. [ ] Wait 4 days
7. [ ] Send Email — `Nurture A4 — The Comparison` (Day 10)
8. [ ] Wait 4 days
9. [ ] Send Email — `Nurture A5 — Style Rules` (Day 14)
10. [ ] Wait 4 days
11. [ ] Send Email — `Nurture A6 — Testimonials` (Day 18)
12. [ ] Wait 4 days
13. [ ] Send Email — `Nurture A7 — Behind the Craft` (Day 22)

**On reply at any step:** strip tag `Nurture Sequence`, add `Contacted`, fire internal notification to Dustin.

---

## WF9 — Re-Engagement for Quiet Leads

Spec: `09_WORKFLOWS.md` §WF9.

- [ ] **Trigger:** Opportunity stale — no activity 5 days on any stage 1–4
- [ ] (GHL native trigger: "Opportunity Stale" with 5-day threshold; filter opportunities in pipeline `Bespoke Client Journey`, stages 1–4)
- [ ] Settings → Stop on Reply: ON, Allow Re-entry: ON

Steps:

1. [ ] Send SMS — `Follow-Up 4.5 — Re-Engagement SMS`
2. [ ] Wait 3 days
3. [ ] If/Else Has Replied? Yes → Exit / No → continue
4. [ ] Send Email — inline:
   - Subject: `A glimpse of recent work`
   - Body: visual email with 2–3 recent commission photos + short story for each
5. [ ] Wait 2 days
6. [ ] If/Else Has Replied? Yes → Exit / No → continue
7. [ ] Send SMS — inline: `{{contact.first_name}}, I'll park this for now. When the timing is right, the studio is here. — Dustin`
8. [ ] Wait 2 days
9. [ ] Add Tag — `Went Cold`
10. [ ] Internal Notification **#10** — in-app to Dustin

---

## WF10 — Post-Delivery Follow-Up

Spec: `09_WORKFLOWS.md` §WF10 + `08_EMAIL_SEQUENCES.md` Sequence C.

- [ ] **Trigger:** Pipeline Stage = `Delivered`
- [ ] Settings → Stop on Reply: OFF (each touch independent), Allow Re-entry: OFF

Steps:

1. [ ] Wait 1 day
2. [ ] Send SMS — `Retention 5.1 — Post-Delivery Check-In SMS`
3. [ ] Internal Notification **#6** — in-app to both
4. [ ] Wait 3 days
5. [ ] Send Email — `Retention 5.2 — Testimonial Request Email` + embed `Post-Delivery Satisfaction` survey link
6. [ ] Wait 4 days
7. [ ] Send SMS — `Retention 5.5 — Day 8 Photo Request SMS`
8. [ ] Wait 7 days
9. [ ] Send Email — `Retention 5.3 — Referral Invitation Email`
10. [ ] Wait 15 days
11. [ ] Send Email — `Retention 5.6 — Wardrobe Continuation`
12. [ ] Update Opportunity — stage `Post-Delivery Follow-Up` (on Day 1), then `VIP Client / Repeat` (on Day 30)
13. [ ] Create Task — `Review {{contact.first_name}} — VIP eligible?` — Dustin — due Day 30

---

## WF11 — Birthday Campaign

Spec: `09_WORKFLOWS.md` §WF11.

- [ ] **Trigger:** Birthday (annual recurring from DOB field) — audience filter: tag `Birthday Opt-In` AND tag `Delivered`
- [ ] Settings → Stop on Reply: ON, Allow Re-entry: YES (annual)

Steps:

1. [ ] Send SMS — `Retention 5.4 — Birthday SMS`
2. [ ] Send Email — inline: longer birthday email — personal tone, complimentary monogramming offer, 90-day validity
3. [ ] Internal Notification **#11 (birthday variant)** — in-app
4. [ ] Create Task — `Handwritten birthday note to {{contact.first_name}}` — Dustin — due today

---

## WF12 — Seasonal Wardrobe Update

Spec: `09_WORKFLOWS.md` §WF12.

- [ ] **Trigger:** Scheduled — March 15 (Spring/Summer) and September 15 (Fall/Winter), annually
- [ ] Settings → Stop on Reply: ON, Allow Re-entry: YES (bi-annual)
- [ ] Audience filter: tag `Delivered`

Steps (Spring/Summer; mirror for Fall/Winter with different fabrics):

1. [ ] Send Email — inline:
   - Subject: `The fabrics that belong in your wardrobe this season`
   - Body: spotlight 3 seasonal fabrics (fresco linen, lightweight wool, cotton-linen blends) with swatches, soft CTA to begin a new commission
2. [ ] Wait 7 days
3. [ ] If/Else Has Replied? Yes → Exit / No → continue
4. [ ] Send SMS — inline: `{{contact.first_name}}, the summer commission book is filling quickly. If a new piece is in the plan this year, now's the time to start. — Dustin`

---

## WF13 — Monthly Style Insider

Spec: `09_WORKFLOWS.md` §WF13.

- [ ] **Trigger:** Scheduled — 1st Monday every month, 9:00 AM
- [ ] Settings → Stop on Reply: OFF, Allow Re-entry: YES (monthly)
- [ ] Audience filter: tag `Style Insider Subscriber`

Steps:

1. [ ] Send Email — newsletter (Dustin's assistant drafts each month by 3rd-last business day of prior month). 5-section template: (1) Personal note, (2) Client spotlight, (3) Style tip, (4) Behind-the-craft, (5) Availability note.

**Content ops:** Don't automate the content. This is editorial.

---

## WF-AI — AI Handoff (Phase 4 prereq)

**Trigger:** Tag Added = `AI Handoff Requested`

- [ ] Send Internal Notification **#11 (handoff variant)** — SMS to Dustin with conversation URL
- [ ] Stop AI engagement on thread (tag-based condition used by the AI Concierge)

This WF is required before the AI Concierge (Phase 4) can be published.

---

## Phase 3 QA gate

Don't publish yet. Before flipping Draft → Published on any workflow:

- [ ] Use a test contact (your phone + an aliased email) to fire each of the 13 triggers
- [ ] Walk through each workflow's enrollment history and verify every step fires with correct timing
- [ ] Confirm all SMS send within business hours (10 AM – 8 PM)
- [ ] Verify merge fields (`{{contact.first_name}}`, `{{custom_values.booking_consultation_url}}`, `{{appointment.start_time_formatted}}`, etc.) populate correctly — a broken merge is worse than silence
- [ ] Confirm opportunity stage updates actually land (requires pipeline built in Phase 2.0)
- [ ] Confirm all 11 internal notifications route to the right people on the right channels

When all 13 pass QA, move to Phase 4.
