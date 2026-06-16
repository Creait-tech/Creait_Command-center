# Implementation Runbook — Click-path guide for Phases 1–4

This is the build sequence. Follow it in order. Every box has either (a) a click-path inside GHL or (b) a reference to the API bulk-import script (file 13).

**Before you start:** Open the API script in a terminal and have `node`, `axios`, and the PIT token ready. Also keep files 07 (templates), 09 (workflows), and 10 (AI) open on a second monitor.

---

## Day 0 — Pre-flight

- [ ] Pull latest Dustin's info: studio address, business phone, time zone, brand color hex, logo file, existing booking links, assistant's name + email, DOB opt-in plan
- [ ] Confirm the 3 flags from `14_REVIEW_NOTES.md` with Dustin: 90-min consult, 5-day re-engagement, Voice AI deferral to Phase 5
- [ ] Kick off A2P 10DLC registration (Settings → Phone Numbers → A2P 10DLC) — this takes days, queue it immediately
- [ ] Install or confirm: Claude in Chrome extension (for the drive-along sessions)

---

## Phase 1 — Foundation (Days 1–3)

### Day 1 — Account setup

- [ ] **Settings → Business Profile** — Set name, logo, address, phone, email, time zone, currency (USD)
- [ ] **Settings → Business Hours** — Tue–Sat 10 AM–6 PM (or confirmed hours)
- [ ] **Settings → Domains** — Add Dustin's sending domain, configure SPF, DKIM, DMARC records (this may require coordinating with Dustin's registrar — DNS propagation takes 24–48h)
- [ ] **Settings → Phone Numbers** — Connect/port Dustin's business line OR provision new GHL number; begin A2P 10DLC registration
- [ ] **Integrations → Stripe** — Connect Stripe account; test with $1 payment
- [ ] **Settings → Custom Values** — Run API script **Section 1** (custom values) OR add 12 manually (file 05)

### Day 2 — Data model

- [ ] **Settings → Custom Fields → Create folder "Bespoke Order Details"** — Run API script **Section 2** (custom fields) — creates all 17 fields (file 01)
- [ ] **Settings → Tags** — Run API script **Section 3** (tags) — creates all 33 tags (file 02)
- [ ] **Verify:** Open Contacts → Add Contact → confirm all fields and tags are visible

### Day 3 — Pipeline + Calendars

- [ ] **Opportunities → Pipelines → + Create** — Run API script **Section 4** OR create "Bespoke Client Journey" manually with 12 stages from file 03. Enable "Allow Multiple Opportunities Per Contact."
- [ ] **Calendars → + New Calendar** — Create "Private Style Consultation" per file 04
- [ ] **Calendars → + New Calendar** — Create "Fitting Appointment" per file 04
- [ ] **Test:** Book a test appointment on Private Style Consultation. Verify confirmation email/SMS stubs work. Cancel the test.

**Phase 1 gate:** All 17 fields, 33 tags, 12 pipeline stages, 2 calendars, Stripe connected, domain authenticated. Move to Phase 2.

---

## Phase 2 — Core Automations (Days 3–6)

### Day 3 (parallel with Phase 1 finish) — Forms

- [ ] **Sites → Forms → + Create** — "Bespoke Inquiry" form per file 06. Map every field to the corresponding custom field.
- [ ] **Sites → Forms → + Create** — "Refer a Friend" form per file 06.
- [ ] **Test:** Submit Bespoke Inquiry with test data. Verify contact created with fields populated. Verify tags applied (should be `New Lead` + source tag).

### Day 4 — Messaging templates

- [ ] **Marketing → Templates → + New Folder** — Create 5 folders (Welcome, Appointments, Payments, Follow-Up, Retention)
- [ ] **Build 22 templates** — Copy/paste from file 07. Save each with the naming convention `[Folder] [Number] — [Short name]`
- [ ] **Build 3 email sequences templates** (the 14 emails from file 08) inside the Email Builder
- [ ] **Test:** Send each template to a test contact. Verify merge fields populate. Fix any broken merges.

### Day 5 — Workflows WF1, WF2, WF3, WF4

- [ ] **Automation → Workflows → + Create → From Scratch** — Build WF1 per file 09. Keep in **Draft**.
- [ ] Build WF2 (Consultation Booking)
- [ ] Build WF3 (No-Show)
- [ ] Build WF4 (Post-Consultation)
- [ ] **Test each:** Use a test contact. Fire each trigger manually. Verify all actions execute in order with correct timing.

### Day 6 — Payment workflows + notifications

- [ ] Build WF6A (Deposit Reminder)
- [ ] Build WF6B (Deposit Received) — wire to Stripe payment webhook
- [ ] Build WF6C (Final Balance Reminder)
- [ ] **Settings → Notifications** — Configure 11 internal notifications per file 11
- [ ] **Verify:** Run end-to-end test — Submit form → WF1 fires → book consult → WF2 fires → mark completed → WF4 fires → pay deposit (Stripe test mode) → WF6B fires → notification received

**Phase 2 gate:** New lead can flow from form submission through deposit collection with automation handling every step. Move to Phase 3.

---

## Phase 3 — Nurture & AI (Days 6–9)

### Day 7 — Nurture workflows

- [ ] Build WF5 (Production Milestones)
- [ ] Build WF7 (Objection Handling)
- [ ] Build WF8 (7-Email Nurture) — wire to Sequence A from file 08
- [ ] Build WF9 (Re-Engagement)
- [ ] **Test WF8 specifically:** Enroll a test contact, fast-forward the clock (GHL lets you simulate). Verify all 7 emails render properly.

