# Integrations & Connections Setup Guide

**State as of Phase 6 Track A:** Some integrations are already connected (Phase 6 probe revealed an active social stack). Others need OAuth flows that only Maurice/Thomas can complete in the CreateOS UI. This doc maps every integration, its current state, and the exact UI path to set it up.

---

## TL;DR — current state

| Integration | Status | Action |
|---|---|---|
| **Facebook page (Adult Game Nights)** | ✅ Connected, expires 2026-06-27 | Renew before expiry |
| **Instagram (adultgamenights)** | ✅ Connected, expires 2026-06-27 | Renew before expiry |
| **TikTok (Adult Game Nights)** | ✅ Connected, expires 2027-04-28 | None — long-lived |
| **YouTube (ADULT GAME NIGHTS)** | ⚠️ **Expires 2026-05-04 (TODAY)** | **Re-auth NOW** |
| **Stripe** | 🟡 Not connected | OAuth flow — see below |
| **ShipStation** | 🟡 Not connected | OAuth flow — see below |
| **Google My Business** | 🟡 Not connected | OAuth flow — required for Reviews AI |
| **Google Workspace (Calendar)** | 🟡 Not connected | OAuth flow — for two-way calendar sync |
| **Quickbooks** | 🟡 Not connected | OAuth flow |
| **Mailgun (custom email domain)** | 🟡 Pending DNS | Needs DNS records from `dns-setup-instructions.md` first |
| **Twilio (custom SMS sending number)** | 🟡 Optional | Skip if happy with default GHL numbers |
| **Webhook to Shopify** | 🟡 Not connected | Custom webhook — see below |

---

## Connected — verify and renew

### YouTube (URGENT)
**Status:** OAuth expires `2026-05-04T04:13:58.375Z` — **today**.

**Action:**
1. Open CreateOS → Settings → Integrations → Social Planner
2. Find the YouTube channel (`ADULT GAME NIGHTS` / `@adultgamenights`)
3. Click **Reconnect** → walk through Google OAuth
4. Confirm renewed expiry is ~1 year out

**Why this matters:** Without re-auth, the social planner can't post to YouTube and Phase 6's seeded launch posts targeted at YouTube would fail at publish time. (Note: our 7 launch posts in `social-launch-posts.json` only target FB/IG/TikTok by default; YouTube is a future expansion, but reconnecting now prevents the warning state from spreading.)

### Facebook + Instagram + TikTok
All connected and stable. Verify no warning indicators in CreateOS Social Planner. Both FB and IG share the same OAuth (Meta) and expire 2026-06-27 — set a calendar reminder for ~2026-06-15 to renew.

---

## Not connected — OAuth setup needed

### Stripe (HIGH PRIORITY — gates payment processing)

**Required for:**
- Service deposit collection (Phase 4 Workflow 6 step 5 waits for `deposit-paid` tag)
- Wholesale invoicing
- Sponsorship payment collection
- Custom 3D print payments
- Online checkout (Liquor Store game on adultgamenights.com — currently on Shopify; CreateOS Stripe connection enables in-CRM checkout if needed)

**Setup path:**
1. CreateOS → **Payments → Integrations → Stripe**
2. Click **Connect with Stripe**
3. Sign in with Thomas's Stripe credentials (or create account if needed)
4. Authorize → CreateOS gets connected account ID
5. Verify in **Payments → Settings** that test transactions can run

**Once connected, this becomes API-accessible** (the Phase 6 probe showed `/payments/orders` returns 403 currently — likely because no provider is connected. Re-run `node scripts/17-probe-phase6-endpoints.js` after connection to confirm).

**If Thomas doesn't have a Stripe account yet:** Stripe.com → sign up → use the EIN for Adult Game Nights LLC. Standard merchant onboarding. ~30 min.

---

### ShipStation

**Required for:**
- Shopify order fulfillment (Liquor Store game)
- Wholesale order fulfillment
- 3D print order shipping
- Tracking-link merge fields in `post_purchase_thank_you` email

**Setup path:**
1. ShipStation API → Settings → Account → API Settings → copy API Key + Secret
2. CreateOS → Settings → Integrations → ShipStation
3. Paste API Key + Secret
4. Test connection

**Alternative if no native integration:** Use Zapier — Shopify order → ShipStation → webhook to CreateOS contact updating `tracking_url` custom field. Slower but works.

**Custom field needed:** Add `Tracking URL` (TEXT) to custom fields if not present. Used in `post_purchase_thank_you.html` (currently `{{tracking_url}}` placeholder).

---

### Google My Business (HIGH PRIORITY — gates Reviews AI)

**Required for:**
- Reviews AI (Phase 5) auto-replies
- Review request flow (Workflow 7) sending Google review links
- Review tracking in Reputation tab

**Setup path:**
1. CreateOS → **Reputation → Connections → Google**
2. Click **Connect**
3. Sign in with the Google account that owns the Adult Game Nights GMB listing
   - **If no GMB listing exists:** create one at `business.google.com` first (claim "Adult Game Nights" — verify by phone or postcard)
4. Select the AGN business profile from the OAuth account picker
5. Authorize "manage reviews and respond" scope

**After connection:**
- Reviews AI can auto-respond per the rating rules in `config/reviews-ai.json`
- Workflow 7 has a real Google review URL to send (currently a placeholder)

---

### Google Workspace (Calendar two-way sync)

