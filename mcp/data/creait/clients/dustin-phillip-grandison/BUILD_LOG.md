# Build Log — Dustin's Bespoke (Creait OS / GoHighLevel)

**Location:** Dustin Smith · `pisXuG0XOHoNDquxzSKG` · Atlanta, GA · timezone `America/New_York`
**PIT used:** `pit-117f3a50-c2db-419c-8b96-fa8ff1d01652`
**Build date:** 2026-04-20
**Built by:** Claude (Creait OS build agent), directed by Maurice Grant

---

## Summary

| Phase | Item | Count | Status |
|---|---|---|---|
| 1A | Custom Values | 12/12 | ✅ Created via API |
| 1B | Custom Fields | 17/17 | ✅ Created via API |
| 1C | Tags | 33/33 | ✅ Created via API |
| 1D | Pipeline (Bespoke Client Journey) | 1 | ⛔ BLOCKED — PIT lacks `opportunities.write` scope. Rolled to Phase 2 UI checklist §2.0 |
| 1E | Calendars | 2/2 | ✅ Created via API |
| 2 | Forms | 0/4 built, 2 specced in Phase 2 checklist + 2 in Phase 4 checklist | ⚠ GHL v2 API has no reliable form-create endpoint — UI-only per plan |
| 2 | Templates (SMS + Email, 22 base + 9 sequence) | 0/31 built | ⚠ SMS snippets API scope-blocked (401); rich-email templates are UI-only anyway — consolidated into Phase 2 UI checklist |
| 3 | Workflows (WF1–WF13 + WF-AI) | 0/14 | UI-only — detailed in PHASE_3_UI_CHECKLIST.md |
| 4 | AI Concierge | — | UI-only — detailed in PHASE_4_UI_CHECKLIST.md |

**Outcome:** All API-creatable Phase-1 items are live. Phase 1 pipeline and all Phase 2/3/4 work is documented in three UI checklist files for manual build.

---

## Created resources (full ID table)

### Custom Values (12) — all ✅

| Name | ID | Value |
|---|---|---|
| business_name | `m0qQDKhqcO2UZjaC7L1D` | Dustin's Bespoke |
| business_phone | `6Dea4CNJjNZLAbE6TUXd` | (757) 676-1593 |
| studio_address | `oFtW25wCfSM8pwv9ktDr` | 3239 Camden Court, Atlanta, GA 30349 |
| studio_hours | `vtJ16AoW3Lr6OlwcWo2C` | Tue–Sat, 10 AM – 6 PM |
| booking_consultation_url | `RPvh2b2cVcAXxrptYR53` | **REPLACE_ME** |
| booking_fitting_url | `xizf9UZSb9cI8SM1XLTx` | **REPLACE_ME** |
| lookbook_url | `ulAUEMPHxt6quy0xdxDt` | **REPLACE_ME** |
| testimonial_page_url | `wI7yFU7kXDsgkp1Rn7S9` | **REPLACE_ME** |
| referral_form_url | `yP335deV1WQjXy08wHUD` | **REPLACE_ME** |
| review_link_google | `UQvEh9eor0XdDtCKUt5n` | **REPLACE_ME** (Phase 5) |
| dustin_signature_block | `Ci3RHCXJ73J6OPoqhwd7` | — Dustin / Dustin's Bespoke / (757) 676-1593 |
| assistant_name | `N0vhvBqJRtAq10xVzTdo` | **REPLACE_ME** |

### Custom Fields (17) — all ✅

All live on `contact` model. Folder creation returned OK but folder_id came back null — verify in UI (Settings → Custom Fields) and optionally drag fields into a single "Bespoke Order Details" folder manually.

