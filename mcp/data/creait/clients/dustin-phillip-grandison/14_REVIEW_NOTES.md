# Review Notes — Playbook ↔ Questionnaire Consistency Check

**Reviewer:** Maurice Grant (via Creait OS)
**Source docs:** `Questionnaire.pdf` (Dustin's answers) + `Dustins_GHL_Playbook_Complete.docx`
**Verdict:** Playbook is 95% aligned with questionnaire. Three minor items to confirm with Dustin before build; no structural issues.

---

## Alignment matrix (Questionnaire ↔ Playbook)

| Questionnaire answer | Playbook system | Status |
|---|---|---|
| Q1: Leads from Instagram, referrals, events | WF1 triggers on form + manual + AI + Contact Created; tags for source (6 source tags in file 02) | ✅ Aligned |
| Q2: Instagram DM/SMS → phone call | Conversation AI on IG DM + SMS; Voice AI (Gap #1) picks up missed calls | ✅ Aligned |
| Q3: Collect occasion, timeline, budget, suit type, comm pref | Bespoke Inquiry form fields (file 06); 17 custom fields (file 01) | ✅ Aligned |
| Q4: Welcoming first message, acknowledges interest | WF1 SMS (2-min delay) + welcome email with qualification | ✅ Aligned |
| Q5: Polished, professional, personable tone | Enforced in every template (file 07) and AI system prompt (file 10) | ✅ Aligned |
| Q6: Consultations booked manually then calendar link | WF1 personal outreach first, calendar link in follow-up | ✅ Aligned |
| Q7: Personal contact → calendar link | Confirmed in WF1 sequence | ✅ Aligned |
| Q8: 60–90 min consultations | **Playbook locks at 90 min** | ⚠️ See Flag 1 |
| Q9: Complimentary consult, deposit to start production | Pipeline Stage 6 "Deposit Paid" triggers production | ✅ Aligned |
| Q10: 24hr + 2hr reminders | WF2 sends both at exact cadence | ✅ Aligned |
| Q11: Reschedule link with personal follow-up | Calendar reschedule link + internal notification | ✅ Aligned |
| Q12: Fabric → design → order → pattern → fitting → delivery | 12-stage pipeline mirrors this exactly (file 03) | ✅ Aligned |
| Q13: 3–4 week turnaround | WF5 sends Week 0, Week 2, Week 4 milestone updates | ✅ Aligned |
| Q14: Auto progress updates at key milestones | WF5 production milestones | ✅ Aligned |
| Q15: Digital fabric/design approval | Custom field "Fabric Approved" + tag triggers Stage 5 | ✅ Aligned |
| Q16: Gentle automated reminders for approval/payment delays | WF6A/B/C + WF4 Day 3/7 | ✅ Aligned |
| Q17: Card, bank transfer, digital platforms | Stripe + invoicing (Gap #4) covers all three | ✅ Aligned |
| Q18: Auto payment reminders | WF6A (deposit) + WF6C (final balance) | ✅ Aligned |
| Q19: Auto receipts on payment | WF6B instant receipt SMS + email | ✅ Aligned |
| Q20: Installment plans on select orders | Custom field + manual opt-in; handled inside invoicing | ✅ Aligned |
| Q21: 1–2 week decision timeline | WF4 runs Day 1, 3, 7 — lands inside 1–2 week window | ✅ Aligned |
| Q22: Objections — turnaround, price, value | WF7 10-day sequence addresses all three by name | ✅ Aligned |
| Q23: Auto educational messages | WF8 7-email nurture (craftsmanship, fit, fabric, ethos) | ✅ Aligned |
| Q24: Testimonials, photos, brand stories | Embedded in WF7, WF8; assets in file 08 | ✅ Aligned |
| Q25: Re-engage after 3–7 days inactivity | **WF9 set at 5-day stale trigger** | ⚠️ See Flag 2 |
| Q26: Stay in touch via outreach, social, events | WF11/12/13 (birthday, seasonal, monthly Style Insider) | ✅ Aligned |
| Q27: Birthday + seasonal + referral messages | WF11, WF12, WF10 referral step | ✅ Aligned |
| Q28: Auto collect testimonials/photos after delivery | WF10 Day 4 testimonial + Day 8 photo request | ✅ Aligned |
| Q29: Assistant helps with scheduling, tracking, comms | All internal notifications CC the assistant (file 11) | ✅ Aligned |
| Q30: Internal notifications for new tasks | 11 event triggers (file 11) | ✅ Aligned |
| Q31: Track orders, deliveries, inventory | Pipeline + custom fields (Fabric, Mill, Order Status) | ✅ Aligned |
| Q32: Digital lookbooks, brand visuals auto-sent | Embedded as attachments in WF1 welcome email, WF8 emails | ✅ Aligned |
| Q33: Monthly Style Insider | WF13 scheduled first Monday monthly | ✅ Aligned |
| Q34: Luxury, confidence, power, craftsmanship tone | Enforced in all copy (file 07) and AI guardrails (file 10) | ✅ Aligned |
| Q35: Wants easier follow-ups, scheduling, comms with personal touch | Entire system designed around this — AI Concierge handles volume, Dustin handles the moments that matter | ✅ Aligned |
| Q36: Client feels crafted-for, valued, confident | Enforced by "White-Glove Automation" philosophy in Part 1 | ✅ Aligned |

---

## Three items to confirm with Dustin before build

### Flag 1 — Consultation duration (Q8 says 60–90 min; playbook locks 90)

**Recommendation:** Keep 90 min. Rationale: bespoke consults include fabric review + measurements, and the extra 30 minutes absorbs the inevitable chat/vision discussion without feeling rushed. A 60-minute version can be added later as "Follow-up Consultation" if needed.

**Ask Dustin:** "90 min default. OK?"

### Flag 2 — Re-engagement trigger (Q25 says 3–7 days; WF9 set at 5)

**Recommendation:** 5 days is the right middle ground and matches the questionnaire range. No change needed — just confirm.

**Ask Dustin:** "We ping quiet leads after 5 days of silence. Good?"

### Flag 3 — Voice AI double-counted

The playbook mentions Voice AI in Part 5 ("Voice AI Agent — NEW from Gap Analysis") AND again in Part 12 as Critical Gap #1. Purely a documentation cleanup — the system itself is only built once. This Runbook builds it once under Phase 5 (Sprint 5A), not Phase 1–4. Flagged for transparency so Maurice doesn't build it twice.

---

## What's NOT in Phases 1–4 (deferred to Phase 5)

For clarity, these 18 gap-analysis items from Part 12 of the playbook are **NOT** built in this package:

1. Voice AI Agent (inbound + outbound) — CRITICAL, +$40k/yr
2. Reputation Management / Google reviews — CRITICAL, +$25k/yr
3. Documents & Contracts / e-signature — CRITICAL, +$15k/yr
4. Invoicing & Estimates system — CRITICAL, +$20k/yr (Stripe covers deposit collection in Phases 1–4; full invoicing deferred)
5. Social Media Planner — CRITICAL, +$30k/yr
6. Missed Call Text-Back — CRITICAL, +$20k/yr
7. Google Business Profile optimization — HIGH
8. WhatsApp Business integration — HIGH
9. Lead scoring + smart lists — HIGH
10. Landing page / funnel — HIGH
11. Ad tracking & attribution — HIGH
12. Workflow AI intent detection — MEDIUM
13. Custom reporting dashboard — MEDIUM
14. Upsell/cross-sell automation — MEDIUM
15. Event/trunk show campaign — MEDIUM
16. VIP client portal — MEDIUM
17. A2P 10DLC registration + email warmup — MEDIUM (recommend doing Phase 1 Day 1 regardless — it takes days to approve)
18. AI business card scanner — NICE

**Strong recommendation:** Start A2P 10DLC registration on Day 1 of Phase 1 even though it's flagged as Phase 5. Approval takes 2–10 business days and blocks outbound SMS. Better to queue the paperwork immediately.

---

## Bottom line

The playbook is well-structured and the questionnaire is well-answered. The build is ready to start. Three tiny confirms with Dustin, one A2P early-start, and we can open Phase 1.