**Required for:**
- Two-way sync between CreateOS Calendar 1/2/3 and Thomas's personal Google Calendar (so booked events show up in his daily view)
- Avoiding double-booking when Thomas adds events to Google Calendar manually

**Setup path:**
1. CreateOS → Settings → Integrations → Google Calendar
2. **Connect with Google** → authorize Thomas's Google account
3. For each CreateOS calendar (Game Night Service Booking, Sponsorship Calls, General Inquiries):
   - Open Calendar settings → **External Sync** tab
   - Select the matching Google Calendar to sync to/from
4. Save

**Time estimate:** 10 min total.

---

### Quickbooks

**Required for:**
- Auto-syncing CreateOS invoices to QBO for accounting
- Reconciling Stripe payouts

**Setup path:**
1. CreateOS → Settings → Integrations → QuickBooks
2. **Connect with QuickBooks** → OAuth
3. Map: CreateOS invoices → QBO sales receipts; CreateOS contacts → QBO customers
4. Test with a single invoice

**Skip if:** Thomas isn't using QBO yet. Can add later — no other Phase 1-5 dependency.

---

### Mailgun (Custom Email Domain)

**Required for:**
- Sending all transactional emails from `@adultgamenights.com` domain instead of CreateOS-generic
- Better deliverability + brand consistency

**Pre-requisite:** DNS records from [`dns-setup-instructions.md`](dns-setup-instructions.md) must be live in GoDaddy first (CNAMEs for `_domainkey`, `s1._domainkey`, SPF, DMARC).

**Setup path:**
1. Confirm DNS records propagated: `dig TXT adultgamenights.com` should show SPF with `_spf.leadconnectorhq.com`
2. CreateOS → Settings → Email Services → Dedicated Domain → Add
3. Enter `adultgamenights.com`
4. Click **Verify** → CreateOS validates DNS
5. Once green, set this as the default sending domain for all email templates

**Verification:** Send a test email from any of the 20 Phase 3 templates → check headers for `From: …@adultgamenights.com` (not `mail.gohighlevel.com`).

---

### Twilio (Custom SMS Number — optional)

**Skip if:** GHL's default phone numbers work fine for Adult Game Nights.

**Required if:** Thomas wants to use a Twilio-owned number he already has, or wants A2P 10DLC compliance handled outside GHL.

**Setup:** Settings → Phone Numbers → Add Existing → Twilio → API key + Account SID. Standard.

---

### Shopify Webhook (CRITICAL for Workflows 1, 2, 7)

**Required for:**
- Workflow 1 (Cart Abandonment) — needs Shopify abandoned-checkout webhook
- Workflow 2 (Post-Purchase Welcome Series) — needs Shopify order-created webhook
- Workflow 7 (Review Request) — fires 7 days after order

**Setup path:**

**Option A — direct Shopify → CreateOS webhook:**
1. Shopify admin → Settings → Notifications → Webhooks
2. Add webhook for **Order created** → URL: TBD (CreateOS exposes inbound webhook URLs once a workflow with "Inbound Webhook" trigger is built)
3. Add webhook for **Cart abandoned** → URL: TBD
4. Format: JSON

**Option B — Zapier middleware:**
- Shopify trigger → "New paid order" → Zapier action → "GHL: Add tag `buyer` to contact by email"
- Shopify trigger → "Cart abandoned" → Zapier action → "GHL: Add tag `cart-abandoned`"

Option B is more flexible (can transform fields) but introduces a Zapier monthly cost. Option A is free but requires the workflows to be built with inbound-webhook triggers (which the Phase 4 specs are designed to support).

---

## Webhook URLs Maurice will need to capture

After Track B builds the Phase 4 workflows, the following webhook URLs will be available in CreateOS UI. Capture them and forward to relevant integrations:

| Workflow | Webhook needed | Capture into |
|---|---|---|
| Cart Abandonment Recovery (Workflow 1) | Inbound from Shopify cart events | `logs/webhook-urls.json` |
| Post-Purchase Welcome (Workflow 2) | Inbound from Shopify order events | same |
| App Lobby Capture (Workflow 8) | Inbound from Thomas's app | hand to app developer |

`logs/webhook-urls.json` is auto-generated by `scripts/19-capture-webhook-urls.js` (TBD — run after workflows are built).

---

## Connection priority order

If Maurice has limited time, do these in order:

1. **YouTube re-auth** (5 min) — expires today
2. **Google My Business** (15-20 min if listing exists; 30+ min if claiming new) — gates Reviews AI
3. **Stripe** (30 min) — gates payment workflows + service deposits
4. **Shopify webhook → CreateOS** (15-30 min) — gates Workflows 1, 2, 7
5. **Google Calendar sync** (10 min) — quality-of-life for Thomas
6. **Mailgun** (after DNS) — improves deliverability

ShipStation, QuickBooks, Twilio: do as needed.

---

## After connections are live

Re-run the Phase 6 probe to confirm:

```bash
cd /Users/reecebyob/adult-game-nights-build
node scripts/17-probe-phase6-endpoints.js
```

Expected upgrades after Stripe + GMB:
- `payments_orders` should flip from 403 → 200
- `payments_transactions` should flip from 403 → 200
- `payments_subscriptions` should flip from 403 → 200
- `payments_integrations_v2` should flip from 401 → 200
- A new `/reviews/` endpoint may become routable (currently 404)

If those flip green, the AI agents and workflows can start consuming live order/payment/review data via API.