| Name | ID | fieldKey | dataType |
|---|---|---|---|
| Occasion | `DNn32BX0xOEk4djwj7HX` | `contact.occasion` | RADIO |
| Event Date | `eA492CGVrMJwQd2r9b9X` | `contact.event_date` | DATE |
| Budget Range | `FtKiMuvvaEyqaLiE2wga` | `contact.budget_range` | RADIO |
| Suit Type Interest | `7AKEPLPPF5TThA347YAy` | `contact.suit_type_interest` | RADIO |
| Preferred Communication | `pP1RobkjUjjSwmVq2hAf` | `contact.preferred_communication` | RADIO |
| Experience Level | `7rW4Ed5VLwOqccmQIW1P` | `contact.experience_level` | RADIO |
| Fabric Selected | `FEiN9Hbokm0j8w4VB5rt` | `contact.fabric_selected` | TEXT |
| Mill | `a249cLDIbEkUREcqgETo` | `contact.mill` | TEXT |
| Deposit Amount | `GjrVhDCn5S9nh6wGVJ19` | `contact.deposit_amount` | MONETORY (sic) |
| Total Order Value | `Px5nQX9i4hYgzLIl0C0C` | `contact.total_order_value` | MONETORY (sic) |
| Order Status | `cheMINI0xqMpb4lgWC2m` | `contact.order_status` | RADIO |
| Pattern On File | `RfO3cvNnxBY8u0w0Q5wc` | `contact.pattern_on_file` | CHECKBOX |
| Measurements Taken Date | `QI51huCDCSRioyg1gqoO` | `contact.measurements_taken_date` | DATE |
| Fabric Approved | `eMYGUqXj3j7ar8E2XeNW` | `contact.fabric_approved` | CHECKBOX |
| Production Start Date | `bLVGiOlFlEZUvcWmQVn6` | `contact.production_start_date` | DATE |
| Expected Delivery Date | `Ksa9bNr1lzs8ib7eCcBf` | `contact.expected_delivery_date` | DATE |
| Referred By | `uodwt85UduEgATrTFTfI` | `contact.referred_by` | TEXT |

### Tags (33) — all ✅

**Lead Status (10):**
| Name | ID |
|---|---|
| New Lead | `1Sdjti4fSWiIQlf74A6Y` |
| Contacted | `T37iZopHnYsPzZUFdXbq` |
| Qualified | `1k1qG6fPififaeRSzSd8` |
| Ready to Book | `lZwdJ0mUdtfP4Lz1U7ZP` |
| Hot | `t4IJfRxEUqRjGx7T0SPL` |
| Warm | `ZvfYaeLiXWHEvj5XY0qM` |
| Cold | `PdSY4G290rIp1DZ5TnXN` |
| Went Cold | `dM6nVhbvAiFIOPueYaSs` |
| Objection - Nurture | `g03mAWpnE4iWTU4swIH8` |
| No-Show | `1hgZpNh1MsJFr3W7oL5l` |

**Source (6):**
| Name | ID |
|---|---|
| Source: Instagram DM | `2GhsX46TconJemtP4Or4` |
| Source: Referral | `03rMlWAczMVVfBVRT5Zl` |
| Source: Event | `iXG5DLPYwRnqPJQX7Bby` |
| Source: Paid Ad | `L159dJNk8UbuVOmWtgsN` |
| Source: Website | `BSdNziKVOXWurc2CfcLA` |
| Source: Brand Collab | `LqIQtuxbXaB7Ji0uD2ws` |

**Workflow (7):**
| Name | ID |
|---|---|
| Nurture Sequence | `inbjm35Tulr0gmCdrKNa` |
| Re-engagement | `gVYJJvfUvo9nQVWD0JOX` |
| Deposit Requested | `ebmrmWpxhh3TV8xFoAVW` |
| Deposit Paid | `ZpuvuZkrAFae412iW8n8` |
| Final Balance Requested | `smSCxzmpP1MOsUttMLgN` |
| Final Balance Paid | `BnBfWpg21iht2DYHykHF` |
| AI Handoff Requested | `iZHNCHtgZewemXPjel9s` |

**Product (5):**
| Name | ID |
|---|---|
| Product: Wedding Suit | `8mbgiuPT5pVXgOyTzsFK` |
| Product: Business Suit | `jNOLbzMC8a1BcwdBvM86` |
| Product: Tuxedo / Black-tie | `dQYXtiXpzkuLdHxAvMBJ` |
| Product: Multi-piece | `CenxS0Eogv7QTP3I9FLA` |
| Product: Accessories | `fCnzGXInmC8GgVdhJiK1` |

