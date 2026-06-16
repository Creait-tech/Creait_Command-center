# Adult Game Nights — Website Conversion Audit

**Site:** https://www.adultgamenights.com/
**Date:** 2026-05-15
**For:** Thomas Gray
**By:** Maurice (CREAIT)

---

## TL;DR

Your site is leaving **30-50% of potential revenue on the table** because of fixable issues. The #1 issue is broken images. The #2 issue is no Game Night Service page (your highest-margin product is invisible). Everything below ranked by impact.

---

## TOP 10 CONVERSION-KILLERS (ranked by $$ impact)

### 🔴 #1 — Broken product images (CRITICAL — fix today)
- Hero, PDP, lifestyle shots all loading `loading.gif` placeholders
- First-time visitors see broken page → immediate bounce
- **Est impact:** 40-50% bounce on mobile
- **Fix:** Shopify Admin → Files → audit image URLs. Likely a Shopify CDN cache or a deleted asset.

### 🔴 #2 — Zero reviews / social proof (CRITICAL — fix this week)
- No star ratings, photo testimonials, or UGC
- One unattributed quote ("We was LOUDER than the spades game table") — kills credibility
- Adult product + zero trust signals = pre-purchase hesitation
- **Est impact:** 25-35% drop in PDP conversion
- **Fix:** Install **Loox** ($30/mo) — photo reviews, post-purchase request emails, displays on PDP

### 🔴 #3 — Missing age gate (LEGAL + TRUST)
- Alcohol-themed brand, no age verification = liability + looks unprofessional to B2B prospects
- **Fix:** Install **Legal.io** or **TrustBoss Age Verification** ($25-40/mo). One-click gate captures email at entry.

### 🟠 #4 — No dedicated Game Night Service page (HIGH REVENUE)
- This is your highest-margin product, mentioned only briefly
- No pricing transparency, no deposit flow, no photo carousel
- **Est unlock:** $30K+/year in bookings
- **Fix:** Build a single page at `/game-night-service` with 3 pricing tiers ($199/$299/$499), photo gallery, "Book Now" → form → Stripe deposit

### 🟠 #5 — Companion app is invisible (RETENTION LOSS)
- The app is your secret weapon (captures player data per session = ongoing leads)
- Zero mention on the site
- **Fix:** Add App download CTA in nav + post-purchase email + footer

### 🟠 #6 — Thin product catalog
- Only the Liquor Store game visible
- 3D kits + bundle options hidden
- **Fix:** Build collection pages, surface in nav, add cross-sells on PDP

### 🟡 #7 — No lead capture before checkout
- No exit-intent popup, SMS opt-in, or email lead magnet
- Your Klaviyo list is at ~500 — should be 10K+ for a year-old brand
- **Fix:** Install **Privy** ($24/mo) for exit-intent + SMS popups

### 🟡 #8 — Mobile experience unverified
- 70%+ of traffic is on mobile
- Broken images + likely tap-target issues
- **Fix:** Test on iOS + Android, ensure touch targets ≥48px

### 🟡 #9 — Zero trust anchors
- No Shopify trust badge, no return/refund copy, no phone number visible
- **Fix:** Add trust badges, link to FAQ, surface support email in footer

### 🟡 #10 — Weak SEO
- Generic title tags, no schema markup, no Product schema for rich snippets
- **Fix:** Update title tags + meta descriptions + add Product/LocalBusiness schema via Shopify theme

---

## QUICK WINS (ship in <24 hr)

1. **Fix images** — audit Shopify Files, swap broken assets
2. **Install Loox reviews** ($30/mo Shopify app)
3. **Install age gate** (Legal.io, $25-40/mo)
4. **Update hero CTA** — change "ORDER NOW" → "SHOP THE GAME ($34)" with sub-CTA "Or Book Your Game Night Host"
5. **Add SMS opt-in at checkout** — Postscript ($50/mo) or Klaviyo SMS (free with existing Klaviyo)

**Total cost:** ~$110/mo in apps, ~6 hr of work
**Est revenue lift:** 30-50% lift on existing traffic

---

## 30-DAY REWRITE PRIORITIES

1. **Hero rewrite** — clarify value prop in 5 words. Current: "Turn Up" is too vague. Try: *"Host a Game Night Your Friends Will Actually Remember"*
2. **PDP overhaul** — 6-8 lifestyle photos, video walkthrough, FAQ section, social proof block, shipping clarity, upsell to service
3. **Game Night Service landing page** — 3-tier pricing, photo gallery, booking flow w/ Stripe deposit
4. **Mobile QA pass** — verified responsive on iOS/Android
5. **SEO foundations** — title tags, meta descriptions, Product/LocalBusiness schema

---

## SHOPIFY APPS TO INSTALL (priority order)

| # | App | Cost | What it does |
|---|---|---|---|
| 1 | **Loox** | $30/mo | Photo reviews, UGC, post-purchase email |
| 2 | **Legal.io Age Verification** | $25-40/mo | Compliant age gate, email capture |
| 3 | **Privy** | $24/mo | Exit-intent popups, SMS capture |
| 4 | **Postscript** | $50/mo | SMS marketing + checkout opt-in |
| 5 | **Rebuy** | $50/mo | Smart cross-sell on PDP + post-purchase |
| 6 | **Gorgias** | $75/mo | Customer support chat + ticketing |

**Phase 1 (this week):** Loox + Legal.io + Privy = $79-94/mo
**Phase 2 (next month):** Add Postscript + Rebuy = $179-194/mo
**Phase 3 (when scaling):** Add Gorgias = $254-269/mo

---

## GHL WORKFLOWS THAT HOOK INTO THE SITE

Once Shopify + GHL are wired, these 8 workflows run 24/7:

1. **Cart Abandonment** — Email 1hr, Email+SMS 24hr, Final SMS 72hr w/ 10% off
2. **Post-Purchase Welcome** — Day 0 thank-you, Day 3 app download, Day 7 review request, Day 14 3D kit upsell
3. **Age Gate Capture** — New email → welcome SMS + product recs
4. **Service Booking** — Form → deposit invoice → reminders → post-event review → rebook offer
5. **Review Request** — Day 7 post-purchase, escalates to GMB for 5-star reviews
6. **Win-Back** — 90 days inactive → $20 off → 30 days no response → suppress
7. **DM Auto-Response** — keyword "GAME" on IG/FB/TikTok → checkout link DM
8. **Event Attendee Flow** (TONIGHT'S BUILD) — QR scan → tag → tomorrow thank-you SMS

---

## TONIGHT'S EVENT LEVERAGE (separate doc)

See [tonight-playbook-2026-05-15.md](tonight-playbook-2026-05-15.md) for the 60-min CRM build that captures Luma attendees.

**Expected output from tonight:**
- 25-40 new contacts in CRM (assuming 25-30 attendees scan)
- 100% get thank-you SMS tomorrow morning
- Seed list for retargeting + service booking upsells over next 30 days
- Estimated 7-day revenue from event capture: $500-2000 (game sales + service inquiries)

---

## NEXT STEPS

**This week (Maurice):**
- Send Thomas this doc + tonight playbook
- Decide: who runs the Shopify app installs (Maurice or Thomas)?
- Schedule Track B follow-up call to lock prices, get app dev intro, regenerate PIT token

**Next 2 weeks (Thomas):**
- Fix images on site
- Install Loox + Legal.io minimum
- Deliver: voice samples, 15-20 FAQs, Klaviyo CSV, app dev intro
