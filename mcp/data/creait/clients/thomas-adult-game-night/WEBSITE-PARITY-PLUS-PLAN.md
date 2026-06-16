# AGN Website Parity-Plus Plan

**Date:** 2026-05-25
**Status:** Strategic decision needed — keep Shopify OR replace with GHL OR run both

---

## The honest take on the current site

Live site at `adultgamenights.com` is **Shopify Dawn theme variant**. It's functional. It has:

**What works:**
- 7 products live (Liquor Store Board Game + 6 merch/accessories)
- 3 collections (Games, Game Accessories, AGN Merch)
- Cart + wishlist + search
- Judge.me reviews integration
- Carousels (Slick + Swiper)
- Greenwood Whiskey partnership link (sponsor footer)

**What's missing (or broken):**
- ❌ `/pages/about` returns **404** — no About / Story page
- ❌ No sponsor / partner page
- ❌ No wholesale page
- ❌ No book-game-night / service page
- ❌ No creators / UGC inquiry page
- ❌ No events / upcoming page
- ❌ No press / media kit
- ❌ No public FAQ page (FAQs only inside AI chat)
- ❌ No newsletter signup / lead magnet
- ❌ Smoking Section pre-order has no landing page
- ❌ Sex Store pre-order has no landing page

This is the gap. The Shopify site is **e-comm only**. It's not capturing leads from 80% of the people who hit the brand for any reason other than buying a card game.

---

## RECOMMENDED ARCHITECTURE (don't rebuild — augment)

```
adultgamenights.com (Shopify — e-comm, keep as-is)
  ├── / (homepage)
  ├── /products/* (8 product pages)
  ├── /collections/* (3 collections)
  ├── /cart, /search, /pages/contact
  └── 3 CRO patches from WEBSITE-3-PATCHES-SHIP-TODAY.md

agn.getcreait.com OR subpages.adultgamenights.com (GHL Funnel — lead capture + brand pages)
  ├── /story (About / Founder story)
  ├── /sponsor (Sponsor inquiry form)
  ├── /wholesale (Wholesale inquiry form)
  ├── /book-game-night (Service booking form)
  ├── /creators (Creator UGC inquiry form)
  ├── /events (Upcoming events + RSVP forms)
  ├── /press (Media kit + interview requests)
  ├── /faq (Public-facing FAQ — same 67 from AI KB)
  ├── /free (Lead magnet: 3 free game card PDFs)
  ├── /smoking-section (Coming soon + pre-order)
  └── /sex-store (Coming soon + waitlist)
```

**Why this is better than a full rebuild:**

1. Shopify has 2 years of SEO equity at `adultgamenights.com` — don't throw it away
2. Shopify Dawn theme is battle-tested for checkout conversion — rebuilding it in GHL = guaranteed conversion drop
3. GHL funnels are GREAT at landing pages + form capture (its core strength)
4. Splitting concerns: Shopify = transactional, GHL = relationship/lead
5. CRM stays the system of record either way

---

## Linking the two sites cleanly

**Option A — GHL pages live at a subdomain** (cleanest, recommended)

DNS: `agn.getcreait.com` already exists. Use it as-is.
- Shopify homepage adds nav links: "Sponsor → agn.getcreait.com/sponsor"
- GHL pages link back: "Shop the game → adultgamenights.com"
- Customers don't notice the subdomain swap

**Option B — GHL pages at subpaths of adultgamenights.com**

DNS: configure Shopify to redirect `adultgamenights.com/sponsor` → `agn.getcreait.com/sponsor`. Or use a reverse proxy (Cloudflare worker).
- More work upfront, cleaner URL, better SEO consolidation
- 90-min Shopify dev task

**Recommended: Option A first, migrate to Option B once volume justifies.**

---

## What needs to be built in GHL Sites

**Pages (10 total):**

