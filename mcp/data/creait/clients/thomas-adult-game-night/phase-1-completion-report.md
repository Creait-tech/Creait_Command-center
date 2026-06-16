# Phase 1 Completion Report — Adult Game Nights CRM Build

**Date:** 2026-05-04
**Client:** Adult Game Nights (Thomas Gray)
**Location ID:** `1uN6mnlvX9JQ5QvrLewp`
**Auth:** Private Integration Token (PIT) `pit-75409b93-…`

---

## Status Summary

| Task | Name | Status |
|------|------|--------|
| 0.0 | Credential Verification | ✅ Success |
| 1.1 | Sub-Account Configuration | ❌ Blocked (scope) |
| 1.2 | Custom Fields | ✅ Success (11/11) |
| 1.3 | Tag Taxonomy | ✅ Success (32/32) |
| 1.4 | Pipelines | ❌ Blocked (scope) |
| 1.5 | Calendars + Blockout | ✅ Success (3/3 + July 3 blocked) |

**Overall:** 4 of 6 tasks succeeded end-to-end. 2 are blocked by API scope limitations of the Private Integration Token (not by code or planning errors). Both have documented manual remediation paths.

---

## ✅ Tasks Completed

### Task 0.0 — Credential Verification
- `GET /locations/{id}` → 200
- `GET /contacts/?locationId=…` → 200
- `GET /locations/{id}/customFields` → 200
- All scopes for read-side operations confirmed.

### Task 1.2 — Custom Fields (11/11)

| Name | Data Type | ID |
|------|-----------|-----|
| Game Host Name | TEXT | `X0iYBPOP8a5sPcuCRAJ3` |
| Last Event Attended | TEXT | `mp3rtXAqBdQ5a8B9QUbD` |
| Games Played in App | NUMERICAL | `E1XocPQpSl1vqiCB9hxV` |
| Lifetime Order Value | MONETORY | `ut7JkOAUI4LJBaCnKuFK` |
| Preferred Service Tier | SINGLE_OPTIONS (Drop-off / Host / Premium) | `yRRovQkw3f5iLND8bP3R` |
| Birthday | DATE | `ubSSRPbkLq667ZMfSvng` |
| City (Game Nights) | TEXT | `vV26Grj55z4iL6R5pR7k` |
| Service Area | SINGLE_OPTIONS (Inside 285 / Outside 285 / Out of Town) | `2ZrK8VlTnTcHE83oX3h9` |
| Sponsor Products | LARGE_TEXT | `00z9Ce1Vf5K67QMQSiZJ` |
| Referral Source | TEXT | `jk5s9HewkU5hUvYetG39` |
| App Version | SINGLE_OPTIONS (Free / Premium) | `AzsVO62Hj9T2SUejZaEO` |

**Notes:**
- Originally specced "City" was renamed to **"City (Game Nights)"** because `contact.city` is a standard field in GHL and cannot be duplicated. Standard `contact.city` is still available on every contact.
- `SINGLE_OPTIONS` payload requires `options: [string, string]` — not the `[{name,value}]` shape suggested by some docs. Documented in `/docs/api-reference.md`.

### Task 1.3 — Tag Taxonomy (32/32)

All tags created via `POST /locations/{id}/tags`:

- **Source (14):** source-shopify, source-event, source-app-lobby, source-dm-instagram, source-dm-tiktok, source-dm-facebook, source-website-form, source-game-night-booking, source-sponsor-inquiry, source-tiktok-shop, source-import-klaviyo, source-3d-print-inquiry, wholesale-inquiry, affiliate-applicant
- **Behavior (9):** buyer, event-attendee, app-player, service-booker, sponsor-lead, repeat-buyer, vip, cart-abandoned, recovered-cart
- **Product (4):** bought-liquor-store, bought-3d-kit, pre-order-smoking-section, bundle-buyer
- **Engagement (5):** engaged-30d, lapsed-90d, lapsed-180d, unsubscribed, lapsed-sponsor

Full ID list saved in `/logs/tags-created.json`.

### Task 1.5 — Calendars (3/3) + Blockout (1/1)

| Name | ID | Slug | Slot |
|------|-----|------|------|
| Game Night Service Booking | `xX4X3z2vKwjBPldnYVj0` | service-booking | 120 min, 30 interval, 120 buffer |
| Sponsorship & Partnership Calls | `e9So05abGp6pRydHOPdO` | sponsor-call | 30 min, 30 interval, 15 buffer |
| General Inquiries | `bYMA4jte9RSdIWNDxDsP` | general | 15 min, 15 interval, 0 buffer |

**Blockout:** July 3, 2026 (Russell Center event) blocked on Calendar 1, ID `DU1dy1ihaJIDQMnFPpRA`. Verified via `/calendars/blocked-slots`.

**Notes:**
- All 3 calendars assigned to Thomas Gray (userId `QJU9MV5Fff6ob0XMrRJ9`) as the only team member, priority 0.5.
- `openHours` validator requires **one day per entry** (not arrays of days) — even though the schema accepts `daysOfTheWeek: number[]`. Multi-day arrays return 422. Documented in `/docs/api-reference.md`.

---

## ❌ Blocked Tasks (Scope Limitations)

### Task 1.1 — Sub-Account Configuration

**Endpoint:** `PUT /locations/{locationId}`
**Error:** `401 The token is not authorized for this scope.`

**Current account state (read via GET):**
- name: `Thomas Gray's Account` ← needs update to `Adult Game Nights`
- timezone: `America/Los_Angeles` ← needs update to `America/New_York`
- email: `thomas@adultgamenights.com` ← needs update to `adultgamenights@gmail.com`
- city: `Atlanta` ✅
- state: `Georgia` ✅
- postalCode: `30313` ✅
- phone: `+14049542115` ✅
- address: `504 Fair St` ← minor: needs `504 Fair Street`

