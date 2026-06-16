# Adult Game Nights — Revenue Positioning Plan (Sprint 1.5 → Sprint 2)

**Client:** Thomas Gray — Adult Game Nights / 2wenty58 Entertainment
**Owner:** Maurice "Reece" Grant (CREAIT)
**Date:** 2026-05-12
**Location:** CreateOS `1uN6mnlvX9JQ5QvrLewp`
**Destination on approval:** Copy this file to `/Users/reecebyob/creait/Creait Clients/Thomas- Adult Game Night/adult-game-nights-build/docs/REVENUE-POSITIONING-PLAN.md` as **Step 0** (per the user's stated preference to keep it with the rest of the project docs). Plan mode only allows editing this file in `~/.claude/plans/` — the copy happens at execution time.

---

## Context

Sprint 1 is roughly 70% complete: data infrastructure, branded content, 4 published workflows, the Conversation AI Sales Rep, all 4 social channels live, and **PayPal connected as the payment gateway**. The Shopify→CreateOS webhook path still hasn't been verified end-to-end against a real-email contact. On top of that, four of the eight originally-specced workflows are still missing — most notably the Game Night Service Booking flow, which the website audit estimates as a $30K+/yr unlock.

This plan does three things, in order:

1. **Un-block real revenue today** — Stripe + Shopify webhook + clean up broken drafts.
2. **Finish what Maurice sold him** — the 4 missing workflows + Voice AI Receptionist + Reviews AI.
3. **Layer in 4-5 high-revenue workflows the original spec missed** — Win-Back, Repeat Buyer VIP, Referral Engine, Birthday Reactivation, Smoking Section Pre-Order Drip.

Everything below is ranked by direct $$ impact, not by "what's tidiest." The goal is to get Thomas making money first; cleanup and polish come after. The user's North Star (per `handoff-package/30-60-90-roadmap.md`) is **$15K/mo by Day 90**. This plan is what gets us there.

---

## Current State Audit (live API, 2026-05-12)

| Layer | What's live | What's missing or broken |
|---|---|---|
| Custom fields | 43 | — |
| Tags | 43 | Need `birth_date` custom field for Birthday workflow (Tier 3) |
| Custom values | 8 (incl. PLAY10 discount code, business phone, business email, app download URLs) | — |
| Pipelines | 3 — Game Sales 7-stage, Event Attendees 3-stage, default **Marketing Pipeline** (unused, DELETE) | Game Night Service pipeline (4 stages), Sponsorship/B2B pipeline (4 stages) |
| Calendars | 4 (Thomas's, General Inq, Sponsorship, Game Night Service Booking) | — |
| Email templates | 19 branded HTML | 1 missing branded body: 3D Kit Upsell (scaffold only) |
| Workflows | 4 published: Cart Abandonment, Post-Purchase, Reactivation, **Escalation SMS Notification (broken — sends to contact not Thomas)** | 4 specced but unbuilt: Service Booking, Event Reg General, Sponsor Pipeline, Review Request Automation |
| Knowledge Base | 2 — Master KB `y7rHRbRkznkFc8wTC8tk` and default empty KB (DELETE). **API reports 0 FAQs — UI spot-check required** | KB consolidation |
| Products | 2 — Liquor Store game `69ef8758...` ($34.04), Security Deposit `6a029bf7...`. Both typed `DIGITAL` (platform limitation per earlier probe) | — |
| Social accounts | 4 active, **none expired** (FB, IG, TikTok, YouTube) | — |
| Conversation AI agent | `Adult Game Nights Sales Rep` (`Vt8AIbHsAuIThtDZ9VXi`), Suggestive mode, 5 channels (SMS/IG/FB/Chat Widget/Live Chat), Master KB linked, voice prompt in Trigger 1, Primary Bot ✅ | After 7-14 days of Suggestive testing, flip to Auto-Pilot; tag-on-intent automation pending |
| Voice AI Receptionist | Not built | Full spec at `config/voice-ai-agent.json` — phone number + greeting + 4 goals |
| Reviews AI | Not built (gated on GMB OAuth) | Spec at `config/reviews-ai.json` — 5⭐ auto-reply, 4⭐ soft ask, ≤3⭐ alert Thomas |
| ~~Stripe~~ | **NOT USED — Thomas's gateway is PayPal** | — |
| PayPal | ✅ **Connected to CRM (2026-05-25 confirmed)** | Active payment gateway — feeds payment events into workflows |
| Shopify→CreateOS webhook | Status unknown | Verify `cart-abandoned` + `buyer` tags actually fire from Shopify events |
| Google My Business | Not connected | Gates Reviews AI |
| App developer webhook | Not provided | Gates App Lobby Capture workflow (Sprint 2) |

---

## TIER 1 — Un-block revenue TODAY (~90 min)

Nothing else in Sprint 1 matters if Thomas can't take a dollar. These un-block the blockers.

### 1.1 — Connect Stripe (5-10 min)
- **Path:** CreateOS → Settings → Integrations → Stripe → Connect with OAuth.
- **Prereq:** Thomas's existing Stripe login.
- **Verify:** `curl -H "Authorization: Bearer ${GHL_PIT}" -H "Version: 2021-07-28" "https://services.leadconnectorhq.com/payments/orders/?locationId=${GHL_LOC}&limit=1"` returns 200 (not 403).
- **Why:** Without this every dollar flows through Shopify only; no CreateOS payment events, no dashboard money data, no Stripe-trigger workflows.

### 1.2 — Verify PayPal (5 min)
- Settings → Integrations → PayPal. If disconnected, OAuth reconnect.

### 1.3 — Verify Shopify→CreateOS webhook end-to-end (15-20 min)
- **Test 1:** Add Liquor Store game to cart at `adultgamenights.com`, abandon checkout → verify contact appears in CreateOS Contacts with `cart-abandoned` tag within 5 min.
- **Test 2:** Run a $0.50 test purchase (Stripe test mode if available) → verify contact gets `buyer` tag + lands in "Purchased" stage of Game Sales pipeline.
- **Why:** All 3 published workflows depend on those tags firing. If they don't, the workflows are inert.

### 1.4 — Clean up broken drafts + default GHL assets (10 min)
- **Action A:** "Escalation SMS Notification" workflow is Published but broken (sends to the contact, not Thomas, with hallucinated copy). Two options:
  - **Recommended:** Delete it. Rebuild in Sprint 2 with the correct "Send Internal Notification" action type.
  - Alternative: Open it, swap the SMS action's "To: Contact" → "To: Staff Member (Thomas — 478-654-9574)" and rewrite the message body. Riskier — uses an unconventional action chain.
- **Action B:** Delete the default "Marketing Pipeline" (unused).
- **Action C:** Delete the default "Existing knowledge base" (empty, naming-collision risk with Master KB).

### 1.5 — Spot-check Master KB has FAQs (5 min)
- API reports 0 FAQs on the Master KB. We seeded 54-67. Either it's a pagination edge case OR the FAQs got wiped.
- Manual UI check at AI Agents → Knowledge Base → Adult Game Nights Master KB.
- **If empty:** re-run `scripts/13-create-knowledge-base.js` from Thomas's folder to reseed.

### 1.6 — End-to-end smoke test the 3 working workflows (30 min)
Use a single test contact (`test+sprint1@adultgamenights.com` or your own email).
- Manually tag `cart-abandoned` → wait 1 hr → first Abandonment email lands. Subject is "You left something behind 👀" with branded HTML.
- Tag `buyer` → Post-Purchase email fires immediately. Subject is "Your game is on the way 🚚".
- Tag `source-import-klaviyo` → Re-Permission email fires immediately. Subject is "Hey, it's been a minute 👋".
- For all three: confirm Thomas-voice subjects, brand-HTML rendering, unsubscribe link works.
- **Why:** We've been building without verifying. One real end-to-end test catches the silent failures before Thomas sees them.

---

## TIER 2 — Finish the contract (this week, ~5 hr)

The 4 missing workflows + 2 AI agents Maurice sold. These drive the highest-margin products (service bookings + sponsorships) and the trust anchors (reviews + Voice AI).

### 2.1 — Game Night Service Booking workflow (45 min)
**Why first:** Website audit estimates **$30K+/year unlock** from this single funnel. Highest-margin product ($199 / $299 / $499 packages).

**Prereqs:**
- Build "Game Night Service" pipeline (4 stages: Inquiry → Deposit Paid → Confirmed → Completed).
- Build "Game Night Service Booking" form via Sites → Forms (spec in `config/forms.json`). Hidden `event_date` field, dropdown for package tier (Drop-Off / Drop-Off+Host / Premium / Backyard), headcount, event type.
- Build 2 SMS snippets: `service_reminder_1hr`, `service_day_of_arrival`.

**Workflow shape (per `config/workflows.json`):**
- Trigger: form submitted
- Tags `service-booker` + `source-game-night-booking`, move to "Inquiry" stage
- Send `service_booking_confirmation` email + internal SMS to Thomas
- Wait for `deposit-paid` tag (30-day timeout), move to "Deposit Paid"
- Date-relative reminders: -7 days `event_reminder_7d`, -1 day `service_reminder_1d` + SMS, -1 hr SMS, day-of SMS
- +1 day → `post_event_thank_you` + review request SMS, move to "Completed"
- +30 days → rebook offer email
- Stop conditions: `booking-canceled`

### 2.2 — Review Request Automation (30 min)
**Why:** Per website audit, "zero reviews / social proof = 25-35% drop in PDP conversion." Reviews drive SEO + trust.

**Workflow shape:**
- Trigger A: `buyer` tag added → wait 7 days
- Trigger B: `service-completed` tag added → wait 1 day
- Send `review_request_email` + `review_request_sms` (5% off next order)
- Wait 3 days
- Branch: if `reviewed` tag and rating ≥4 → send Google review push email; if rating ≤3 → send `negative_review_alert` to Thomas, no auto-response to contact
- Stop conditions: `reviewed`, `unsubscribed`

### 2.3 — Sponsor Pipeline B2B workflow (30 min)
**Why:** "Adult Game Nights Live" sponsor contract — Maurice sold "founder rates locked through Q3." High-$$ B2B revenue line.

**Prereqs:**
- Build "Sponsorship/B2B" pipeline (4 stages: Lead → Pitched → Negotiating → Signed).
- Build "Sponsorship Inquiry" form.

**Workflow shape:**
- Trigger: form submitted
- Tags `sponsor-lead` + `source-sponsor-inquiry`, move to "Lead"
- Internal email to Thomas (high priority alert)
- Send `sponsor_pitch` email (existing template — verify branded HTML pasted)
- 7-day wait → if no `sponsor-engaged` tag → follow-up email
- 7-day wait → if still no engagement → final follow-up
- 14-day wait → tag `lapsed-sponsor`
- Stop conditions: `signed-sponsor` (move to "Signed")

### 2.4 — Event Registration & Follow-Up — General (30 min)
**Why:** Thomas runs recurring events (Russell Center July 3, Luma May 15 already done, future ones coming). Build the reusable general workflow per `config/workflows.json`.

**Workflow shape:**
- Trigger: form submitted (Event Registration form)
- Dynamic tag `event-{{slugify(event_selection)}}`, plus `source-event`
- Move to Event Attendees pipeline → "Registered"
- Date-relative reminders: -7d `event_reminder_7d`, -1d `event_reminder_1d` + SMS, day-of SMS
- +1d → `post_event_thank_you`
- +7d → move to "Followed Up", tag `event-attendee`
- Stop conditions: `unsubscribed`

### 2.5 — Voice AI Receptionist (60 min)
**Why:** Maurice sold "AI receptionist 24/7." Catches sponsor inquiries, service bookings, and "where do I buy" calls when Thomas can't.

- **Path:** AI Agents → Voice AI → Create Agent → "Adult Game Nights Receptionist".
- **Source-of-truth spec:** `config/voice-ai-agent.json` (complete).
- **Required steps:** provision a CreateOS phone number (Atlanta 404 preferred); link Master KB `y7rHRbRkznkFc8wTC8tk`; paste personality, greeting, fallback, off-topic response from spec; configure 4 goals (Book a game night, Buy the game, Ask about events, Sponsor/B2B); set voicemail message; verify recording + transcription ON.
- **Note:** ElevenLabs Thomas-clone voice is Pass 2 (deferred — needs Thomas's voice samples). Use GHL default voice for now.

### 2.6 — Reviews AI auto-response (30 min, gated on GMB OAuth)
**Why:** Contract promised "respond to reviews with personalized replies automatically."

- **Prereq:** Connect Google My Business (Settings → Integrations → GMB → OAuth) — 15 min, requires Thomas to click through.
- **Path:** Reputation → Settings → Auto Reply.
- **Config source:** `config/reviews-ai.json`.
- 5⭐ → auto-respond with branded copy
- 4⭐ → auto-respond + soft ask "what would've made it 5"
- 1-3⭐ → alert Thomas via SMS, NO auto-response

---

## TIER 3 — High-revenue workflows the original spec missed (~3 hr)

These are not in the original 8. They drive recurring revenue from existing buyers (cheapest customers to monetize) — compounding lifetime customer value.

### 3.1 — Win-Back at 90 Days (30 min)
- **Trigger:** Contact has `buyer` tag, no purchase in 90 days, no `repeat-buyer` tag, no `unsubscribed`.
- **Flow:** Soft "What you been up to?" email → wait 7d → 15% off second product email → wait 14d → if still no engagement, tag `lapsed-90d` and exit.
- **Why:** A 10% lift in repeat-buy rate is worth far more than the same lift in cold acquisition.

### 3.2 — Repeat Buyer VIP Tier (30 min)
- **Trigger:** Contact's 2nd `buyer` tag (use a counter custom field, or check if `bought-liquor-store` already exists when the trigger fires).
- **Flow:** Add `repeat-buyer` + `vip` tags → "You're locked in 🎲 — VIP perks unlocked" email → flag lifetime free shipping → flag early access to Smoking Section / Sex Store pre-orders → internal SMS to Thomas "VIP buyer: {{contact.name}}".
- **Why:** VIP recognition is sticky. People who feel rewarded buy more. Costs nothing to label.

### 3.3 — Referral Engine (45 min)
- **Trigger:** `bought-liquor-store` tag added → wait 14 days.
- **Flow:** Email with unique referral link (`?ref=CONTACT_ID&utm=referral`) + $10 credit per friend who buys. Tag `referrer-active`. On any future contact creation, if URL has `?ref=` param → set custom field `referred_by` = ref contact ID. When referred contact becomes `buyer` → trigger a second workflow that emails the original referrer "Yo, your friend pulled up — $10 credit in your pocket."
- **Why:** Lowest-cost acquisition channel that exists. Referrals convert at 4x cold ads. $10 credit per referral is wildly profitable on a $34 product.

### 3.4 — Birthday Reactivation (15 min)
- **Prereq:** Add 1 custom field — `birth_date` (DATE type).
- **Trigger:** `birth_date` matches today's month + day.
- **Flow:** "Happy birthday — game night on us 🎲 $20 off this week only" email + SMS → tag `birthday-promo-{{year}}` → 7-day expiry timer.
- **Why:** Email open rates on birthday emails are 2-3x normal. SMS open rates near 100%. Cheap to build, high engagement.

### 3.5 — Smoking Section Pre-Order Drip (20 min)
- **Trigger:** `smoking-section-pre-order` tag added (this tag already exists in Thomas's CRM).
- **Flow:** Welcome "You're locked in for Smoking Section — here's what to expect" → monthly nurture (months 1-3) with BTS content, dev updates, expected ship date → 14 days before ship: SMS "Smoking Section drops [date] — your order ships first" → day of ship: SMS with tracking.
- **Why:** Pre-orders are cash without inventory risk. Keeping pre-order buyers warm prevents refund requests and builds hype.

---

## TIER 4 — Comment-keyword auto-DM (1-2 hr, needs UI exploration)

Sprint 1's attempt used the wrong UI (AI Workflow Builder, which can't handle social comment triggers).

**Correct UI to try first:** AI Agents → Conversation AI → agent → look for "Keyword Rules" or "Triggers" sub-tab inside the agent's config. If absent, look under Marketing → Social Planner → Settings → Auto-Reply Rules.

**Build 9 rules** per `config/conversation-ai.json`:
- `GAME` → buy link + tag `source-comment-game`
- `BUY` → buy link + tag `source-comment-buy` + `buyer-intent`
- `PRICE` → "$34.04" + buy link + tag `source-comment-price`
- `BOOK` → "text 478-654-9574" + tag `source-comment-book` (post-Tier 2, swap to `/book-game-night` form URL)
- `EVENT` → "text 478-654-9574" + tag `source-comment-event`
- `SPONSOR` → "email adultgamenights@gmail.com" + tag `source-comment-sponsor`
- `CREATOR` → "reply with handle" + tag `source-comment-creator`
- `WHOLESALE` → "reply with store + qty" + tag `source-comment-wholesale`
- `3D` → "quote in 24h" + tag `source-comment-3d`

**Configuration on all 9:** case-insensitive; platforms FB+IG+TikTok (YouTube uses a separate API per Maurice's spec); one-shot per contact per day; skip if contact has `buyer` or `escalate-to-thomas`.

**Honest fallback:** if the dedicated UI doesn't exist in this GHL version, build 9 short workflows triggered by "Customer Replied → Channel: Comment". Tedious but it works.

---

## TIER 5 — Cleanup + handoff polish (~1 hr)

- Delete default Marketing Pipeline (covered in 1.4)
- Delete default Existing knowledge base (covered in 1.4)
- Confirm Conversation AI agent "Set as Primary Bot" (visual check; UI shows "Primary" badge)
- Run `scripts/21-integration-health-check.js` → all green except event/service items, Stripe green, payments endpoint 200
- Extend `config/workflows.json` with the 4 new Tier 2 workflows + the 5 new Tier 3 workflows so `scripts/09-verify-workflows.js` matches them
- Re-run `scripts/09-verify-workflows.js` after Tier 2/3 → target 13/13
- Run `scripts/22-final-acceptance.js` → target 8/8 pass
- Record 5 Loom videos for Thomas: (1) daily checklist, (2) reviewing AI drafts, (3) handling escalations, (4) checking pipeline health, (5) tagging a contact by hand
- Update `handoff-package/30-60-90-roadmap.md` with new completion status

---

## What we are NOT doing (parking lot — revisit at 30/60/90)

Be disciplined. Each of these is real, but none drive Tier 1-3 revenue, so they wait:

- App Lobby Capture workflow — gated on Thomas's app developer providing webhook URL
- Year-Long Nurture monthly drip — needs 11 emails OR 1 reusable template w/ merge fields (content debt)
- Livestream Comment Capture (Restream webhook) — gated on Restream config + keyword rules being live
- Homepage rebuild at `crm.adultgamenights.com/` — separate ~3-week project (Section B of prior plan iteration)
- Shopify site fixes from website audit (Loox install, age gate, image fixes) — Thomas's Shopify work, not CreateOS
- Smoking Section / Sex Store pre-order landing pages — depends on volume signal
- 3D-prints page, creators page, wholesale page — Sprint 2
- Multi-language Spanish version
- Custom mobile app (CreateOS LeadConnector mobile handles it)
- Voice AI ElevenLabs Thomas-clone — needs Thomas to drop voice samples in `inputs/voice-samples/`

---

## Critical files for execution

**Live state:**
- CreateOS UI: `https://app.getcreait.com/v2/location/1uN6mnlvX9JQ5QvrLewp/`
- Conversation AI agent: ID `Vt8AIbHsAuIThtDZ9VXi`
- Master KB: ID `y7rHRbRkznkFc8wTC8tk`
- Liquor Store product: ID `69ef87584052980e4dfbefa2` ($34.04, type DIGITAL — platform limit)
- Game Sales pipeline: ID `Nv2zJHgcR56ARGnrCZX0`

**Source-of-truth specs in Thomas's folder:**
- `adult-game-nights-build/config/workflows.json` — all 8 original specs (4 done, 4 to build in Tier 2)
- `adult-game-nights-build/config/voice-ai-agent.json` — Voice AI complete spec (used in 2.5)
- `adult-game-nights-build/config/reviews-ai.json` — Reviews AI complete spec (used in 2.6)
- `adult-game-nights-build/config/conversation-ai.json` — 9 keyword auto-DM rules (used in Tier 4)
- `adult-game-nights-build/config/pipelines.json` — Service + Sponsorship pipeline specs
- `adult-game-nights-build/config/forms.json` — 6 form specs
- `adult-game-nights-build/docs/website-conversion-audit-2026-05-15.md` — Shopify site issues
- `adult-game-nights-build/handoff-package/30-60-90-roadmap.md` — milestone tracker
- `adult-game-nights-build/Adult Game Night transcript..rtf` — discovery transcript (source of Maurice's promises)

**Scripts (already written, run after Tier 2/3 build):**
- `scripts/09-verify-workflows.js` — verify all workflows present (extend `config/workflows.json` first)
- `scripts/21-integration-health-check.js` — all-system green check
- `scripts/22-final-acceptance.js` — 8 end-to-end tests

---

## Verification gates

**After Tier 1 (revenue un-blocked):**
```bash
# Confirm Stripe live
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${GHL_PIT}" \
  -H "Version: 2021-07-28" \
  "https://services.leadconnectorhq.com/payments/orders/?locationId=1uN6mnlvX9JQ5QvrLewp&limit=1"
# Expected: 200 (not 403)

# Real Shopify smoke test: add to cart + abandon, confirm CreateOS contact has cart-abandoned tag within 5 min
```

**After Tier 2 (contract complete):**
```bash
cd "/Users/reecebyob/creait/Creait Clients/Thomas- Adult Game Night/adult-game-nights-build"
node scripts/09-verify-workflows.js
# Target: 8/8 workflows (4 published Sprint 1 + Service Booking + Review Request + Sponsor + Event Reg General)

node scripts/22-final-acceptance.js
# Target: 8/8 pass
```

**After Tier 3 (recommended adds):**
```bash
# Extend config/workflows.json with 5 new specs first (Win-Back, Repeat VIP, Referral, Birthday, Smoking Section)
node scripts/09-verify-workflows.js
# Target: 13/13 workflows
```

---

## Open decisions for Thomas before Tier 1 starts

1. **Stripe OAuth:** can he do this himself in the next 24 hours, or does he want Maurice on a quick screenshare to walk through it?
2. **Shopify webhook config:** has anyone confirmed Shopify is firing `cart-abandoned` + `buyer` tags into CreateOS yet? If not, who's setting it up — Shopify dev, Maurice, or a joint call?
3. **Voice AI phone number:** keep 478-654-9574 as the AGN number, or provision a new dedicated CreateOS number so personal calls stay separate from AI-handled business calls?
4. **GMB OAuth:** can he connect Google My Business this week? Blocks Reviews AI.

---

## Time + impact summary

| Tier | What | Time | Revenue impact |
|---|---|---|---|
| 1 | Un-block revenue (Stripe + webhook + cleanup) | ~90 min | Required to make $1 |
| 2 | Finish the contract (4 workflows + 2 AI agents) | ~5 hr | $30K+/yr service unlock + sponsor revenue + review-driven SEO |
| 3 | Recommended high-revenue adds (Win-Back, VIP, Referral, Birthday, Smoking Section) | ~3 hr | Compounds repeat-buyer rate 2-3x over 90 days |
| 4 | Comment auto-DM (9 rules) | ~1-2 hr | Top-of-funnel for game sales from social comments |
| 5 | Cleanup + Loom handoff | ~1 hr | Maintainability + Thomas self-sufficiency |
| **Total** | | **~12-13 hr** | **Targets Day-90 North Star of $15K/mo per the existing roadmap** |

Two solid afternoons or four 3-hour sessions. After this, Thomas is fully equipped to drive recurring revenue without Maurice manually intervening — and the 90-day target is in reach.
