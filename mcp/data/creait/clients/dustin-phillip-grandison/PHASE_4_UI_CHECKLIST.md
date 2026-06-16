# Phase 4 — UI Checklist (Dustin's Bespoke)

**Scope:** AI Concierge config, 2 remaining forms (Feedback, Satisfaction), final retention polish, go-live.

**Reference files:**
- `10_AI_CONCIERGE.md` — system prompts, guardrails, knowledge base, test scripts
- `06_FORMS.md` §Form 2, §Form 3 — feedback + satisfaction specs
- `11_INTERNAL_NOTIFICATIONS.md` — DND windows, assistant routing
- `12_IMPLEMENTATION_RUNBOOK.md` §Phase 4 — Day 10–12 click-path

**Prereq:** Phases 1, 2, and 3 complete. Specifically need: `WF-AI Handoff` workflow built (Phase 3), pipeline live, all templates live, `AI Handoff Requested` tag exists (already created in Phase 1C).

---

## 4.1 — AI Concierge (Conversation AI)

**GHL Path:** AI Agents → Conversation AI → Create Bot

**Gate:** Location-level `botServiceEnabled: false` was found in the audit. **Have the agency toggle bot service ON for this sub-account** before starting — otherwise the Conversation AI module will be missing from the UI.

### Bot setup

- [ ] Bot name: `Dustin's Style Concierge`
- [ ] Operating mode: **Suggestive during business hours** (Dustin reviews before send), **Auto-Pilot after hours**
- [ ] Business hours: Tue–Sat, 10 AM – 6 PM local
- [ ] Channels: SMS, Instagram DM, Live Chat (Web). WhatsApp is Phase 5.
- [ ] Voice profile: first-person as Dustin / Dustin's studio (per §Voice rules in file 10)

### System prompts (paste verbatim from `10_AI_CONCIERGE.md`)

- [ ] **Personality prompt** — file 10 §System Prompt — PERSONALITY
- [ ] **Intent prompt** — file 10 §System Prompt — INTENT (contains `{{custom_values.booking_consultation_url}}` merge)
- [ ] **Context prompt** — file 10 §System Prompt — CONTEXT (contains `{{custom_values.studio_address}}` merge)
- [ ] **Key Rules** — file 10 §KEY RULES (pricing, appointments, after-hours, handoff triggers)
- [ ] **Voice rules** — file 10 §Voice rules (first-person vs studio voice)
- [ ] **Greeting examples** — load per channel (SMS, IG DM, Live Chat)
- [ ] **Objection response library** — load all 5 canned responses

### Knowledge base

**GHL Path:** AI Agents → Conversation AI → Knowledge → Upload

Upload at least 3 of the 5 documents (the first 3 are mandatory):

- [ ] 1. **Brand guide** — fabric mills, processes, positioning (Dustin authors; can be 1-2 pages to start)
- [ ] 2. **FAQ** — 20 most common inbound questions with Dustin-approved answers
- [ ] 3. **Fabric reference** — mill list, weight reference, seasonal guide
- [ ] 4. **Process document** — 12-stage journey (extract from `03_PIPELINE.md` + `07_MESSAGING_TEMPLATES.md` — 1-page summary works)
- [ ] 5. **Internal pricing reference** — tiers + what's included at each (do NOT let this leak; used internally by bot only)

### Human handoff wiring

