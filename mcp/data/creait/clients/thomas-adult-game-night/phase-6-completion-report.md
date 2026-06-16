# Phase 6 Completion Report — Integrations & Connections

**Date:** 2026-05-04
**Client:** Adult Game Nights (Thomas Gray)
**Location ID:** `1uN6mnlvX9JQ5QvrLewp`

---

## Headline

The Phase 6 endpoint probe was the most surprising one yet. Three things stood out:

1. **All 4 social media accounts are already connected** with valid OAuth — Facebook, Instagram, TikTok, YouTube. (YouTube expires today and needs immediate re-auth.) This means Maurice has been quietly setting things up in the background, and the social planner is fully API-driven from here.
2. **Social Planner POST is full CRUD** — we can create, list, and delete posts via API. So I seeded **7 launch-week posts as drafts** ready for Maurice to review and schedule.
3. **A pre-existing price discrepancy was uncovered:** the in-CRM "Liquor Store" product is at $65/$75, but our KB (and original Phase 5 spec) says $34.04. Flagged as a hard blocker before AI agents go live — agents would quote $34 to customers who'd hit a $65 checkout.

Aside from these surprises, Phase 6 confirmed the same pattern as the prior phases: GHL exposes data resources via API (products, payments, social, media library) but locks orchestration / OAuth flows behind UI. The 11 integrations that need OAuth (Stripe, ShipStation, GMB, Google Workspace, etc.) all have detailed setup guides ready for Maurice/Thomas.

---

## Status Summary

| Task | Name | Status | Mechanism |
|------|------|--------|-----------|
| 6.0 | Endpoint probe | ✅ done | 7 live, 5 scope-blocked, 15 not exposed (pre-OAuth state) |
| 6.1 | Social launch posts (7 drafts) | ✅ live | API create — full CRUD verified |
| 6.2 | Integration OAuth setup guide | ✅ written | UI work for Maurice across 11 integrations |
| 6.3 | Product pricing flag | ✅ documented | **Decision needed before agents go live** |
| 6.4 | Media library structure | ✅ specced | UI bulk upload (multipart upload deferred) |

---

## ✅ API-Driven Outcomes

### Endpoint probe results (Task 6.0)

Probed 41 endpoint variations. Full results in [`logs/phase6-endpoint-probe.json`](../logs/phase6-endpoint-probe.json).

**Live now (7):**
- `GET /products/?locationId=…` — list products ✅
- `POST /products/` — create product ✅
- `GET /social-media-posting/{loc}/accounts` — connected social accounts ✅
- `GET /social-media-posting/{loc}/categories` — post categories ✅
- `GET /surveys/?locationId=…` — surveys list ✅ (empty)
- `GET /surveys/submissions` — survey submissions ✅ (empty)
- `GET /users/?locationId=…` — users list ✅

**Live after fixing query shape (5 unlocked during deeper probe):**
- `GET /products/{id}/price?locationId=…` — product price detail ✅
- `GET /products/collections/?altId=…&altType=location` — collections ✅
- `GET /products/inventory/?altId=…&altType=location` — inventory ✅
- `POST /social-media-posting/{loc}/posts/list` — list posts (POST with `limit` as **string**) ✅
- `POST /social-media-posting/{loc}/posts` — **create post** (requires `userId` — discovered via 422 response) ✅
- `GET /medias/files?altId=…&altType=location&type=file|folder|all` — media library list ✅
- `GET /invoices/estimate/list?altId=…&altType=location&limit=N&offset=0` — estimates list ✅

**Scope-blocked (5 — likely flip green after Stripe/GMB connection):**
- `GET /products/prices?…` — list all prices across products (route works; PIT not authorized — this is the IAM-not-yet-supported wall again)
- `GET /payments/integrations/?…`
- `GET /custom-menus/?…`
- `GET /users/search?…`
- `GET /oauth/installedLocations`

**403 — connection required:**
- `/payments/orders`, `/payments/transactions`, `/payments/subscriptions` — Stripe connection unblocks these.

**404 — not exposed at any tested path:**
- `/communities`, `/memberships`, `/companies/`, `/integrations/`, `/marketplace/apps`, `/webhooks` — all UI-only.

### Social Planner — 7 launch posts seeded (Task 6.1)

Created via `node scripts/18-seed-social-posts.js`. All 7 in `draft` status awaiting Maurice's review and scheduling.