**Retention (5):**
| Name | ID |
|---|---|
| Delivered | `mCXtXYHhC5yvR8SU7eKE` |
| VIP Client | `ak7a8iVrsNSkYsNVORpb` |
| Repeat Client | `Ol2f8hprfjinWUyrVee3` |
| Birthday Opt-In | `aoBlSO6Tc9OF2Le5js4e` |
| Style Insider Subscriber | `B4sG9jmAj68xbyIfJ08n` |

### Calendars (2) — all ✅

| Name | ID | Slug | Duration | Owner | Hours |
|---|---|---|---|---|---|
| Private Style Consultation | `Zc7XHojhTMS1jQE38iQQ` | `private-style-consultation` | 90 min | Dustin Smith (`s46WJo2jtlo6LH7kUtKl`) | Tue–Sat 10:00–18:00 |
| Fitting Appointment | `wIk6BoRMIxLieAezqYrd` | `bespoke-fitting` | 60 min | Dustin Smith | Mon–Sat 10:00–17:00 |

Both calendars use buffers from spec (Consult: 30/30 min; Fitting: 15/15 min), min notice 24h (consult) / 48h (fitting), auto-confirm ON, reschedule/cancel links enabled. Reminder SMS/Email intentionally **not** configured on the calendar — WF2 owns reminders to avoid double-sends.

**Note on slugs:** The spec called for `/private-consultation` and `/fitting`. Both were already taken in this sub-account, so I used `/private-style-consultation` and `/bespoke-fitting`. The customer-facing booking URL pattern is typically `https://api.leadconnectorhq.com/widget/booking/{slug}` — update the two `REPLACE_ME` booking URL custom values once Maurice's branded link domain is confirmed (likely `https://link.creait.com/widget/booking/{slug}`).

---

## Skipped items

Across this run, **8 custom fields** were detected as already existing on a second idempotent re-run (they had been created earlier in the same session after I first hit the MONETARY→MONETORY spelling fix). That's expected behavior for idempotency and is not a concern.

No duplicates of tags, custom values, or calendars were found. The 2 calendar name slots were free; only slugs had to be disambiguated.

---

## Failures (resolved, documented)

| Item | Error | Root cause | Resolution |
|---|---|---|---|
| GET custom values (first attempt) | HTTP 403 Cloudflare error 1010 | Python urllib's default User-Agent is on a block list | Added `User-Agent: curl/8.4.0` header to the shared `_ghl.py` helper |
| POST customFields/folder | HTTP 404 | The path `/locations/{id}/customFields/folder` does not exist in v2 | Switched to `POST /customFields` with `documentType: "folder"`; request returns 2xx but with null id. Fields were created without a parentId and land in the default folder. Move via UI if Dustin wants the "Bespoke Order Details" folder. |
| POST customFields (Occasion) first try | HTTP 400 `v.trim is not a function` | `options` was shaped as `[{"name": "..."}, ...]` | Changed to array of strings: `["Wedding", ...]` — confirmed by probe |
| POST customFields (Deposit Amount) | HTTP 422 `dataType must be one of…` | I used `MONETARY` (correct English) but GHL accepts `MONETORY` (their typo) | Changed both `MONETARY` fields to `MONETORY` |
| POST opportunities/pipelines | **HTTP 401 — "The token is not authorized for this scope."** | PIT lacks `opportunities.write` scope | **STILL BLOCKED.** Rolled to Phase 2 UI checklist §2.0 — either regenerate the PIT with `opportunities.write` and re-run `phase1d_pipeline.py`, or build the pipeline via UI. The script is idempotent by pipeline name. |
| POST calendars (Private Style Consultation) | HTTP 400 "Calendar slug is already taken" | Slug `private-consultation` was already taken on this location | Retried with `private-style-consultation` — succeeded |
| POST calendars (Fitting Appointment) | HTTP 400 "Calendar slug is already taken" | Slug `fitting` and `fitting-appointment` both taken | Retried with `bespoke-fitting` — succeeded |
| GET snippets / POST snippets | HTTP 404 / 401 | `/snippets/` path doesn't exist; `/snippets/sms` is scope-blocked | **Accepted.** All 22 templates rolled into Phase 2 UI checklist §2.4, consistent with forms decision |