### Day 8 — AI Concierge

- [ ] **AI Agents → Conversation AI → Create Bot** — Name: "Dustin's Style Concierge"
- [ ] Paste the 3 system prompts (Personality, Intent, Context) from file 10
- [ ] Set operating mode: Suggestive (business hours) / Auto-Pilot (after hours)
- [ ] Connect channels: SMS, Instagram DM (requires IG connection), Live Chat
- [ ] Upload knowledge base docs (brand guide, FAQ, process, fabric reference, internal pricing ref)
- [ ] Configure Human Handoff tag trigger

### Day 9 — AI testing marathon

- [ ] **Run all 20 test conversations from file 10.** Document results in a shared doc. Tune prompts until all 20 pass.
- [ ] Have Dustin review 10 sample transcripts. Adjust voice until he says "that sounds like me."
- [ ] Build the "AI Handoff" workflow (triggered by tag `AI Handoff Requested` → notification #11 handoff + stop AI engagement on thread)

**Phase 3 gate:** Full nurture sequence operational, AI Concierge responding in Dustin's voice, all test conversations passing. Move to Phase 4.

---

## Phase 4 — Retention & Growth (Days 9–12)

### Day 10 — Retention workflows

- [ ] Build WF10 (Post-Delivery Follow-Up)
- [ ] Build WF11 (Birthday Campaign)
- [ ] Build WF12 (Seasonal Wardrobe)
- [ ] Build WF13 (Monthly Style Insider)
- [ ] **Sites → Forms → + Create** — Post-Consultation Feedback form per file 06
- [ ] **Sites → Forms → + Create** — Post-Delivery Satisfaction form per file 06

### Day 11 — Full end-to-end QA

Execute this full scenario with a test contact. Every step should fire automatically.

| Step | Action | Expected Outcome |
|---|---|---|
| 1 | Submit Bespoke Inquiry form | Contact created, WF1 fires, SMS/email received, opp created Stage 1 |
| 2 | Reply to welcome SMS | `Contacted` tag added, Dustin notified |
| 3 | Book consult via link | WF2 fires, confirmation sent, 24h/2h reminders scheduled |
| 4 | Mark appointment completed | WF4 fires, thank-you SMS, feedback form sent, Day 1 email scheduled |
| 5 | Add tag `Fabric Approved` | Pipeline moves to Stage 5 |
| 6 | Add tag `Deposit Requested` | WF6A fires with payment link |
| 7 | Test-pay deposit (Stripe test mode) | WF6B fires, receipt sent, Stage 6, notification |
| 8 | Manually move to Stage 7 (In Production) | WF5 fires Week 0 message |
| 9 | Fast-forward to Week 4 | Fitting link sent |
| 10 | Book fitting | Stage 8, fitting confirmation |
| 11 | Manually move to Stage 9 (Final Fitting) | WF6C fires final balance request |
| 12 | Test-pay final balance | Stage 10 (Delivered), WF10 starts |
| 13 | Verify Day 1 SMS, Day 4 testimonial email, Day 8 photo SMS, Day 15 referral email, Day 30 wardrobe email | All fire |
| 14 | Submit satisfaction survey with 5 stars | Internal notification for testimonial-ready client |
| 15 | Submit referral form with a new contact | New contact created, WF1 fires for friend |

### Day 12 — Go-live

- [ ] Fix any issues discovered in Day 11 QA
- [ ] Switch ALL workflows from Draft → Published
- [ ] Switch AI Concierge to live
- [ ] **Brief Dustin** — 90-minute session covering: daily GHL operations, moving opportunities manually, using the inbox, reviewing AI suggestions, responding to notifications, reading dashboards
- [ ] **Hand off a "Dustin's Daily Playbook"** — one-pager covering the 5 things he should check every morning (new leads, bookings today, stale opps, payments due, AI suggestions queue)
- [ ] Celebrate. This is a real system.

---

## Post-launch — Week 2

- [ ] Monitor every workflow for failures (Automation → Workflows → Enrollment History)
- [ ] Review every AI conversation from the first week with Dustin
- [ ] Tune response times, tune timing delays, adjust based on live behavior
- [ ] Begin Phase 5 planning (Voice AI, reputation, contracts, etc.)

---

## Drive-along session plan (when Maurice and Dustin sit together)

If we're driving the browser via Claude in Chrome, here's the efficient session structure:

**Session 1 (90 min) — Phase 1 complete**
- Run the API script together (Sections 1–4)
- Manually configure calendars
- Test-book to verify

**Session 2 (90 min) — Phase 2 templates + WF1-4**
- Paste all templates
- Build WF1 together; WF2-4 follow same pattern (Maurice builds, Dustin watches and critiques copy as it goes)

**Session 3 (90 min) — Phase 2 finish + Phase 3 start**
- Payment workflows + notifications
- Start WF5, WF7

**Session 4 (2 hours) — AI Concierge + testing marathon**
- Configure AI
- Run 20 test conversations LIVE with Dustin in the room — he tunes voice as we go

**Session 5 (90 min) — Retention + go-live**
- WF10-13
- Full QA
- Switch to published
- Dustin onboarding

Total: ~8 hours of drive-along time across 5 sessions, distributed across 2 weeks.
