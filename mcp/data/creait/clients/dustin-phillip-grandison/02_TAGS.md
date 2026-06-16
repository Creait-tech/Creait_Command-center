# Tags — 33 tags in 5 groups

**GHL Path:** Settings → Tags → + Add Tag (or bulk-create via `13_api-bulk-import.js`)

Tags drive workflow logic. Keep them in title case for readability in smart lists.

---

## Group 1 — Lead Status (10 tags)

| Tag | Applied When | Removed When |
|---|---|---|
| New Lead | Contact created from any source | Moved to Contacted or Qualified |
| Contacted | Dustin replies OR AI has first real exchange | Moved to Qualified |
| Qualified | Occasion + timeline + budget captured | Moved to Ready to Book |
| Ready to Book | Consultation calendar link sent | Appointment booked |
| Hot | Booked consult OR engaged on 3+ messages | Deposit paid |
| Warm | Booked but pre-consult, or engaged 2 messages | Hot or Cold |
| Cold | No reply 5 days | Re-engaged |
| Went Cold | No reply after WF9 full sequence | Manually revived |
| Objection - Nurture | Raised price/timeline/value objection | Deposit paid |
| No-Show | Appointment missed | Rescheduled |

---

## Group 2 — Source (6 tags)

| Tag | Applied When |
|---|---|
| Source: Instagram DM | Inbound from IG DM (manual or AI-detected) |
| Source: Referral | Came through Refer-a-Friend form or tagged manually |
| Source: Event | Captured at trunk show / networking event |
| Source: Paid Ad | UTM or ad form submission |
| Source: Website | Form fill on landing page |
| Source: Brand Collab | Referred by collaboration partner |

---

## Group 3 — Workflow (7 tags)

These are control tags that start/stop workflows. They're applied by workflows, not by humans.

| Tag | Workflow that adds it | Workflow that acts on it |
|---|---|---|
| Nurture Sequence | WF1 (if no reply) | WF8 enroll |
| Re-engagement | System (5-day stale) | WF9 enroll |
| Deposit Requested | WF4 completion | WF6A enroll |
| Deposit Paid | Payment received / manual | WF6B enroll |
| Final Balance Requested | Pipeline → Final Fitting stage | WF6C enroll |
| Final Balance Paid | Payment received | Pipeline → Delivered |
| AI Handoff Requested | Conversation AI trigger | Internal notification + pause AI |

---

## Group 4 — Product (5 tags)

| Tag | Applied When |
|---|---|
| Product: Wedding Suit | Occasion = Wedding captured on form |
| Product: Business Suit | Occasion = Business |
| Product: Tuxedo / Black-tie | Occasion = Black-tie Event |
| Product: Multi-piece | Order includes 2+ garments |
| Product: Accessories | Shirt / tie / pocket square add-ons |

---

## Group 5 — Retention (5 tags)

| Tag | Applied When | Unlocks |
|---|---|---|
| Delivered | Pipeline stage → Delivered | WF10 enrollment |
| VIP Client | 2+ commissions OR $15k+ LTV | Priority routing, Birthday upgrade, seasonal previews |
| Repeat Client | Back for commission #2+ | Fast-track pipeline (skip pattern-creation steps) |
| Birthday Opt-In | Provided DOB on inquiry form | WF11 enroll |
| Style Insider Subscriber | Consented to monthly newsletter | WF13 enroll |

---

## Tagging rules for workflow builders

1. **Never add two Lead Status tags at once.** When moving to Contacted, strip New Lead. When moving to Qualified, strip Contacted. This is how smart lists stay clean.
2. **Source tags are permanent** — never remove. Even if a contact converts, we keep attribution for reporting.
3. **Workflow tags self-clean** — the workflow that responds to the tag should remove it once action is complete.
4. **Product tags stack** — a client can have Product: Wedding Suit AND Product: Multi-piece.
5. **VIP is sticky** — once VIP, always VIP. Even if a client goes quiet, the tag stays.