---

## PIT scope status

Scope | Endpoint probed | Status
---|---|---
`locations.readonly` | GET /locations/{id} | ✅ works
`locations/customValues.readonly/write` | GET + POST /locations/{id}/customValues | ✅ works
`locations/customFields.readonly/write` | GET + POST /locations/{id}/customFields | ✅ works
`locations/tags.readonly/write` | GET + POST /locations/{id}/tags | ✅ works
`calendars.readonly/write` | GET + POST /calendars/ | ✅ works
`opportunities.write` | POST /opportunities/pipelines | ❌ **401 "not authorized"** — required to finish Phase 1D via API
`snippets.readonly/write` | GET /snippets/sms | ❌ 401 scope
`users.readonly` | GET /users/ | ✅ works
`workflows.readonly` | GET /workflows/ | ✅ works

**Recommendation:** If you want the pipeline created programmatically (nice for re-provisioning later), regenerate the PIT with `opportunities/pipelines.write` (or a broader `opportunities.*` scope) and re-run `build-output/phase1d_pipeline.py`. Otherwise build via UI — it's 12 stages, ~5 minutes in the UI, and is a one-time action.

---

## REPLACE_ME — Custom values still needing real data

These 7 custom values hold `REPLACE_ME`. Dustin + Maurice must replace them before Phase 3 launches (merge fields in templates will render the literal string "REPLACE_ME" otherwise — embarrassing in a luxury brand).