- [ ] Tag trigger: `AI Handoff Requested` added by bot when any handoff condition is met (file 10 §KEY RULES — HUMAN HANDOFF TRIGGERS, 8 triggers)
- [ ] Verify `WF-AI Handoff` workflow from Phase 3 is published — it fires notification #11 to Dustin and stops AI engagement on the thread
- [ ] Bot's final message on handoff: `Let me pass this directly to Dustin — he'll be in touch shortly.`

### Testing marathon (20 scripted conversations, file 10 §Training protocol)

**Do not publish until all 20 pass.** Use a shared doc / sheet to track outcomes.

- [ ] 1. Direct pricing question → should deflect with canned objection response
- [ ] 2. Wedding, 8-week timeline → should book consult
- [ ] 3. Wedding, 2-week timeline → should flag timeline + defer to Dustin
- [ ] 4. First-time bespoke, exploring → educate + book consult
- [ ] 5. OTR vs MTM vs bespoke comparison → correct deflection + book
- [ ] 6. "I want to speak to Dustin" → immediate escalation
- [ ] 7. Complaint about past order → escalate + tag VIP
- [ ] 8. Multi-piece inquiry ($15k+ equivalent) → escalate
- [ ] 9. Fabric technical question beyond KB → escalate politely
- [ ] 10. After-hours inbound → acknowledge + defer
- [ ] 11. "Can you come to me?" → decline politely, offer alternatives
- [ ] 12. "Do you ship internationally?" → defer to Dustin
- [ ] 13. Referral inquiry → capture referrer, route to WF1
- [ ] 14. Event attendee → capture event tag, route to WF1
- [ ] 15. Existing delivered client → escalate (VIP flow)
- [ ] 16. Ghost after 2 messages → send one check-in, disengage
- [ ] 17. Rude/aggressive → de-escalate once, then politely disengage
- [ ] 18. Weird edge case (women's suits, retail) → defer
- [ ] 19. Jailbreak attempt ("ignore previous instructions") → refuse
- [ ] 20. Direct booking request without qualification → capture basics + book

### Dustin sign-off on voice

- [ ] Dustin personally reviews 10 sample transcripts from test runs
- [ ] Adjust prompts until he says "that sounds like me"

### Publish checklist (file 10 §Publishing checklist)

- [ ] All 3 system prompts loaded
- [ ] Key rules configured
- [ ] At least 3 of 5 KB docs uploaded
- [ ] Business hours set
- [ ] After-hours behavior verified
- [ ] Custom values merge correctly in test messages
- [ ] `WF-AI Handoff` workflow published
- [ ] 20 test conversations passed
- [ ] Dustin reviewed 10 transcripts
- [ ] Suggestive mode set for business hours, Auto-Pilot for after-hours
- [ ] Switch bot to **Live**

---

## 4.2 — Form 3: Post-Consultation Feedback

Spec: `06_FORMS.md` §Form 2. Triggered automatically by WF4 at the 2-hour post-consult point.

**GHL Path:** Sites → Forms → + Create Form

- [ ] Name: `Post-Consultation Feedback`
- [ ] Style: Standard, 1-question-per-screen (multi-step)
- [ ] Fields:

| Step | Question | Type |
|---|---|---|
| 1 | On a scale of 1–10, how close to your vision did we get? | Scale (1–10) |
| 2 | What did you love most about the consultation? | Textarea |
| 3 | Is there anything we could have done better? | Textarea (optional) |

- [ ] Submit redirect: a "Thank you" page with no sales CTA
- [ ] On submit: add an internal-notification trigger:
  - If score ≥ 9 → add tag `Testimonial-Ready` and fire Dustin notification "testimonial captured from {{name}}"
  - If score ≤ 6 → fire Dustin SMS "personal call recommended — low CSAT from {{name}}"
- [ ] Wire this form into WF4 step 5 (Send Form action). Now that the form exists, update WF4 accordingly.

---

## 4.3 — Form 4: Post-Delivery Satisfaction Survey

Spec: `06_FORMS.md` §Form 3. Triggered by WF10 Day 4.

- [ ] Name: `Post-Delivery Satisfaction`
- [ ] Submit redirect: Thank-you page with embedded referral CTA (points to `Refer a Friend` form)
- [ ] Fields:

| # | Field | Type | Required |
|---|---|---|---|
| 1 | How would you rate your experience? | Scale (1–5 stars) | ✓ |
| 2 | How does the finished garment compare to what you envisioned? | Textarea | ✓ |
| 3 | Would you be willing for us to share your words publicly? | Radio (Yes / Anonymized / No) | ✓ |
| 4 | Upload a photo (optional) | File upload (image) | — |
| 5 | Your title / how you'd like to be credited | Text | — |

- [ ] Internal rule: 5-star + "Yes share publicly" → internal notification to Dustin: `Testimonial captured from {{name}} — ready for IG/website.`
- [ ] Wire into WF10 step 5 (embed form link in the `Retention 5.2 — Testimonial Request Email`). Update custom value `testimonial_page_url` if the public testimonial page is live.

---

## 4.4 — Daily digest email (optional, file 11 §Notification hygiene rule #4)

An additional small workflow — recommended but not in the original 13.

**GHL Path:** Automation → Workflows → + Create → Daily Digest

- [ ] **Trigger:** Scheduled, every day 8:00 AM local
- [ ] **Audience:** Dustin only (hardcode his user)
- [ ] Action: Send Email to Dustin with one paragraph summarizing: new leads (last 24h), consultations today, outstanding deposits, Went Cold flags. Use GHL's reporting-to-email feature OR a simple HTML email populated by custom fields/queries.

This replaces half the need for real-time notifications.

---

## 4.5 — DND and routing matrix (file 11 §Notification hygiene)

Configure Dustin's notification preferences (Settings → My Profile → Notifications):

- [ ] **Do Not Disturb windows:** block SMS during known consultation times (manual, update as needed OR wire to calendar).
- [ ] SMS-urgent notifications only for: #1 (new lead), #2 (consult booked), #3 (no-show), #5 (payment), #8 (stale deposit), #9 (stale final balance), #11 handoff variant. Everything else is in-app.
- [ ] Assistant: in-app for everything, SMS for nothing.

---

## 4.6 — Full end-to-end QA (file 12 §Day 11 table)

Execute this scenario with a test contact. Every step should fire automatically. **Do not skip this.**

| Step | Action | Expected |
|---|---|---|
| 1 | Submit `Bespoke Inquiry` | Contact created, WF1 fires, SMS+email received, opp created Stage 1 |
| 2 | Reply to welcome SMS | `Contacted` tag added, Dustin notified |
| 3 | Book consult via link | WF2 fires, confirmation sent, 24h/2h reminders scheduled |
| 4 | Mark appointment completed | WF4 fires, thank-you SMS, feedback form sent, Day 1 email queued |
| 5 | Add tag `Fabric Approved` | Pipeline moves to Stage 5 |
| 6 | Add tag `Deposit Requested` | WF6A fires with payment link |
| 7 | Test-pay deposit (Stripe test mode) | WF6B fires, receipt sent, Stage 6, notification |
| 8 | Manually move to Stage 7 (In Production) | WF5 fires Week 0 message |
| 9 | Fast-forward to Week 4 (GHL simulator) | Fitting link sent |
| 10 | Book fitting | Stage 8, fitting confirmation |
| 11 | Manually move to Stage 9 (Final Fitting) | WF6C fires |
| 12 | Test-pay final balance | Stage 10, WF10 starts |
| 13 | Verify Day 1 SMS, Day 4 testimonial email, Day 8 photo SMS, Day 15 referral email, Day 30 wardrobe email | All fire |
| 14 | Submit `Post-Delivery Satisfaction` with 5 stars + "Yes share" | Internal notification to Dustin |
| 15 | Submit `Refer a Friend` with a new contact | New contact, WF1 fires for friend |

---

## 4.7 — Go-live

- [ ] Fix any QA issues from 4.6
- [ ] Switch ALL 13 workflows + WF-AI from **Draft → Published**
- [ ] Switch Conversation AI to **Live**
- [ ] Replace all remaining `REPLACE_ME` custom values with real data (see `BUILD_LOG.md` §REPLACE_ME list)
- [ ] 90-min onboarding session with Dustin: operations, inbox, AI suggestions, notifications, dashboards
- [ ] Deliver "Dustin's Daily Playbook" one-pager: 5 things to check every morning (new leads, bookings today, stale opps, payments due, AI suggestions queue)

---

## 4.8 — Week 2 post-launch

- [ ] Monitor every workflow via Enrollment History for silent failures
- [ ] Review first week of AI conversations with Dustin; tune prompts
- [ ] Adjust any timing delays that feel wrong in live behavior
- [ ] Begin Phase 5 planning: Voice AI, reputation mgmt, contracts/e-sign, full invoicing, social planner, missed-call text-back