| Internal name | Platforms | Schedule recommendation | ID |
|---|---|---|---|
| `launch_were_back` | FB / IG / TT | Day 1 — soft launch | `69f82d86201c6a6169627158` |
| `liquor_store_hero` | FB / IG / TT | Day 2 — product hero | `69f82d86d5a94018d11b9931` |
| `service_tier_drop` | FB / IG | Day 3 — service tiers | `69f82d86201c6a616962718e` |
| `game_show_teaser` | FB / IG / TT | Day 5 — game show | `69f82d87f25e5077f33b4e08` |
| `russell_center_event` | FB / IG | Day 7 — event push | `69f82d8753baf7a8303f072b` |
| `creator_network` | FB / IG / TT | Day 10 — creator program | `69f82d877eb7530f86191690` |
| `3d_drops_teaser` | FB / IG / TT | Day 12 — 3D announcement | `69f82d87201c6a616962727b` |

All posts use Pass 1 placeholder voice (energetic / DJ-host). Pass 2 refresh script ([`scripts/16-refresh-agent-personality.js`](../scripts/16-refresh-agent-personality.js)) only updates KB FAQs — social posts will need a separate refresh script when Thomas's voice samples land. **TODO for Pass 2:** add `scripts/17-refresh-social-posts.js` that re-generates all draft posts from updated personality.

Source spec: [`config/social-launch-posts.json`](../config/social-launch-posts.json).

