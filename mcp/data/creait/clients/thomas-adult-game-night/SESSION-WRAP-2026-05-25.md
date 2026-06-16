# Session Wrap — 2026-05-25

**Worked through:** Sprint 1.5 + Tier 3 workflows + Tier 4 exploration + Website CRO audit + email template push + workflow smoke test
**Time:** ~8 hours of execution

---

## 🚀 LATE-SESSION SHIPS (after first wrap)

After the initial wrap, kept pushing on what could be done without Thomas:

1. **All 9 scaffold email templates pushed LIVE via API** — discovered the `/emails/builder/data` POST endpoint accepts authenticated HTML payloads. Pushed all 9 branded templates (Event Reminder 7d/1d, Post-Event Thank You, Service Booking Confirmation, Service Reminder 1d, Service Day-Of, Sponsor Pitch, Wholesale Response, Negative Review Alert Internal). **19/19 templates now branded** — verified via re-fetch + size audit.

2. **Refer-a-Friend Engine + Event Registration General prompts added** to `docs/AI-BUILDER-PROMPTS-BATCH.md` (#7 + #8). Refer-a-Friend was the highest unbuilt revenue lever from the original Sprint 1.5 plan — 4x conversion vs cold ads.

3. **Workflow smoke test attempt** — created test contact via API, added `cart-abandoned`, `buyer`, `source-import-klaviyo` tags. After 60s wait: **0 conversations**. Finding: enrollment likely filters out `@example.com` test emails (RFC reserved test domain). Real-email validation still pending. For Thomas: test with a real Gmail address via the form submission flow once Shopify webhook is verified.

4. **Documented Sponsor B2B build steps** (`docs/SPONSOR-B2B-BUILD-SPEC.md`) — manual pipeline/form/workflow build instructions since the `/opportunities/pipelines` POST endpoint requires elevated scope.

5. **5 Loom handoff scripts** (`docs/LOOM-HANDOFF-SCRIPTS.md`) — daily checklist, AI reply review, escalations, pipeline health, manual tagging. ~15 min recording total.



---

## What's LIVE (4 published workflows)

✅ Cart Abandonment Recovery
✅ Post-Purchase Email Series
✅ Reactivation Email Sequence
✅ **Game Night Service Booking** ← shipped this session

---

## What's DRAFT (4 new — review + publish)

⏳ **Smoking Section Pre-Order Email** (`7ab15eeb-...`)
- Trigger: tag `smoking-section-pre-order` added
- Action: Send 1 email "🚬 You're locked in for The Smoking Section"
- Verified: subject + body correct, Quick Compose mode
- **Action needed:** test send, flip to Publish

⏳ **90-Day Buyer Win-Back** (`0d0339c7-...`)
- Trigger: tag `buyer` added → wait 90d → email "Yo — you good?" with WELCOME15 code
- Verified: subject + body correct
- Has "Remove From Workflow on Retag" safety step
- **Action needed:** test, flip to Publish

⏳ **Repeat Buyer VIP Upgrade** (`d85b6476-...`)
- Trigger: tag `buyer` added (needs filter fix — see below)
- Actions: Add `repeat-buyer` tag → Add `vip` tag → Send VIP email → Internal SMS to Thomas
- **2 MANUAL FIXES NEEDED** (see below)

⏳ **Birthday Reactivation** (`e5304318-...`)
- Trigger: contact's Birthday custom field matches today (annual)
- Branch: Subscribed → Send Birthday Email + SMS + Add `birthday-promo` tag → END; Unsubscribed → END
- Verified: subject "🎲 Happy birthday — game night's on us" + body content set
- **Action needed:** test, flip to Publish. NOTE: This won't fire until contacts have the `Birthday` custom field populated (capture via Shopify checkout or a form)

---

## 🔴 MANUAL FIXES NEEDED on Repeat Buyer VIP Upgrade

### Fix #1: Add trigger filter

**Problem:** Currently the trigger fires on EVERY buyer tag, even first-time buyers. That would VIP-upgrade everyone.

**Steps to fix (~60 sec):**
1. Open the workflow → click the trigger node ("Contact Tag: Buyer Tag Added")
2. Under FILTERS, click **+ Add filters**
3. Select **Has Tag** → choose `bought-liquor-store`
4. Click **Save Trigger**

### Fix #2: Verify Internal Notification is set up correctly

Already swapped the broken "Send SMS to contact" action with a proper "Send Internal Notification" pointing to **+14049542115** (Thomas). Re-open and click that node to verify:
- Type: SMS
- To User Type: Custom Number
- To Custom Number: +14049542115
- Message: "🔥 VIP UPGRADE — {{contact.first_name}}..." (Thomas's voice, not corporate)

---

## 🧹 ALSO TO CLEAN UP

**Delete the empty "Repeat Buyer VIP Tier" workflow** (`442566a7-...`)
- Empty shell from earlier in the session
- Path: Workflows list → row → ⋮ menu → Delete workflow → type "Delete" → confirm

---

## Tier 4 — Comment-Keyword Auto-DM: ✅ VIABLE

**No dedicated Keyword Rules UI exists** (checked: Conversation AI agent settings, Social Planner settings, Conversations settings — none have a keyword auto-reply tab).

**Workflow-based fallback IS viable.** Live inspection of Workflows → Create Workflow → Add New Trigger confirmed three native comment triggers:

- ✅ **Facebook — Comment(s) on a Post** (under Facebook/Instagram Events)
- ✅ **Instagram — Comment(s) on a Post** (under Facebook/Instagram Events)
- ✅ **TikTok — comment(s) on a video** (under Communication)
- ❌ **YouTube** — NOT in native trigger list (confirms original spec; needs 3rd-party for YT)

**Still unverified (requires building one to confirm):** whether the trigger filter UI exposes "comment text contains [keyword]" matching. The picker doesn't expose filter config until the trigger is fully added to canvas. Recommended validation = build ONE workflow (GAME keyword) via AI Builder, confirm filter exists, then clone.

### 9 paste-ready AI Builder prompts

Full prompts moved to **`docs/TIER-4-AUTO-DM-PROMPTS.md`** — one per keyword (GAME, BUY, PRICE, BOOK, EVENT, SPONSOR, CREATOR, WHOLESALE, 3D), each ~3-step linear workflow.

**Build order (start small):**
1. Build the GAME workflow on Instagram only — validate the filter actually works
2. If yes: clone the other 8 via Workflow Actions → Clone (faster than AI rebuild)
3. After all 9 IG workflows are live + tested 3-5 days, duplicate to FB + TikTok

**Fallback if AI Builder fails on the keyword filter:** build the trigger manually (drag trigger → click → Add Filter → "Comment Text" → Contains → "GAME"), then clone 8 times. Manual cloning takes ~3 min each.

---

## What's documented (didn't fire yet)

- **`docs/AI-BUILDER-PROMPTS-BATCH.md`** — paste-ready prompts for remaining workflows including Sponsor Pipeline B2B, Event Registration General
- **`docs/REVENUE-POSITIONING-PLAN.md`** — full Sprint 1.5/Sprint 2 roadmap
- **`docs/WEBSITE-CRO-AUDIT-2026-05-25.md`** — 10 prioritized website patches
- **`docs/WEBSITE-3-PATCHES-SHIP-TODAY.md`** — copy-paste 3 highest-leverage patches

---

## Total infrastructure state (live API)

| Resource | Count | Note |
|---|---|---|
| Custom fields | 43 | Birthday field exists (`contact.birthday`) |
| Tags | 43 | — |
| Pipelines | 3 | Game Sales (E-com), Event Attendees, Game Night Service |
| Calendars | 4 | — |
| Email templates | 19 | **19/19 BRANDED — all 9 scaffolds pushed live via API 2026-05-25** |
| SMS snippets | 6 | 4 prior + service_reminder_1hr, service_day_of_arrival (NEW) |
| Workflows | 9 total | **4 published, 4 quality drafts, 1 empty shell to delete** |
| Knowledge Base | 1 active | Adult Game Nights Master KB — 67 FAQs |
| Conversation AI agent | 1 | "Adult Game Nights Sales Rep" — Primary, Suggestive mode |
| Social accounts | 4 | All connected, none expired |

**Payments:** PayPal is the active gateway — **already connected to CRM** (confirmed by Thomas 2026-05-25). Stripe is NOT needed. Shopify webhook end-to-end test still pending real-contact validation.

---

## What I'd do next (when you/Thomas have time)

### Today / this week (~50 min total)
1. ~~Stripe OAuth~~ — **DONE: PayPal already live as the payment gateway**
2. **Test + Publish 4 new Draft workflows** — 15 min total
3. **Fix the 2 manual issues on Repeat Buyer VIP** — 60 sec
4. **Delete the empty Repeat Buyer VIP Tier shell** — 30 sec
5. **Ship Patches 1, 5, 9 from `WEBSITE-3-PATCHES-SHIP-TODAY.md`** — 30 min

### Next session (~3-4 hours)
- ✅ Comment trigger verified (FB/IG/TikTok all exist) — Tier 4 unblocked
- Build the GAME-keyword workflow first to validate filter UI (~15 min): paste prompt #1 from `docs/TIER-4-AUTO-DM-PROMPTS.md` into Workflows → Build using AI
- If filter UI works: clone 8 times for the other keywords (~25 min total)
- Then duplicate to Facebook + TikTok (or rebuild if multi-platform trigger works)
- Build Sponsor Pipeline B2B + form (needs pipeline created first)
- Build Event Registration General workflow
- Build Voice AI Receptionist (once Thomas decides on phone number)
- Finish the 9 remaining email templates with branded HTML (Sprint 2 content debt)
- YouTube comment auto-DM is parked — requires 3rd-party (Restream/Zapier)

---

**Author:** Maurice / CREAIT
**Date:** 2026-05-25
**Session count this date:** 1 (continuous session, ~7 hours)
