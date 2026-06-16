# Workflows — WF1 through WF13 (full specs)

**GHL Path:** Automation → Workflows → + Create Workflow → Start from Scratch

Build each workflow in **Draft** mode. Do NOT publish until all 13 are built and the QA section of the Runbook (file 12) passes.

**Global settings for EVERY workflow:**
- Stop on Reply: ✓ (unless explicitly noted otherwise)
- Allow Re-entry: Depends on workflow — specified per-WF below
- Time window: Business hours (10 AM – 8 PM local) for SMS; emails can send anytime

---

## WF1 — New Lead Welcome & Qualification

**Trigger:** Contact Created (any source) OR Form Submitted (Bespoke Inquiry)
**Allow Re-entry:** No
**Stop on Reply:** Yes
**Exit tag:** `Deposit Paid` or `Went Cold`

### Action sequence

| # | Action | Detail |
|---|---|---|
| 1 | Wait | 2 minutes (prevents robotic feel) |
| 2 | Send SMS | Template: `Welcome 1.1 — Welcome SMS` |
| 3 | Send Email | Template: `Welcome 1.2 — Welcome Email` |
| 4 | Create Opportunity | Pipeline: Bespoke Client Journey / Stage: New Lead / Opp Value: $0 / Name: "{{contact.full_name}} — {{contact.occasion}}" |
| 5 | Add Tag | `New Lead` + `Source: {source}` (conditional based on trigger source) |
| 6 | Internal Notification | See file 11, notification #1 |
| 7 | Create Task | "Follow up personally with {{contact.first_name}}" — due in 4 hours — assigned to Dustin |
| 8 | Wait | 24 hours |
| 9 | If/Else — Has Replied? | Yes → Exit (human takes over) / No → Continue |
| 10 | Send SMS | Template: `Welcome 1.3 — No-Reply Check-In SMS` |
| 11 | Wait | 24 hours |
| 12 | If/Else — Has Replied? | Yes → Exit / No → Continue |
| 13 | Add Tag | `Nurture Sequence` (enrolls in WF8) |
| 14 | Remove Tag | `New Lead` |
| 15 | Add Tag | `Cold` |

---

## WF2 — Consultation Booking Confirmation & Reminders

**Trigger:** Customer Booked Appointment — Calendar: Private Style Consultation
**Allow Re-entry:** Yes (per booking)
**Stop on Reply:** No (reminders must fire)

### Action sequence

| # | Action | Detail |
|---|---|---|
| 1 | Update Opportunity | Move to stage "Consultation Booked" |
| 2 | Remove Tag | `New Lead`, `Contacted` |
| 3 | Add Tag | `Ready to Book` → `Hot` |
| 4 | Send SMS | Template: `Appointments 2.1 — Consult Confirmation SMS` |
| 5 | Send Email | Template: `Appointments 2.2 — Consult Confirmation Email` |
| 6 | Wait Until | 24 hours before appointment start |
| 7 | Send SMS | Template: `Appointments 2.3 — 24-Hour Reminder SMS` |
| 8 | Wait Until | 2 hours before appointment start |
| 9 | Send SMS | Template: `Appointments 2.4 — 2-Hour Reminder SMS` |
| 10 | Internal Notification | Notification #2 — "New consult booked" to Dustin + assistant |

**Appointment status path:** When status flips to Completed → exits WF2, enters WF4.
**Appointment status path:** When status flips to No-Show → exits WF2, enters WF3.

---

## WF3 — No-Show Follow-Up

**Trigger:** Appointment Status = No-Show (Consultation calendar)
**Allow Re-entry:** Yes
**Stop on Reply:** Yes

### Action sequence