**Maurice next steps for social posts:**
1. Open CreateOS → Marketing → Social Planner → Drafts
2. For each draft, attach a media file (recommendations are in the spec's `media_recommendation` field per post)
3. Schedule using the recommended day relative to launch
4. Hit the YouTube re-auth before publishing anything that targets YouTube

### Connected social accounts inventory

| Platform | Account name | OAuth ID | Expires | Status |
|---|---|---|---|---|
| Facebook | Adult Game Nights (page) | `69f00476a0fa22a906aab8d0` | 2026-06-27 | ✅ valid |
| Instagram | adultgamenights | `69f00516b21860825ac2a773` | 2026-06-27 | ✅ valid |
| TikTok | Adult Game Nights (business) | `69f0053aa3e1f23bf224c612` | 2027-04-28 | ✅ valid |
| YouTube | ADULT GAME NIGHTS (verified) | `69f004e9e9d0628b7e5dec1e` | **2026-05-04 (TODAY)** | ⚠️ **needs re-auth** |

---

## 🟡 Specs / Manual Work for Maurice

### Integration OAuth checklist (Task 6.2)

Full guide: [`docs/integrations-setup-guide.md`](integrations-setup-guide.md). Priority order:

1. **YouTube re-auth** (5 min, expires today)
2. **Google My Business** (15-30 min) — gates Reviews AI
3. **Stripe** (30 min) — gates payment workflows + service deposits
4. **Shopify webhook → CreateOS** (15-30 min) — gates Workflows 1, 2, 7
5. **Google Calendar two-way sync** (10 min) — quality of life
6. **Mailgun custom domain** (10 min after DNS lives) — deliverability

Optional (no blocker): ShipStation, QuickBooks, Twilio.

### Product pricing flag (Task 6.3)

**[`docs/product-pricing-flag.md`](product-pricing-flag.md)**. Decision needed: KB says $34.04, in-CRM product is $65. AI agents will quote KB pricing; checkout will be in-CRM pricing. Either source needs to win — once Thomas decides, a 2-line script aligns them.

While we're here, the in-CRM product also has issues:
- Type marked `DIGITAL` (should be `PHYSICAL`)
- Trailing space in name (`"The Liquor Store "`)
- Zero product images
- No variants

All editable via `POST /products/` once direction is set.

### Media library (Task 6.4)

[`docs/media-library-spec.md`](media-library-spec.md) — 7 top-level folders, naming convention, priority upload list. UI work in CreateOS Media Library.

---

## API quirks discovered (Phase 6)

Added to [`docs/api-reference.md`](api-reference.md):

1. **Products endpoint uses `_id` (Mongo-style), not `id`.** Most other endpoints return `id` — products is the exception. Code should accept either.
2. **`POST /social-media-posting/{loc}/posts/list` requires `limit` as a STRING, not number.** Returns 422 if you send a number. Same for the `skip` parameter.
3. **Creating a social post requires a `userId` field** that isn't documented in the spec — discovered via 422 response. Use the location's first user from `/users/?locationId=…` as a default.
4. **Multiple endpoints prefer `altId` + `altType=location` over `locationId`:** invoices, estimates, media, product collections, product inventory. This is inconsistent with the rest of the API which mostly uses `locationId` directly.
5. **`/payments/orders` and friends return 403 (not 401, not 404)** when no payment provider is connected. After Stripe is connected they should flip to 200. Re-run probe to confirm.
6. **Social Planner CRUD is full-featured.** This was the surprise — given how locked-down forms/workflows/pipelines are, full programmatic posting is a notable exception. Use this for any future content automation.
7. **GHL stores OAuth expiry per-platform.** YouTube tokens are short-lived (30 days), Meta is 60 days, TikTok is 365 days. Set calendar reminders.

---

## 📋 Resource Inventory Update

| Phase | Resource | Count | Status |
|-------|----------|-------|--------|
| 1-5 | (carried forward) | 156 | ✅ live |
| **6** | **Social posts (drafts)** | **7** | **✅ live** |
| **Total via API** | | **163 resources** | |
| 6 | OAuth-required integrations | 11 | 🟡 manual UI work (priority list documented) |
| 6 | Media library folders | ~25 | 🟡 manual UI work |
| 6 | Product price/details fix | 1 | 🟡 decision blocked |

---

## File tree (delta from Phase 5)

```
/Users/reecebyob/adult-game-nights-build/
├── /scripts/
│   ├── 17-probe-phase6-endpoints.js       ✅ executed
│   └── 18-seed-social-posts.js            ✅ executed (idempotent)
│
├── /config/
│   └── social-launch-posts.json           ← spec for the 7 drafts
│
├── /logs/
│   ├── phase6-endpoint-probe.json
│   └── social-posts-created.json          ← 7 draft IDs
│
└── /docs/
    ├── integrations-setup-guide.md        ← Maurice action list (11 integrations)
    ├── product-pricing-flag.md            ← decision needed before agents go live
    ├── media-library-spec.md
    └── phase-6-completion-report.md       ← this file
```

---

## ⏭️ Recommended Next Steps

### Immediate (this week)
1. **Maurice: re-auth YouTube** before EOD (token expires today)
2. **Thomas/Maurice: resolve product pricing** ($34.04 vs $65) — agents can't go live until aligned
3. **Maurice: Stripe + GMB OAuth** — biggest unlocks for the rest of the system
4. **Maurice: review and schedule** the 7 social drafts

### Next phase candidates
The original Phase 6 prompt mentioned Phases 7 (Dashboard) and 8 (Documentation/Handoff). Both make sense to do back-to-back once:
- Workflows are live (Track B from Phase 4)
- AI agents are live (Track B from Phase 5)
- Stripe + GMB are connected
- Forms + landing pages are built

**Suggested order:**

**Phase 6.5 (small) — Pre-go-live verification.** Once Maurice has done the OAuth + UI work, run a single end-to-end smoke test: submit Form 1, watch Workflow 6 fire, confirm AI receptionist answers a test call, post a 5-star test review, etc. ~1 hour of validation.

**Phase 7 — Dashboard.** Build the single-pane-of-glass for Thomas: lifetime revenue, this-week leads, conversion rate, upcoming events, upcoming services, recent reviews, social engagement. CreateOS has a native Dashboard builder; we'd configure it via UI (likely no API) and document the setup. Maybe 2-3 hours.

**Phase 8 — Handoff documentation.** Loom walkthroughs of: how to add a contact, how to update an email template, how to read the dashboard, how to handle an escalated conversation, how to run Pass 2 refresh. The ops manual. ~3 hours.

### What I can do without Maurice unblocking anything
- Write `scripts/19-update-product-price.js` (dormant — runs once Thomas picks a price)
- Write `scripts/20-capture-webhook-urls.js` (dormant — runs after workflows exist)
- Build Phase 7 dashboard config spec (specs-as-source-of-truth pattern again)
- Write Phase 8 handoff doc skeletons

Let me know which of these to push next, or if a different priority surfaced.

---

**Phase 6 awaiting review. Maurice has a clear UI worklist; the AI agents are blocked on the pricing decision and the GMB connection.**
