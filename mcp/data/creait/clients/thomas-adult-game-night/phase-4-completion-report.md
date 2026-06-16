# Phase 4 Track A Completion Report — Workflows

**Date:** 2026-05-04
**Client:** Adult Game Nights (Thomas Gray)
**Location ID:** `1uN6mnlvX9JQ5QvrLewp`
**Track:** A (Claude Code prep + verification)

---

## Headline

Track A is complete. **8 workflow specs, 8 AI Builder prompts, 8 custom values, 2 verification/wiring scripts, and 1 Track B build guide** are all in place. Track B (UI build via AI Workflow Builder) is unblocked and can run independently the moment the upstream UI work (pipelines, forms, email-body paste, SMS snippets) is done.

The verification + wiring scripts are idempotent and ready to be re-run any time IDs change. The form-wiring spec (`logs/form-wiring-spec.json`) is now the canonical map between forms, pipelines, workflows, and tags — when forms/workflows/pipelines come online, IDs flow into this file automatically.

---

## Status Summary

| Task | Name | Status | Mechanism |
|------|------|--------|-----------|
| 4.0 | Probe workflows + customValues endpoints | ✅ done | Confirmed `customValues` is full CRUD; `workflows` is read-only |
| 4.1 | `/config/workflows.json` (8 specs) | ✅ written | Single source of truth |
| 4.2 | `/docs/workflow-ai-builder-prompts.md` | ✅ written | Paste-ready prompts + per-workflow gotchas |
| 4.3a | `scripts/09-verify-workflows.js` | ✅ written + tested | Currently reports 0/8 matched (correct — Track B hasn't built yet) |
| 4.3b | `scripts/10-wire-form-submissions.js` | ✅ written + tested | Generated `docs/form-wiring-checklist.md` |
| 4.4 | Custom values via API | ✅ 8/8 created | `POST /locations/{id}/customValues` |
| 4.5 | `/docs/workflow-build-instructions.md` (Track B) | ✅ written | Step-by-step UI build process |

**Track B status: not started (expected).** Will be reported separately once Maurice/team builds workflows in the UI.

---

## ✅ API-Driven Outcomes

### Task 4.4 — Custom values (8/8)

All 8 created via `POST /locations/{locationId}/customValues`. PIT has full CRUD on this resource — first endpoint we've found in this category.

| Custom value | Field key (use in workflows) |
|---|---|
| Business Phone | `{{ custom_values.business_phone }}` |
| Business Email | `{{ custom_values.business_email }}` |
| Business Name | `{{ custom_values.business_name }}` |
| App Download iOS | `{{ custom_values.app_download_ios }}` |
| App Download Android | `{{ custom_values.app_download_android }}` |
| Support URL | `{{ custom_values.support_url }}` |
| Cart Recovery Discount Code | `{{ custom_values.cart_recovery_discount_code }}` (= `PLAY10`) |
| Reactivation Discount Code | `{{ custom_values.reactivation_discount_code }}` (= `WELCOMEBACK`) |

Full ID list: [`logs/custom-values-created.json`](../logs/custom-values-created.json)

Two of the 8 (`app_download_ios`, `app_download_android`) hold placeholder values until Thomas provides the actual app store URLs. To update, run `POST /locations/{id}/customValues/{cvId}` (or just edit in UI — both work).

### Task 4.0 — Endpoint probe results

| Endpoint | PIT scope | Status |
|---|---|---|
| `GET /workflows/?locationId=…` | ✅ readonly | works (returns 0 currently) |
| `POST /workflows` | ❌ | not exposed to PIT — Track B uses UI |
| `GET /locations/{id}/customValues` | ✅ | works |
| `POST /locations/{id}/customValues` | ✅ | works |
| `DELETE /locations/{id}/customValues/{id}` | ✅ | works (verified with test value) |
| `PUT /forms/{id}` | ❌ | 404 — no mutation endpoint exists for forms (consistent with Phase 2 IAM-not-supported pattern) |

Therefore Track A's wiring script generates a UI checklist instead of attempting form updates.

---

## 📋 The 8 Workflow Specs

Source: [`/config/workflows.json`](../config/workflows.json). Build prompts: [`/docs/workflow-ai-builder-prompts.md`](workflow-ai-builder-prompts.md).

| # (priority) | Display name | Trigger | Steps | Stop conditions | Notes |
|---|---|---|---|---|---|
| 1 | **Reactivation Campaign (Klaviyo Import)** | Tag `source-import-klaviyo` | 9 | `engaged-30d`, `unsubscribed` | Simplest — build first as AI Builder smoke test |
| 2 | **Cart Abandonment Recovery** | Tag `cart-abandoned` | 10 | `buyer` (with tag swap), `unsubscribed` | 3 emails + 1 SMS over 9 days |
| 3 | **Post-Purchase Welcome Series** | Tag `buyer` | 15 | `unsubscribed`, `complaint` (alert Thomas) | 5 emails over 30 days, pipeline move |
| 4 | **Event Registration & Follow-Up** | Form `Event Registration` submitted | 16 | `unsubscribed` | Dynamic tag generation per event |
| 5 | **Sponsor Pipeline (B2B)** | Form `Sponsorship Inquiry` submitted | 11 | `sponsor-engaged`, `signed-sponsor` (with stage move) | Internal email + 3 follow-ups |
| 6 | **Game Night Service Booking** | Form `Game Night Service Booking` submitted | 21 | `booking-canceled` | Most complex — multi-phase, internal SMS to Thomas, date-relative scheduling |
| 7 | **Review Request Automation** | 7d after `buyer` OR 1d after `service-completed` | 4 + branches | `reviewed`, `unsubscribed` | Branches on rating: 4-5★ → Google review, 1-3★ → Thomas alert |
| 8 | **App Lobby Capture** | Inbound webhook (URL TBD) | 11 | none | Shell only — webhook URL captured when Thomas's app developer connects |

### Why these 8 (and not the 6 form-related ones)

The 6 forms map to the 8 workflows like this:

| Form | Triggers workflow | Notes |
|---|---|---|
| Game Night Service Booking | #6 (Game Night Service Booking) | direct |
| Sponsorship Inquiry | #5 (Sponsor Pipeline B2B) | direct |
| Event Registration | #4 (Event Registration & Follow-Up) | direct |
| Wholesale Inquiry | _none — auto-response email + internal email_ | no workflow needed yet |
| Affiliate Creator Application | _none — manual review by Thomas_ | no workflow needed yet |
| 3D Print Custom Order | _none — auto-quote email + internal_ | no workflow needed yet |

The 3 form types without dedicated workflows still get tags + internal email notifications (set in form submit settings, [`docs/form-wiring-checklist.md`](form-wiring-checklist.md)). Build dedicated workflows in Phase 5+ if volume picks up.

The 8 core workflows include 3 not directly form-driven:
- #1 Reactivation Campaign — fires on Klaviyo import tag
- #2 Cart Abandonment — fires on Shopify webhook
- #3 Post-Purchase — fires on Shopify webhook

Plus #7 (Review Request) is delayed-trigger and #8 (App Lobby) is webhook-only.

### Workflow 8 (App Lobby) is intentionally a "shell"

`config/workflows.json` flags it `"status": "shell_only"` with blocker:
> Webhook URL pending — Thomas's app developer must configure endpoint

The shell is built so the structure (tags, custom field updates, pipeline move, conditional buy-CTA) is in place. When the developer is ready, capture the GHL-generated webhook URL into `logs/workflow-5-webhook-url.txt` and hand it over.

---

## 🛠 Verification & Wiring Scripts

### `scripts/09-verify-workflows.js` (run after Track B)

Pulls `GET /workflows/`, matches each against `config/workflows.json` `display_name`, and writes to `logs/workflows-created.json`:
- `matched` — workflows found in CreateOS that match a spec
- `missing` — specs without a matching workflow (with `build_priority` and `blocker` fields surfaced)
- `unknown` — workflows in the account not in our spec
- `last_verified` timestamp

**Tested in current state (0 workflows in account):**
```
Fetched 0 workflow(s) from CreateOS.
[MISS] Cart Abandonment Recovery (priority 2)
[MISS] Post-Purchase Welcome Series (priority 3)
…
Matched: 0/8

Still needed (build priority order):
  1. Reactivation Campaign (Klaviyo Import)
  2. Cart Abandonment Recovery
  …
  8. App Lobby Capture  [Webhook URL pending — …]
```

Re-run after each batch of UI builds for clean progress tracking.

### `scripts/10-wire-form-submissions.js` (run after 09)

Reads `logs/forms-created.json`, `logs/workflows-created.json`, `logs/pipelines-created.json`, and `logs/form-wiring-spec.json`. For each of the 6 forms:
- Looks up form ID, workflow ID, pipeline ID + stage ID
- Writes back into `form-wiring-spec.json` (idempotent)
- Generates [`docs/form-wiring-checklist.md`](form-wiring-checklist.md) — one section per form with copy-paste UI steps for Maurice

**Why a checklist instead of automation:** Forms have no PUT/PATCH endpoint in GHL's API for any token type (probed; all returned 404 or 401). UI configuration is the only path.

**Tested in current state:** generates a checklist that correctly says "🟡 not yet built" for all 6 forms + 8 workflows + 4 pipelines, with the right pipeline/stage targets per form.

---

## 📦 Custom Values & Their Use in Workflows

In every workflow's email step, use `{{ custom_values.field_key }}` for values that:
- Don't change per-contact (e.g., business phone, discount codes, app links)
- Should be editable in one place without redeploying templates

The 8 custom values cover the common cases. Add more via `node scripts/11-create-custom-values.js` after extending `config/custom-values.json`.

**Example use:** workflow 2 (Cart Abandonment Recovery) step 7 sends `cart_abandonment_3` which includes the discount code. The HTML body in `/email-templates/cart_abandonment_3.html` uses `{{custom_values.cart_recovery_discount_code}}` instead of hardcoding `PLAY10`. To rotate the code: edit the custom value, all emails update.

---

## 🟡 Outstanding Items

### Required before Track B can proceed
1. **Pipelines (4)** — UI build OR scope fix. Phase 1.4 retry still 401. Worth doing the JWT inspection per Phase 4 prompt instructions before assuming UI build.
2. **Forms (6)** — UI build per [`docs/forms-manual-build-guide.md`](forms-manual-build-guide.md)
3. **Email body paste (20)** — UI work per template. Stubs already named correctly.
4. **SMS snippets (8)** — UI build per [`docs/sms-snippets-build-guide.md`](sms-snippets-build-guide.md)

### Required before Workflow 8 can fire
- App developer connection (webhook URL placeholder)

### Open for Phase 5
- **`Review Rating` numerical custom field** — needed for workflow 7's branching. Add to `config/custom-fields.json` (or a new file) and run the create script. Trivial.
- **Voice samples + FAQ list from Thomas** — for AI Voice Agent persona + knowledge base
- **Google review URL** — once Adult Game Nights has a Google Business Profile

### From Phase 1, still open
- Sub-account profile manual update (name, timezone, email) — 5 min in Settings → Business Profile

---

## 📋 Resource Inventory Update

| Phase | Resource | Count | Status |
|---|---|---|---|
| 1 | Custom fields (initial) | 11 | ✅ live |
| 1 | Tags | 32 | ✅ live |
| 1 | Calendars + blockout | 3 + 1 | ✅ live |
| 2 | Custom fields (form support) | 27 | ✅ live |
| 3 | Email template stubs | 20 | ✅ live (bodies pending paste) |
| 4 | Custom values | 8 | ✅ live |
| **Total via API** | | **101** resources | |
| 1.1 | Sub-account profile | — | 🟡 manual UI fix |
| 1.4 | Pipelines | 4 | 🟡 manual UI build |
| 2.1 | Forms | 6 | 🟡 manual UI build |
| 2.3 | Landing pages | 6 | 🟡 manual UI build |
| 3.2 | SMS snippets | 8 | 🟡 manual UI build |
| 4 | Workflows | 8 | 🟡 manual UI build (Track B) |
| **Pending UI** | | **33** items | ~5 hours of paste/click |

---

## File Tree (delta from Phase 3)

```
/Users/reecebyob/adult-game-nights-build/
├── /scripts/
│   ├── 09-verify-workflows.js          ✅ ready to run after Track B
│   ├── 10-wire-form-submissions.js     ✅ ready (regenerates checklist)
│   └── 11-create-custom-values.js      ✅ executed (idempotent)
│
├── /config/
│   ├── workflows.json                  ← 8 specs, source of truth for both tracks
│   └── custom-values.json              ← 8 values (executed)
│
├── /logs/
│   ├── custom-values-created.json
│   ├── workflows-created.json          ← (will populate after Track B + verify run)
│   └── form-wiring-spec.json           ← (auto-updated by wire script)
│
└── /docs/
    ├── workflow-ai-builder-prompts.md   ← Track B paste targets
    ├── workflow-build-instructions.md   ← Track B process guide
    ├── form-wiring-checklist.md         ← UI checklist (auto-generated)
    └── phase-4-completion-report.md     ← this file
```

---

## ⏭️ Recommended Next Steps

### Immediate (unblock Track B)
1. Maurice or team works through pre-build deps (pipelines → forms → email paste → SMS snippets)
2. Track B starts at **workflow 1 (Reactivation Campaign)** — easiest, fastest validation that the AI Builder process works
3. After workflow 1 saves cleanly, knock out workflows 2-7 in priority order
4. Workflow 8 (App Lobby): build the shell, capture webhook URL, send to app dev

### After Track B is done
1. Run `node scripts/09-verify-workflows.js` — should report 8/8 matched
2. Run `node scripts/10-wire-form-submissions.js` — final wiring checklist for forms
3. Test fire each workflow with a fresh test contact, document results in `logs/workflow-test-results.json`

### Phase 5 prep — what to gather before kicking off
The Phase 4 prompt mentioned outstanding items from Thomas:
- **Voice samples** — needed for AI Voice Agent personality (Phase 5). 3-5 minutes of audio of Thomas talking naturally about his business is enough. AI Voice Agent has full API access so we can build it programmatically once we have the samples.
- **FAQ list** — for AI Conversation Agent knowledge base. Even a rough Google Doc of "things people ask" will do.
- **App developer intro** — for workflow 8 webhook URL.

These three unlocks make Phase 5 (AI Agents) a heavy-Code, light-UI phase. Worth pausing to gather them before launching Phase 5 — they're the difference between "agent is generic" and "agent sounds like Thomas."

---

**Track A awaiting review. Track B awaiting upstream UI work.**