| # | Action | Detail |
|---|---|---|
| 1 | Add Tag | `No-Show` |
| 2 | Internal Notification | Notification #3 — "No-show — personal call recommended" |
| 3 | Wait | 30 minutes |
| 4 | Send SMS | Template: `Appointments 2.5 — No-Show SMS` |
| 5 | Create Task | "Personal call to {{contact.first_name}}" — due in 24h — Dustin |
| 6 | Wait | 24 hours |
| 7 | If/Else — Has Replied? | Yes → Exit / No → Continue |
| 8 | Send Email | Subject: "Still here when you are" — short personal email acknowledging life happens, offering reschedule link |
| 9 | Wait | 48 hours |
| 10 | If/Else — Has Replied? | Yes → Exit / No → Continue |
| 11 | Send SMS | "{{contact.first_name}}, one final note — the door is open whenever you're ready. No hard feelings, ever. — Dustin" |
| 12 | Add Tag | `Went Cold` |
| 13 | Move Opportunity | Stage: Contacted (don't kill it — just re-park) |

---

## WF4 — Post-Consultation Follow-Up & Deposit Request

**Trigger:** Appointment Status = Completed (Consultation calendar)
**Allow Re-entry:** No
**Stop on Reply:** No (each touch is independent)

### Action sequence

| # | Action | Detail |
|---|---|---|
| 1 | Update Opportunity | Move to stage "Consultation Completed" / Value: $3,500 |
| 2 | Add Tag | Remove `Hot`, add `Qualified` |
| 3 | Wait | 2 hours |
| 4 | Send SMS | Template: `Follow-Up 4.1 — Post-Consult Thank You SMS` |
| 5 | Send Form | Post-Consultation Feedback form (survey) |
| 6 | Wait | 22 hours (lands ~Day 1 AM) |
| 7 | Send Email | Template: `Follow-Up 4.2 — Post-Consult Next Steps Email` |
| 8 | Create Task | "Personalize fabric recommendations in Day 1 email before sending" — assigned to Dustin — due immediately |
| 9 | Wait | 2 days |
| 10 | If/Else — Tag `Fabric Approved`? | Yes → Enroll in WF6A / No → Continue |
| 11 | Send SMS | Template: `Follow-Up 4.3 — Fabric Follow-Up SMS` |
| 12 | Wait | 4 days |
| 13 | If/Else — Has Replied OR Tag `Fabric Approved`? | Yes → Exit / No → Continue |
| 14 | Add Tag | `Objection - Nurture` (enrolls in WF7) |

**Note:** The Day 1 Next Steps email has a placeholder `[fabric recommendations]` section. WF4 pauses for Dustin to personalize (Task #8). Training note: Dustin should never let this email go out un-personalized.

---

## WF5 — Production Milestone Updates

**Trigger:** Pipeline Stage = In Production
**Allow Re-entry:** No (per commission; repeat clients get a fresh opp)
**Stop on Reply:** No

### Action sequence

| # | Action | Detail |
|---|---|---|
| 1 | Set Custom Field | `production_start_date` = today |
| 2 | Set Custom Field | `expected_delivery_date` = today + 28 days |
| 3 | Internal Notification | Notification #7 — "Production started for {{contact.first_name}}" |
| 4 | Send SMS | "{{contact.first_name}}, pattern work begins today. I'll check in at Week 2 with a progress update and again at Week 4 when we're ready for fitting. — Dustin" |
| 5 | Wait | 14 days |
| 6 | Send SMS | "{{contact.first_name}}, halfway point. Your suit is taking shape — jacket canvassing is complete and trousers are cut. Fitting appointment will land on your calendar around Week 3. — Dustin" |
| 7 | Wait | 7 days (Week 3) |
| 8 | Send SMS | "{{contact.first_name}}, ready to schedule your fitting. Here's the link: {{custom_values.booking_fitting_url}}. Looking forward to seeing you. — Dustin" |
| 9 | Create Task | "Send fitting link manually if not booked within 48h" — Dustin |
| 10 | Wait | 5 days |
| 11 | Send SMS | "{{contact.first_name}}, final stages — suit is in finishing. We should have everything ready for final fitting and delivery shortly. — Dustin" |

---

## WF6A — Deposit Reminder Sequence

**Trigger:** Tag Added = `Deposit Requested`
**Allow Re-entry:** No
**Stop on Reply:** No (payment has no substitute)

### Action sequence

| # | Action | Detail |
|---|---|---|
| 1 | Send SMS | Template: `Payments 3.1 — Deposit Request SMS` (with payment link) |
| 2 | Send Email | Subject: "Reserving your commission" — repeats deposit ask with line-item summary + payment link |
| 3 | Wait | 3 days |
| 4 | If/Else — Tag `Deposit Paid`? | Yes → Exit / No → Continue |
| 5 | Send SMS | "{{contact.first_name}}, gentle reminder — the deposit link is here whenever you're ready: {{payment_link}}. No rush, just didn't want it to slip. — Dustin" |
| 6 | Wait | 4 days |
| 7 | If/Else — Tag `Deposit Paid`? | Yes → Exit / No → Continue |
| 8 | Create Task | "Personal outreach — {{contact.first_name}} hasn't paid deposit in 7 days" — Dustin |
| 9 | Internal Notification | Notification #8 — stale deposit alert |

---

## WF6B — Deposit Received Confirmation

**Trigger:** Payment Received (Stripe) — amount ≥ $500 (filters out small test payments)
**Allow Re-entry:** Yes (handles final balance path too)
**Stop on Reply:** No

### Action sequence

| # | Action | Detail |
|---|---|---|
| 1 | Send SMS | Template: `Payments 3.2 — Deposit Received SMS` (if deposit) OR `Payments 3.4 — Final Balance Received SMS` (if final balance) |
| 2 | Send Email | Receipt with itemized breakdown (GHL's native receipt OR custom template) |
| 3 | Add Tag | `Deposit Paid` (if deposit) OR `Final Balance Paid` |
| 4 | Update Opportunity | Move to Stage: Deposit Paid (if first payment) OR Delivered (if final) |
| 5 | Set Custom Field | `deposit_amount` OR update `total_order_value` |
| 6 | Internal Notification | Notification #5 — payment received |
| 7 | Create Task | "Begin pattern work for {{contact.first_name}}" — Dustin (if deposit) |

**Branching logic note:** This workflow needs an If/Else at step 1 based on whether tag `Deposit Paid` already exists. If yes, treat as final balance. If no, treat as deposit.

---

## WF6C — Final Balance Reminder

**Trigger:** Pipeline Stage = Final Fitting
**Allow Re-entry:** No
**Stop on Reply:** No

### Action sequence

| # | Action | Detail |
|---|---|---|
| 1 | Wait | 4 hours (let the fitting appointment wrap) |
| 2 | Add Tag | `Final Balance Requested` |
| 3 | Send SMS | Template: `Payments 3.3 — Final Balance SMS` (with payment link for remaining balance) |
| 4 | Send Email | Subject: "Your garment is ready" — recap of the journey + payment link + delivery logistics |
| 5 | Wait | 3 days |
| 6 | If/Else — Tag `Final Balance Paid`? | Yes → Exit / No → Continue |
| 7 | Send SMS | "{{contact.first_name}}, a friendly nudge on the final balance — once settled, we'll arrange delivery. Link here: {{payment_link}}. — Dustin" |
| 8 | Wait | 2 days |
| 9 | If/Else — Tag `Final Balance Paid`? | Yes → Exit / No → Continue |
| 10 | Internal Notification | Notification #9 — "Final balance stale — Dustin to call" |

---

## WF7 — Objection Handling Sequence

**Trigger:** Tag Added = `Objection - Nurture`
**Allow Re-entry:** No
**Stop on Reply:** Yes
**Duration:** 10 days, 4 touches

### Action sequence

| # | Action | Detail |
|---|---|---|
| 1 | Wait | 1 day |
| 2 | Send Email | Template: `Follow-Up 4.4 — What Bespoke Actually Means` |
| 3 | Wait | 3 days |
| 4 | Send Email | Subject: "Three men who were where you are" — 3 short testimonials from clients who initially hesitated on price/timing, with their outcomes |
| 5 | Wait | 3 days |
| 6 | Send Email | Subject: "Installment options" — explains that select commissions qualify for 2-payment or 3-payment plans; offers a call to walk through |
| 7 | Wait | 3 days |
| 8 | Send SMS | "{{contact.first_name}}, one last thought — I'd love for you to visit the studio just to see the fabrics. No commitment, no pressure. Sometimes touching the wool is what makes the decision click. — Dustin" |
| 9 | Wait | 5 days |
| 10 | If/Else — Has Replied? | Yes → Exit / No → Add Tag `Went Cold`, exit |

---

## WF8 — 7-Email Nurture Sequence

**Trigger:** Tag Added = `Nurture Sequence`
**Allow Re-entry:** No
**Stop on Reply:** Yes — when reply detected, strip `Nurture Sequence` tag and route to Dustin
**Duration:** 22 days, 7 emails

### Action sequence

Map directly to Sequence A in file 08 (A1–A7). Day 0, 3, 6, 10, 14, 18, 22.

| Day | Email |
|---|---|
| 0 | A1 — Brand Story |
| 3 | A2 — The Process |
| 6 | A3 — Fabric Education |
| 10 | A4 — Comparison |
| 14 | A5 — Style Rules |
| 18 | A6 — Testimonials |
| 22 | A7 — Behind the Craft |

**On reply at any point:** Strip `Nurture Sequence` tag, apply `Contacted`, fire internal notification to Dustin.

---

## WF9 — Re-Engagement for Quiet Leads

**Trigger:** Opportunity Stale — no activity 5 days on any stage 1–4
**Allow Re-entry:** Yes (per stale event)
**Stop on Reply:** Yes
**Duration:** 7 days, 4 touches

### Action sequence

| # | Action | Detail |
|---|---|---|
| 1 | Send SMS | Template: `Follow-Up 4.5 — Re-Engagement SMS` |
| 2 | Wait | 3 days |
| 3 | If/Else — Has Replied? | Yes → Exit / No → Continue |
| 4 | Send Email | Subject: "A glimpse of recent work" — visual email with 2–3 recent commission photos + short story for each |
| 5 | Wait | 2 days |
| 6 | If/Else — Has Replied? | Yes → Exit / No → Continue |
| 7 | Send SMS | "{{contact.first_name}}, I'll park this for now. When the timing is right, the studio is here. — Dustin" |
| 8 | Wait | 2 days |
| 9 | Add Tag | `Went Cold` |
| 10 | Internal Notification | Notification #10 — "{{contact.first_name}} marked Went Cold" |

---

## WF10 — Post-Delivery Follow-Up

**Trigger:** Pipeline Stage = Delivered
**Allow Re-entry:** No
**Stop on Reply:** No (each touch independent)
**Duration:** 30 days, 5 touches

### Action sequence

| # | Action | Detail |
|---|---|---|
| 1 | Wait | 1 day |
| 2 | Send SMS | Template: `Retention 5.1 — Post-Delivery Check-In SMS` |
| 3 | Internal Notification | Notification #6 — delivery complete |
| 4 | Wait | 3 days (Day 4) |
| 5 | Send Email | Template: `Retention 5.2 — Testimonial Request Email` + Post-Delivery Satisfaction survey link |
| 6 | Wait | 4 days (Day 8) |
| 7 | Send SMS | Day 8 Photo Request SMS (see C3 in file 08) |
| 8 | Wait | 7 days (Day 15) |
| 9 | Send Email | Template: `Retention 5.3 — Referral Invitation Email` |
| 10 | Wait | 15 days (Day 30) |
| 11 | Send Email | C5 — Wardrobe Continuation Email (see file 08) |
| 12 | Update Opportunity | Move to Stage: Post-Delivery Follow-Up (Day 1 of this WF) then VIP Client / Repeat (Day 30) |
| 13 | Create Task | "Review {{contact.first_name}} — VIP eligible?" — Dustin — due Day 30 |

---

## WF11 — Birthday Campaign

**Trigger:** Birthday (annual recurring — uses contact DOB)
**Allow Re-entry:** Yes (annual)
**Stop on Reply:** Yes
**Audience:** Contacts with `Birthday Opt-In` tag

### Action sequence

| # | Action | Detail |
|---|---|---|
| 1 | Check | Contact has tag `Birthday Opt-In` AND tag `Delivered` (must be a past client) |
| 2 | Send SMS | Template: `Retention 5.4 — Birthday SMS` |
| 3 | Send Email | Longer birthday email — personal tone, complimentary monogramming offer, 90-day validity |
| 4 | Internal Notification | Notification #11 — "{{contact.first_name}}'s birthday — Dustin personal note recommended" |
| 5 | Create Task | "Handwritten birthday note to {{contact.first_name}}" — Dustin — due today |

---

## WF12 — Seasonal Wardrobe Update

**Trigger:** Scheduled — March 15 (Spring/Summer) and September 15 (Fall/Winter), annually
**Allow Re-entry:** Yes (bi-annual)
**Stop on Reply:** Yes
**Audience:** All contacts with `Delivered` tag (past clients)

### Action sequence — Spring/Summer version (September mirrors with different fabrics)

| # | Action | Detail |
|---|---|---|
| 1 | Send Email | Subject: "The fabrics that belong in your wardrobe this season" — spotlight 3 seasonal fabrics (fresco linen, lightweight wool, cotton-linen blends), include fabric swatches visually, soft CTA to begin a new commission |
| 2 | Wait | 7 days |
| 3 | If/Else — Has Replied? | Yes → Exit / No → Continue |
| 4 | Send SMS | "{{contact.first_name}}, the summer commission book is filling quickly. If a new piece is in the plan this year, now's the time to start. — Dustin" |

---

## WF13 — Monthly Style Insider

**Trigger:** Scheduled — 1st Monday of every month, 9:00 AM
**Allow Re-entry:** Yes (monthly)
**Stop on Reply:** No
**Audience:** Contacts with `Style Insider Subscriber` tag

### Action sequence

| # | Action | Detail |
|---|---|---|
| 1 | Send Email | Newsletter with 5 sections: (1) Personal note from Dustin, (2) Client spotlight / recent commission, (3) Style tip of the month, (4) Behind-the-craft (fabric origin story, technique, etc.), (5) Availability note / next open commission window |

**Content ops:** Dustin's assistant drafts each month's newsletter by the 3rd-last business day of the prior month. Template lives inside Email Builder; workflow just sends it. Don't automate the content — this is editorial.

---

## Global rules applied to every workflow

1. **Publish last.** Build every workflow in Draft. Only switch to Published after full QA pass.
2. **Test contact rule:** Use a test contact (your own phone + email aliased) for every workflow before real clients touch it. Dustin's Creait OS bill has SMS credits — don't burn them on broken sends.
3. **Business hours:** SMS-type actions respect 10 AM – 8 PM local. Emails can send anytime.
4. **Quiet hours override:** Any SMS scheduled to fire 8 PM – 10 AM shifts to next 10 AM.
5. **One opp, one enrollment:** Enable "Prevent duplicate enrollment" at the workflow level for all sequential workflows (WF1, WF4, WF5, WF7, WF8, WF10).
6. **Failure alerts:** Configure workflow failure alerts to Dustin's email. Silent failures are worse than loud failures.