| # | Custom value | Needed for | How to fill |
|---|---|---|---|
| 1 | `booking_consultation_url` | WF1 welcome, social bios, AI Concierge | Format: `https://link.creait.com/widget/booking/private-style-consultation` (or whatever Maurice's branded link domain is). Calendar ID `Zc7XHojhTMS1jQE38iQQ`, slug `private-style-consultation`. Verify in GHL Calendar Settings → Share |
| 2 | `booking_fitting_url` | WF5 fitting-ready message | Same pattern, slug `bespoke-fitting`, calendar ID `wIk6BoRMIxLieAezqYrd` |
| 3 | `lookbook_url` | WF1 welcome email, WF8 emails | Public lookbook URL. If not live yet, can be left as REPLACE_ME and we ship Phase 2 with `Or email me for recent work` replacement copy |
| 4 | `testimonial_page_url` | WF7, WF8, WF10 | Public testimonials page URL. Same fallback applies |
| 5 | `referral_form_url` | WF10 Day 15 referral email | After Phase 2 `Refer a Friend` form is built, paste the public form URL here |
| 6 | `review_link_google` | Phase 5 reputation workflows | OK to leave until Phase 5 (Google Business Profile + reviews) |
| 7 | `assistant_name` | All 11 internal notifications that CC the assistant | Dustin provides his assistant's first name |

**Updated on the fly with real data** (no longer REPLACE_ME):
- `business_name` — `Dustin's Bespoke`
- `business_phone` — `(757) 676-1593` (pulled from location profile)
- `studio_address` — `3239 Camden Court, Atlanta, GA 30349` (pulled from location profile)
- `dustin_signature_block` — `— Dustin / Dustin's Bespoke / (757) 676-1593`

---

## Audit findings (pre-existing state of sub-account)

Not blocking, but worth knowing:

- **Pre-existing calendars (8):** Boutique Shopping Experience, Dustin Smith's Personal Calendar, The Manor Consultation, test tester's Personal Calendar, Custom Tailoring & Alterations, Personal Styling & Wardrobe Consultations, Made-to-Measure Garments, Schedule an Appointment. None conflict by name with our 2 new calendars. Slugs `private-consultation` and `fitting` were globally reserved — had to disambiguate.
- **Pre-existing workflows (6):** `1. New Lead Nurture (Fast 5) - Claim Offer`, `2. Appointment Confirmation + Reminders`, `3. Appt No Show`, `4. New Sale - Send Review Request`, `5. Long-Term Nurture` (plus one more). **These collide with the WF1–WF13 naming scheme.** Phase 2 UI checklist §2.1 recommends renaming with `_OLD_` prefix before Phase 3 begins.
- **Pre-existing tags (4):** `follow-up`, `high priority`, `the manor`, `warm lead`. No conflict; leave or clean up.
- **Pre-existing custom field (1):** `Message` (LARGE_TEXT). Unrelated; leave.
- **Pre-existing custom values (4):** `Promotion Name`, `Marketing - Website Booking Page URL`, `Hours of Operation`, `Marketing - New Booking Thank You Page URL`. Snapshot boilerplate. Ignore.
- **Pre-existing pipeline (1):** `Marketing Pipeline`. Unrelated; leave.
- **Users (1):** Only Dustin Smith (`s46WJo2jtlo6LH7kUtKl`, admin, email `Dsmith75797@gmail.com`). No assistant user yet — add one in Phase 2.6.

### Location-level flags (important)

- **SaaS subscription status: `canceled`** per `GET /locations/{id}`. Verify with the agency that the sub-account still has full feature access before Phase 3 workflow work goes live. If the subscription is actually canceled and we're in a grace period, we should resolve it before building 13 workflows that depend on SMS/email/AI access.
- **`botServiceEnabled: false`** at location level. The Conversation AI module (Phase 4) requires this to be ON. Flip it from the agency panel before Phase 4.

---

## Files generated in this build

Located in `build-output/` (gitignored):

| File | Purpose |
|---|---|
| `_ghl.py` | Shared Python HTTP helper (reads `.env`, applies User-Agent) |
| `_ids_custom_values.json` | Machine-readable manifest of created custom values |
| `_ids_custom_fields.json` | Manifest of custom fields |
| `_ids_tags.json` | Manifest of tags |
| `_ids_calendars.json` | Manifest of calendars |
| `_audit_*.json` | Raw audit responses from GET probes |
| `phase1a_custom_values.py` | Idempotent creator script (safe to re-run) |
| `phase1b_custom_fields.py` | Idempotent creator |
| `phase1c_tags.py` | Idempotent creator |
| `phase1d_pipeline.py` | Idempotent creator — **currently 401s until PIT scope updated** |
| `phase1e_calendars.py` | Idempotent creator |
| `PHASE_2_UI_CHECKLIST.md` | Pipeline, forms, 22 templates, 9 sequence emails, notification setup |
| `PHASE_3_UI_CHECKLIST.md` | All 13 workflows (WF1–WF13) + WF-AI Handoff |
| `PHASE_4_UI_CHECKLIST.md` | AI Concierge config + 20 tests, 2 forms, daily digest, QA, go-live |
| `BUILD_LOG.md` | This file |

Top-level: `.env` (PIT + location + base URL, gitignored) and `.gitignore`.

---

## Re-run safety

All five Phase-1 scripts are idempotent:
- CV, CF, Tags: name-based skip on existing items
- Pipeline: name-based skip (but currently blocked on scope)
- Calendars: name-based skip; slugs are still the unique constraint on re-create, but re-run just sees the name-match and skips

Safe to re-run any script with no risk of duplicates. If the PIT is upgraded, a single `python3 phase1d_pipeline.py` finishes Phase 1 in ~2 seconds.

---

## Next action (owner: Maurice)

1. Decide on the pipeline path: regenerate PIT with `opportunities.write` (and re-run script), or build pipeline in UI per Phase 2 §2.0 checklist.
2. Confirm SaaS subscription status with the agency (status showed `canceled`).
3. Toggle `botServiceEnabled: true` on this location (agency panel).
4. Fill the 7 `REPLACE_ME` custom values once booking URLs + assistant name are known.
5. Kick off A2P 10DLC registration (Settings → Phone Numbers → A2P 10DLC) — do not delay; 2–10 business days to approval.
6. Hand the three `PHASE_*_UI_CHECKLIST.md` files to whoever is driving the UI build (likely a drive-along session with Dustin per the runbook's Session plan in file 12).
