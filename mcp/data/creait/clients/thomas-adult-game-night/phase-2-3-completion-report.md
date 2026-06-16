# Phase 2 + 3 Completion Report — Adult Game Nights CRM

**Date:** 2026-05-04
**Client:** Adult Game Nights (Thomas Gray)
**Location ID:** `1uN6mnlvX9JQ5QvrLewp`

---

## Headline

The GHL Private Integration Token allows **API-driven creation** for: custom fields ✅, tags ✅, calendars ✅, email template stubs ✅. Everything else in Phases 2+3 (forms, pipelines, SMS templates, landing pages) returns either 401 "scope not authorized" or 401 "route not yet supported by IAM" — these are **platform-wide PIT limitations**, not config errors. We pivoted to a **specs-as-source-of-truth pattern**: every blocked resource has a complete config file + manual build guide so the UI work is paste-only and Phase 4 can wire everything together once IDs are captured.

---

## Status Summary

| Task | Name | Status | Mechanism |
|------|------|--------|-----------|
| 1.4 (retry) | Pipelines | ❌ Still blocked | API 401 — manual UI |
| 2.1a | Form-support custom fields | ✅ 27/27 | API |
| 2.1 | Forms (6) | 🟡 Specs only | API blocked, UI build |
| 2.2 | Form-to-pipeline wiring | ✅ Spec written | Doc |
| 2.3 | Landing pages (6) | 🟡 Specs only | API blocked, UI build |
| 2.4 | DNS setup | ✅ Doc written | Maurice action |
| 3.1 | Email templates (20) | ✅ Stubs + HTML | API stubs + paste HTML |
| 3.2 | SMS templates (8) | 🟡 Specs only | API blocked, UI build |

**Aggregate:** 4 tasks API-complete, 4 tasks specs-ready-for-UI. No errors blocking forward progress; every "specs only" task has a build guide.

---

## ✅ API-Driven Outcomes

### Task 2.1a — Form-support custom fields (27/27)