| Page | Purpose | Form on it? |
|---|---|---|
| /story | Founder story + brand origins | Newsletter signup at bottom |
| /sponsor | Brand partnership pitch | **Sponsor Inquiry form** |
| /wholesale | Retailer info + pricing | **Wholesale Inquiry form** |
| /book-game-night | Service packages + pricing | **Game Night Service Booking form** (already exists) |
| /creators | UGC program info | **Creator Inquiry form** |
| /events | Upcoming events list | **Event Registration form** (per-event) |
| /press | Media kit + Thomas's bio | Contact email + booking link |
| /faq | Public FAQ (67 entries) | Newsletter signup at bottom |
| /free | Lead magnet — 3 free PDFs | **Newsletter Signup form** with PDF auto-delivery |
| /smoking-section | Coming soon + countdown | Pre-order signup or waitlist tag |

Each page = ~30 min to build in GHL (drag content + form). Total = ~5 hours of UI work.

---

## What I can do for Thomas vs what he has to do

| Task | Who | Notes |
|---|---|---|
| Audit current site features | Maurice | ✅ Done (this doc) |
| Write copy for all 10 GHL pages | Maurice | Doc: `docs/GHL-PAGES-COPY.md` (writing next) |
| Design system (colors, fonts, layouts) | Maurice | Match current Shopify brand — use same red/yellow/cream |
| Build the 10 GHL pages | Maurice via Playwright OR Thomas | Page-builder requires UI clicks |
| Build the 5 forms in GHL | Maurice via Playwright | Try API first, fallback Playwright |
| Embed forms on GHL pages | Maurice | Inline after form build |
| Connect agn.getcreait.com subdomain to GHL | Thomas | DNS task, ~5 min |
| Add nav links on Shopify homepage | Thomas (Shopify admin) | ~5 min, copy-paste links |
| Lead magnet PDFs (3 free game cards) | Maurice | Generate via AI image gen or simple HTML→PDF |

**Thomas's actual time:** ~10 minutes (DNS + Shopify nav links). Everything else can be done by me.

---

## Parity check — does the new system have everything?

| Shopify feature | Status in new system |
|---|---|
| Cart / checkout | ✅ Still on Shopify (don't replace) |
| Product pages | ✅ Still on Shopify |
| Customer accounts | ✅ Shopify accounts work; CreateOS contact db is unified |
| Reviews (Judge.me) | ✅ Stays on Shopify; **also** Reviews AI auto-replies once GMB connected |
| Search | ✅ Shopify search |
| Email marketing | ✅ Moved from Klaviyo to CreateOS — 25 branded templates |
| Abandoned cart recovery | ✅ Workflow live in CreateOS (replaces Klaviyo flow) |
| Customer service chat | ✅ CreateOS Conversations + AI agent (5 channels) |
| Wishlist | ✅ Stays on Shopify |
| Collections | ✅ Stays on Shopify (Games / Accessories / Merch) |

**New features the system now has that the Shopify site doesn't:**

- ✅ Sponsor pipeline (inquiry → pitch → negotiate → signed)
- ✅ Wholesale pipeline (inquiry → quote → first order → reorder)
- ✅ Game Night Service booking (4 packages, automated reminders)
- ✅ Event registration with day-of SMS
- ✅ Birthday promo (annual)
- ✅ Win-Back at 90 days
- ✅ Repeat buyer VIP tier
- ✅ Refer-a-friend with $10 credit
- ✅ Smoking Section pre-order workflow
- ✅ Comment auto-DM on FB/IG/TikTok (9 keywords)
- ✅ AI Sales Rep (5 channels, KB-grounded)
- ✅ Voice AI receptionist (once phone number locked)
- ✅ 19 transactional + 6 broadcast email templates branded
- ✅ Lead magnet capture (3 free game card PDFs)

---

## Decision Thomas needs to make (5 min)

**Question:** Subdomain (Option A) or subpath redirect (Option B)?

**Recommendation:** Start with subdomain `agn.getcreait.com` since it already exists. Ship 10 pages in a week. Migrate to subpath in Q3 once volume justifies the Shopify dev time.

Once he picks A or B, Maurice does the rest of the buildout.

---

**Author:** Maurice / CREAIT
**Date:** 2026-05-25