**Remediation (pick one):**
1. **Manual UI update** (5 min): In CreateOS → Settings → Business Profile, update the four fields above. Recommended for fastest unblock.
2. **Agency token**: Generate Agency-level OAuth credentials (`locations.write` scope). Then re-run `node scripts/01a-update-location.js` with the new token.

### Task 1.4 — Pipelines

**Endpoint:** `POST /opportunities/pipelines` (and alternates)
**Error:** `401 The token is not authorized for this scope.`

**Tested paths:** `/opportunities/pipelines/`, `/opportunities/pipelines`, `/locations/{id}/pipelines`, `/pipelines` — all blocked or not found. PIT can READ pipelines (verified) but cannot create/update.

**Remediation (pick one):**
1. **Manual UI build** (15-20 min): In CreateOS → Opportunities → Pipelines, create the 4 pipelines from `/config/pipelines.json`. Stage names and positions are listed there.
2. **Agency OAuth token** with `opportunities.write` scope, then re-run `node scripts/03-create-pipelines.js`. Script is idempotent.

Pipeline spec (preserved in `/config/pipelines.json`):
1. **Game Sales (E-commerce)** — 7 stages: Cold Lead → Visited Site → Cart Abandoned → Purchased → App Downloaded → Repeat Buyer → 3D Kit Buyer
2. **Game Night Service** — 8 stages: Inquiry → Quote Sent → Deposit Paid → Confirmed → Day-Of → Completed → Review Requested → Rebooked
3. **Event Attendees** — 5 stages: Registered → Checked In → Played Game (App Lobby) → Followed Up → Converted to Buyer
4. **Sponsorship/B2B** — 5 stages: Lead → Pitch Sent → Negotiating → Signed → Active Sponsor

---

## 📋 Resource Inventory (IDs for Phase 2+)

Saved as JSON for downstream workflow references:

- `/logs/build-log.json` — full task log
- `/logs/custom-fields-created.json` — 11 field IDs
- `/logs/tags-created.json` — 32 tag IDs
- `/logs/calendars-created.json` — 3 calendar IDs + blockout
- `/logs/errors.json` — 8 transient errors (4 first-attempt SINGLE_OPTIONS shape, 1 City collision, 1 location PUT, 3 pipeline POST attempts) — all resolved or documented

---

## ⚠️ Blockers / Scope Issues

| # | Blocker | Severity | Owner |
|---|---------|----------|-------|
| 1 | PIT cannot `PUT /locations/{id}` (1.1) | 🟡 Medium — UI fix or agency token | Reece / Thomas |
| 2 | PIT cannot create pipelines (1.4) | 🟡 Medium — UI build or agency token | Reece / Thomas |

Neither blocker affects subsequent phases that operate on **contacts, workflows, forms, calendars, conversations** — those use the location-scoped APIs that the PIT already has.

---

## ⏭️ Recommended Next Steps

1. **Resolve 1.1 & 1.4** before launching Phase 2 (one of):
   - Quick path: 20 minutes of manual UI work in CreateOS.
   - Robust path: get an Agency OAuth key + re-run scripts.
2. **Then Phase 2 (Forms & Funnels)** — will use:
   - Calendars from 1.5 (booking forms link to them)
   - Custom fields from 1.2 (form field mapping)
   - Tags from 1.3 (form submit auto-tag)
3. **Phase 3 (Email/SMS templates)** — independent of blockers.
4. **Phase 4 (Workflows)** — needs pipelines (1.4) for stage-move triggers, so resolve that first.

---

## API Quirks Discovered (logged in `/docs/api-reference.md`)

1. `SINGLE_OPTIONS` field options must be `string[]`, not `[{name, value}]`. Wrong shape returns `400 v.trim is not a function`.
2. Cannot create custom field with same name as a standard field (`City`, `Email`, `Phone`, etc.) — returns 400 with explicit message. Use a qualifier like `City (Game Nights)`.
3. Calendar `openHours` requires **one day per entry**. Validator rejects `daysOfTheWeek: [1,2,3]` with "must be a valid day of week". Workaround: expand into N entries with single-element arrays.
4. PIT scope (Private Integration Token):
   - ✅ Custom fields, tags, calendars, calendar blockouts, contacts, conversations
   - ❌ Location updates, pipeline create/update, agency-level resources

---

## Code Artifacts

```
/Users/reecebyob/adult-game-nights-build/
├── .env                                  # credentials (gitignored)
├── .gitignore
├── package.json
├── /scripts
│   ├── 00-verify-credentials.js         ✅ run
│   ├── 01a-update-location.js           ❌ blocked (scope)
│   ├── 01-create-custom-fields.js       ✅ run (idempotent)
│   ├── 02-create-tags.js                ✅ run (idempotent)
│   ├── 03-create-pipelines.js           ❌ blocked (scope) — ready to re-run with agency token
│   ├── 04-create-calendars.js           ✅ run (idempotent)
│   └── /utils
│       ├── api-client.js                # fetch wrapper, retry+backoff
│       └── logger.js                    # build-log + error-log writers
├── /config
│   ├── custom-fields.json
│   ├── tags.json
│   ├── pipelines.json                   # ready for manual build or re-run
│   └── calendars.json
├── /logs
│   ├── build-log.json
│   ├── errors.json
│   ├── custom-fields-created.json
│   ├── tags-created.json
│   └── calendars-created.json
└── /docs
    ├── api-reference.md
    └── phase-1-completion-report.md     ← this file
```

---

**Awaiting review before Phase 2.**