Added 27 fields needed for form submissions. Total custom fields in account now: **38**. Full ID list in [`logs/custom-fields-forms-created.json`](../logs/custom-fields-forms-created.json) and cross-reference table in [`docs/forms-manual-build-guide.md`](forms-manual-build-guide.md#custom-field-ids-cross-reference).

**Quirk repeated:** "Website" collided with `contact.website` standard field — renamed to **"Business Website"**. Standard `contact.website` still available.

### Task 3.1 — Email templates (20 stubs + 20 HTML files)

20 email template stubs created in CreateOS via `POST /emails/builder` (`type: blank`). IDs saved in [`logs/email-templates-created.json`](../logs/email-templates-created.json). Phase 4 workflows can reference these IDs directly.

**Critical limitation discovered:** The `/emails/builder` POST endpoint accepts `name` and `type` only — it does **not** accept HTML body content, and there is no PUT/PATCH route to set the body afterward. Tested:
- POST with `html` field → ignored
- POST with `editorType: 'html'` → 422 (type must be html/folder/import/builder/blank/ai_template)
- POST with `type: 'import'` → requires Mailchimp/ActiveCampaign credentials, no raw HTML
- PUT/PATCH on `/emails/builder/{id}` → 404
- `DELETE /emails/builder/{locationId}/{id}` → works (tested)

**Workaround:** Body content is rendered to `/email-templates/<internal_name>.html` (paste-ready, brand-styled, 600px max-width, inline CSS). Manual paste workflow:

1. Open CreateOS → Marketing → Emails → Templates
2. Click each stub (already named correctly)
3. Choose builder → Import HTML → paste contents of matching `.html` file
4. Set Subject + Preview Text from [`config/email-templates.json`](../config/email-templates.json)
5. Save

**The 20 templates cover:** lifecycle (welcome, app download, hosting tips, review request), transactional (3× cart abandonment, post-purchase, service confirmation/reminder/day-of, event reminder 7d/1d), marketing (3D kit upsell, re-permission, reactivation, sponsor pitch, wholesale response), and 1 internal (negative review alert). Voice: Thomas's energetic/casual style — "vibe", "lit", "pull up". Refresh pass scheduled when his real voice samples land.

**Brand styling:** Red `#D50000` CTAs, yellow `#FFD600` accents, dark `#1A1A1A` headings, light grey `#F5F5F5` footer. Dark badge in header reads "ADULT GAME NIGHTS" in yellow. Inline-CSS only (Outlook-safe). Sample preview: [`email-templates/welcome_email.html`](../email-templates/welcome_email.html).

---

## 🟡 Specs-Only Outcomes (UI build needed)

### Task 1.4 (retry) — Pipelines

`POST /opportunities/pipelines` still returns 401 even after the user reported the scope was added. Tested 5 path variants. **Action required:** Either confirm the PIT JWT actually contains the scope (the UI may show a setting that didn't propagate), or build the 4 pipelines manually in **Opportunities → Pipelines → New Pipeline** using [`config/pipelines.json`](../config/pipelines.json) as the spec.

After UI build, re-running [`scripts/03-create-pipelines.js`](../scripts/03-create-pipelines.js) will skip existing names and capture IDs into [`logs/pipelines-created.json`](../logs/pipelines-created.json).

### Task 2.1 — Forms (6 specs)

`POST /forms/` returns:
> 401 — This route is not yet supported by the IAM Service.

This is a platform-wide limitation, not scope-specific. Build manually in **Sites → Forms → + Create Form**. Full guide: [`docs/forms-manual-build-guide.md`](forms-manual-build-guide.md).

After UI build, run [`scripts/06-fetch-form-ids.js`](../scripts/06-fetch-form-ids.js) to populate `logs/forms-created.json` keyed by name.

### Task 2.3 — Landing pages (6 specs + brand guide)

`POST /funnels/page` returns "not yet supported by IAM". GHL exposes `funnels.readonly` and `funnels/page.readonly` but no write endpoints. All 6 pages are spec'd in [`/landing-pages/`](../landing-pages/):

- [`00-brand-styles.md`](../landing-pages/00-brand-styles.md) — palette, type, components (apply to all)
- [`01-book-game-night.md`](../landing-pages/01-book-game-night.md)
- [`02-3d-prints.md`](../landing-pages/02-3d-prints.md)
- [`03-sponsor.md`](../landing-pages/03-sponsor.md)
- [`04-creators.md`](../landing-pages/04-creators.md)
- [`05-events-template.md`](../landing-pages/05-events-template.md) (template + Russell Center July 3 instance)
- [`06-wholesale.md`](../landing-pages/06-wholesale.md)

Build in **Sites → Funnels → New Funnel**. After build, paste the funnel/page IDs into [`logs/form-wiring-spec.json`](../logs/form-wiring-spec.json) so Phase 4 workflows know where to send people.

### Task 3.2 — SMS templates (8 specs)

`POST /locations/{id}/templates` returns 401 with PIT. Build in **Settings → Snippets**. Full guide with TCPA compliance checklist: [`docs/sms-snippets-build-guide.md`](sms-snippets-build-guide.md).

**TCPA reminder for Phase 4:** Legacy 15K phone list cannot be SMS'd until the `reactivation_sms` re-permission flow runs and YES/STOP keywords are processed.

---

## 📋 Resource ID Inventory

### Custom fields (38 total)
- Phase 1: 11 in [`logs/custom-fields-created.json`](../logs/custom-fields-created.json)
- Phase 2: 27 in [`logs/custom-fields-forms-created.json`](../logs/custom-fields-forms-created.json)

### Tags (32)
[`logs/tags-created.json`](../logs/tags-created.json)

### Calendars (3)
[`logs/calendars-created.json`](../logs/calendars-created.json) + July 3 2026 blockout

### Email template stubs (20)
[`logs/email-templates-created.json`](../logs/email-templates-created.json) — all IDs ready for Phase 4 workflow references

### Forms (6) — **pending UI build**
[`logs/form-wiring-spec.json`](../logs/form-wiring-spec.json) has placeholders; populated by `scripts/06-fetch-form-ids.js` after UI build.

### Pipelines (4) — **pending UI build / scope fix**
[`config/pipelines.json`](../config/pipelines.json) has spec.

### SMS snippets (8) — **pending UI build**
[`config/sms-templates.json`](../config/sms-templates.json) has spec.

---

## 🟡 Action Items for Maurice

1. **Pipelines (~15 min):** Either get the agency token sorted OR build the 4 pipelines manually in CreateOS. After build, run `node scripts/03-create-pipelines.js` to capture IDs.
2. **Forms (~30 min):** Build all 6 forms in CreateOS following [`forms-manual-build-guide.md`](forms-manual-build-guide.md). Each form's submit-side wiring (tags, pipeline, notification email) is documented per-form. After build, run `node scripts/06-fetch-form-ids.js`.
3. **Landing pages (~2-3 hr):** Build the 6 pages in Sites → Funnels using `/landing-pages/*.md` specs. Embed the corresponding form on each.
4. **Email templates (~45 min):** For each of the 20 stubs in CreateOS, paste the matching `.html` file from `/email-templates/` and set Subject + Preview Text from `config/email-templates.json`.
5. **SMS snippets (~10 min):** Build 8 snippets per [`sms-snippets-build-guide.md`](sms-snippets-build-guide.md). Quiet hours and TCPA compliance baked into the guide.
6. **DNS (~10 min):** Add CNAME + SPF/DKIM records per [`dns-setup-instructions.md`](dns-setup-instructions.md) in GoDaddy. Then verify domain in CreateOS.
7. **Account profile (deferred from Phase 1):** In Settings → Business Profile, manually update name → "Adult Game Nights", timezone → America/New_York, email → adultgamenights@gmail.com, address → 504 Fair Street.

**Estimated total UI work: 4-5 hours** (mostly landing pages — everything else is paste/click).

---

## API Quirks Discovered (Phase 2+3)

Added to [`docs/api-reference.md`](api-reference.md):

1. **`POST /forms/`** → 401 "This route is not yet supported by the IAM Service" — platform-wide, not scope-fixable
2. **`POST /funnels/page`** → 404 / 401 not supported — only `funnels.readonly` works
3. **`POST /locations/{id}/templates`** → 401 not authorized for PIT (works at agency level)
4. **`POST /opportunities/pipelines`** → 401 even with reported `opportunities.write` scope on PIT
5. **`POST /emails/builder`** → ✅ Works for stubs only. `type` must be in `[html, folder, import, builder, blank, ai_template]`. **Body content cannot be set via API** — no PUT/PATCH route.
6. **`DELETE /emails/builder/{locationId}/{id}`** → ✅ Works (note: locationId is in path, not query)
7. **Standard-field collisions extend to "Website"** — same pattern as "City" in Phase 1. Use a qualifier prefix.

---

## ⏭️ Recommended Next Steps

### For Phase 4 (Workflows)
The dual-track is now well-set up:

**Track A — Claude Code (already prepped):**
- All resource IDs that Phase 4 workflows reference are either captured (custom fields, tags, calendars, email templates) or have a capture script ready (`06-fetch-form-ids.js`, `03-create-pipelines.js` re-run).
- `/logs/form-wiring-spec.json` is the single source of truth for which form triggers which workflow.

**Track B — Claude in Chrome (paste-ready):**
- Email subject + preview + HTML body all written.
- SMS bodies + triggers + quiet-hours rules all documented.
- Workflow descriptions can be drafted in plain English from the form-wiring spec and dropped straight into the AI Workflow Builder.

### Suggested order for Phase 4 prompt
1. Confirm Maurice has cleared blockers 1+2+3 (pipelines, forms, landing pages) before Phase 4 — otherwise workflow triggers won't have IDs to bind to.
2. Build core 8 workflows in this order: Welcome → Cart Abandonment → Post-Purchase → Service Booking → Event Reminder → Sponsor Lead → Wholesale → Negative Review Alert.
3. Each workflow has a corresponding email template (already have IDs) + optional SMS snippet (will have IDs after Maurice builds them).

---

## File Tree (delta from Phase 1)

```
/Users/reecebyob/adult-game-nights-build/
├── /scripts/
│   ├── 05-create-form-custom-fields.js   ✅ executed (idempotent)
│   ├── 06-fetch-form-ids.js              ⏳ run after UI form build
│   └── 07-create-email-templates.js      ✅ executed
│
├── /config/
│   ├── custom-fields-forms.json          ← 27 form-support fields
│   ├── forms.json                        ← spec for 6 forms
│   ├── email-templates.json              ← 20 templates metadata
│   └── sms-templates.json                ← 8 SMS specs
│
├── /email-templates/                     ← 20 paste-ready HTML files
│
├── /landing-pages/                       ← 6 page specs + brand guide
│   ├── 00-brand-styles.md
│   ├── 01-book-game-night.md
│   ├── 02-3d-prints.md
│   ├── 03-sponsor.md
│   ├── 04-creators.md
│   ├── 05-events-template.md
│   └── 06-wholesale.md
│
├── /logs/
│   ├── custom-fields-forms-created.json
│   ├── email-templates-created.json
│   └── form-wiring-spec.json             ← SoT for Phase 4 workflow wiring
│
└── /docs/
    ├── forms-manual-build-guide.md       ← UI build instructions
    ├── sms-snippets-build-guide.md       ← UI build + TCPA compliance
    ├── dns-setup-instructions.md         ← Maurice/GoDaddy actions
    └── phase-2-3-completion-report.md    ← this file
```

---

**Awaiting review before Phase 4.**
