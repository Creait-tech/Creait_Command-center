# Pipeline — Bespoke Client Journey (12 stages)

**GHL Path:** Opportunities → Pipelines → + Create New Pipeline
**Pipeline Name:** Bespoke Client Journey
**Settings:** Enable "Allow Multiple Opportunities Per Contact" (critical for repeat clients)

---

## The 12 stages

| # | Stage | Default Opp Value | Move Trigger | Phase |
|---|---|---|---|---|
| 1 | New Lead | $0 | Form submission / Ad / Manual / AI intake | Lead Gen |
| 2 | Contacted | $0 | Manual — after Dustin or assistant has first live exchange | Lead Gen |
| 3 | Consultation Booked | $0 | Auto — appointment booked on Private Style Consultation calendar | Consultation |
| 4 | Consultation Completed | $3,500 | Auto — appointment status = completed | Consultation |
| 5 | Fabric & Design Selected | $3,500 | Auto — custom field "Fabric Approved" = Yes OR tag "Fabric Approved" | Production |
| 6 | Deposit Paid | $1,750 | Auto — Stripe webhook / payment received / tag "Deposit Paid" | Payment |
| 7 | In Production | $1,750 | Manual — Dustin moves after pattern work begins | Production |
| 8 | Fitting Scheduled | $1,750 | Auto — appointment booked on Fitting calendar | Production |
| 9 | Final Fitting | $1,750 | Manual — Dustin moves after fitting complete | Production |
| 10 | Delivered | $3,500 | Auto — final balance paid | Delivery |
| 11 | Post-Delivery Follow-Up | $3,500 | Auto — 3 days after Delivered | Retention |
| 12 | VIP Client / Repeat | $3,500+ | Manual — after post-delivery sequence complete AND testimonial received | Retention |

**Weighted pipeline value formula (for forecasting):**

- Stages 1–2: $0 (pre-qualification)
- Stages 3: $1,050 (30% conversion expectation)
- Stage 4: $2,450 (70% expected to close)
- Stage 5: $3,150 (90% expected to close)
- Stage 6+: $3,500+ (full value — money has changed hands)

---

## Stage-by-stage definitions

### Stage 1 — New Lead
**Definition:** Contact exists, no substantive exchange yet. May be ghost/bot/cold.
**Who moves:** System (auto on creation).
**Actions firing here:** WF1 Welcome & Qualification. AI agent enabled.

### Stage 2 — Contacted
**Definition:** Two-way exchange happened. Human (or AI) has had at least one real message back and forth.
**Who moves:** Manual by Dustin/assistant, or WF1 "reply detected" branch.
**Actions firing here:** Qualification continuing — gather occasion, timeline, budget.

### Stage 3 — Consultation Booked
**Definition:** Appointment on the 90-min Private Style Consultation calendar exists.
**Who moves:** Auto (booking trigger).
**Actions firing here:** WF2 confirmation + reminders.

### Stage 4 — Consultation Completed
**Definition:** Consultation happened. Measurements taken. Fabric/style options shown.
**Who moves:** Auto (appointment status = completed).
**Actions firing here:** WF4 post-consult nurture. Deposit request.

### Stage 5 — Fabric & Design Selected
**Definition:** Client has approved fabric + design digitally. Ready for pattern work.
**Who moves:** Auto (tag "Fabric Approved" OR custom field toggled).
**Actions firing here:** WF6A deposit reminder if not yet paid.

### Stage 6 — Deposit Paid
**Definition:** Deposit received. Legally and operationally green-lit to start pattern work.
**Who moves:** Auto (Stripe webhook).
**Actions firing here:** WF6B receipt. Internal notification to production.

### Stage 7 — In Production
**Definition:** Pattern created, tailoring underway.
**Who moves:** Manual (Dustin moves once production begins).
**Actions firing here:** WF5 milestone updates (Week 0, 2, 4).

### Stage 8 — Fitting Scheduled
**Definition:** Intermediate fitting appointment booked.
**Who moves:** Auto (Fitting calendar booking).
**Actions firing here:** Fitting reminders (same cadence as consultation).

### Stage 9 — Final Fitting
**Definition:** Final fitting complete, adjustments made, garment finalized.
**Who moves:** Manual (Dustin).
**Actions firing here:** WF6C final balance request.

### Stage 10 — Delivered
**Definition:** Suit delivered. Transaction complete.
**Who moves:** Auto (final balance payment received).
**Actions firing here:** WF10 post-delivery sequence starts.

### Stage 11 — Post-Delivery Follow-Up
**Definition:** In the 30-day post-delivery retention window.
**Who moves:** Auto (3 days after Delivered).
**Actions firing here:** Day 1 check-in, Day 4 testimonial, Day 8 photo, Day 15 referral.

### Stage 12 — VIP Client / Repeat
**Definition:** Retention sequence complete. Client is now in the long-term nurture universe.
**Who moves:** Manual (Dustin marks them VIP after review).
**Actions firing here:** WF11 birthday, WF12 seasonal, WF13 monthly newsletter.

---

## Pipeline hygiene rules

1. **Never move backwards.** A client who cools after Stage 4 doesn't drop back to Stage 2 — they get tagged "Cold" and stay at Stage 4 with a reason note in the opportunity.
2. **Repeat clients open a NEW opportunity** — we don't reset the existing one. That's why Multiple Opportunities Per Contact is enabled.
3. **No opportunity stays idle >7 days without a note.** WF9 re-engagement catches this automatically, but Dustin should get a weekly stale-opp report.
4. **Stage 12 is permanent.** VIPs don't cycle out. They live in Stage 12 and open new opportunities for each commission.
