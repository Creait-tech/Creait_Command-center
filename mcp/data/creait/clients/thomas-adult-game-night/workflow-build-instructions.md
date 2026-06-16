# Workflow Build Instructions (Track B)

This is the human/Claude-in-Chrome side of Phase 4. Use it together with [`workflow-ai-builder-prompts.md`](workflow-ai-builder-prompts.md) (the prompts to paste into the AI Workflow Builder).

---

## TL;DR

1. Build pre-requisites first (pipelines, forms, email body paste, SMS snippets)
2. Open GHL → Automations → Workflows → Create
3. For each of the 8 workflows, paste the prompt from `workflow-ai-builder-prompts.md`, review what AI generates, tweak per the "Manual Tweaks" section, save with the **exact name** from the spec
4. After all 8 are saved, run `node scripts/09-verify-workflows.js` from `/Users/reecebyob/adult-game-nights-build` — it pulls every workflow ID and writes `logs/workflows-created.json`
5. Then run `node scripts/10-wire-form-submissions.js` — it produces a final UI checklist for wiring forms → workflows

---

## Pre-Build Dependency Tree

Build in this order because each layer depends on the previous:

```
┌── (already done via API) ────────────────────────────┐
│  1. Custom fields (38)                                │
│  2. Tags (32)                                         │
│  3. Calendars (3) + July 3 blockout                   │
│  4. Email template stubs (20) — IDs locked            │
│  5. Custom values (8) — for merge-field references    │
└───────────────────────────────────────────────────────┘
                          │
                          ▼
┌── (UI work — see existing build guides) ──────────────┐
│  6. Pipelines (4)        — config/pipelines.json       │
│  7. Forms (6)            — docs/forms-manual-build-…   │
│  8. Email body paste     — /email-templates/*.html     │
│  9. SMS snippets (8)     — docs/sms-snippets-build-…   │
└────────────────────────────────────────────────────────┘
                          │
                          ▼
┌── (this doc — Track B) ───────────────────────────────┐
│ 10. Workflows (8) via AI Builder                       │
└────────────────────────────────────────────────────────┘
                          │
                          ▼
┌── (Claude Code Track A wraps up) ─────────────────────┐
│ 11. Verify workflow IDs:  scripts/09-verify-workflows  │
│ 12. Wire form submissions: scripts/10-wire-form-…      │
└────────────────────────────────────────────────────────┘
```

If you start at step 10 without completing 6-9, the AI Builder will still generate workflows but they'll reference forms/templates that don't exist. **Don't do that.**

---

## Recommended build order for the 8 workflows

Build in `build_priority` order (also encoded in [`config/workflows.json`](../config/workflows.json)):

| # | Workflow | Why this order |
|---|----------|----------------|
| 1 | Reactivation Campaign | Simplest, no upstream form/pipeline deps. Good for testing the AI Builder UX. |
| 2 | Cart Abandonment Recovery | Independent. Tests SMS + email together. |
| 3 | Post-Purchase Welcome Series | Tests pipeline-move + multi-day timing. |
| 4 | Event Registration & Follow-Up | First form-triggered workflow. Tests dynamic tag generation. |
| 5 | Sponsor Pipeline (B2B) | Tests internal email + conditional follow-ups. |
| 6 | Game Night Service Booking | Most complex. Build last among the form-driven workflows. |
| 7 | Review Request Automation | Tests branching on a custom field value. |
| 8 | App Lobby Capture | Shell only — webhook URL pending. Build the structure, fill the webhook in later. |

---

## Per-workflow ritual

For every workflow:

### 1. Open the AI Builder
**Automations → Workflows → + Create Workflow → Start with AI** (or however CreateOS surfaces this — sometimes labeled "Magic" or "AI Assist")

### 2. Paste the prompt
Copy the **AI Builder Prompt** code block verbatim from `workflow-ai-builder-prompts.md` for this workflow.

### 3. Review what AI generated
Don't auto-save. Walk through every step:
- Did it use the **exact** template title? (E.g., `Cart Abandonment 1 (1hr)`, not a slug or new template)
- Are wait durations right? (AI sometimes converts "1 day" to "24 hours" — both fine, just visual)
- Are tag names spelled exactly as in the Phase 1 taxonomy? (E.g., `service-booker`, not `service_booker` or `Service Booker`)
- Is the trigger right? (Form trigger should reference the form by name, not a tag)
- Are stop conditions wired? (These are easy to miss — AI sometimes drops them.)

### 4. Apply the manual tweaks
Each workflow in `workflow-ai-builder-prompts.md` has a "Manual Tweaks After AI Generation" section. Read it, apply them.

### 5. Save with the exact name
The verification script matches by name. Use the **display_name** from `config/workflows.json`, character-perfect:

| Spec | Save as |
|------|---------|
| reactivation_campaign | **Reactivation Campaign (Klaviyo Import)** |
| cart_abandonment_recovery | **Cart Abandonment Recovery** |
| post_purchase_welcome_series | **Post-Purchase Welcome Series** |
| event_registration_followup | **Event Registration & Follow-Up** |
| sponsor_pipeline | **Sponsor Pipeline (B2B)** |
| game_night_service_booking | **Game Night Service Booking** |
| review_request_automation | **Review Request Automation** |
| app_lobby_capture | **App Lobby Capture** |

(Different from the section headings in the prompts doc — those use shortened names. The spec name is what counts.)

### 6. Test fire
For each workflow, find a way to fire it once with a test contact:
- Tag-triggered: manually add the trigger tag to a test contact (e.g., create `test+wf1@example.com`, tag with `source-import-klaviyo`)
- Form-triggered: submit the form yourself
- Webhook-triggered (workflow 8): use `curl -X POST <webhook_url> -d '{"email":"test@…","host_name":"Test","event_id":"abc","recap_video_url":"https://…"}'`

Confirm at least the first 2 steps fire as expected. Document anything weird in `logs/workflow-test-results.json` (create the file).

### 7. Mark complete
Tick the box in the build checklist below.

---

## Build Checklist

Copy this into a separate doc or just check items off here as you build:

- [ ] **1. Reactivation Campaign (Klaviyo Import)** — built / tested / saved
- [ ] **2. Cart Abandonment Recovery** — built / tested / saved
- [ ] **3. Post-Purchase Welcome Series** — built / tested / saved
- [ ] **4. Event Registration & Follow-Up** — built / tested / saved
- [ ] **5. Sponsor Pipeline (B2B)** — built / tested / saved
- [ ] **6. Game Night Service Booking** — built / tested / saved
- [ ] **7. Review Request Automation** — built / tested / saved
- [ ] **8. App Lobby Capture** — shell built, webhook URL captured to `logs/workflow-5-webhook-url.txt`

Once all 8 are checked:

```bash
cd /Users/reecebyob/adult-game-nights-build
node scripts/09-verify-workflows.js
node scripts/10-wire-form-submissions.js
```

---

## Common AI Builder gotchas

These pop up across multiple workflows. Watch for them:

### "AI created a new email instead of using the existing one"
The AI sometimes rewrites the email instead of selecting the existing template. Fix: edit the step, choose **Select Existing Template**, find by title.

### "Wait durations show as seconds"
GHL renders some waits in seconds. 86400 = 1 day, 3600 = 1 hour. If the number is right, leave it. If you want to clean up, switch to "days" or "hours" units.

### "Tag spelled wrong / created as new"
If the AI typed `cart_abandoned` instead of `cart-abandoned`, the workflow will create a new tag instead of using the Phase 1 tag. Always verify the spelling matches `/config/tags.json`.

### "Conditional logic uses a workflow branch instead of a filter"
GHL has both: "Wait until condition" (filter) and "If/Else branch" (split). Either works, but if-else is cleaner for the review-rating branch (workflow 7) and the buyer-tag check (workflow 8).

### "Internal SMS to Thomas goes to the contact instead"
Look for **Send SMS** vs **Send Internal SMS** vs **Custom Action → Twilio**. Verify recipient is `+14049542115`, NOT `{{contact.phone}}`.

### "Pipeline stage move silently fails"
Pipeline move actions fail quietly if the stage name doesn't exactly match. Confirm pipeline + stage names character-by-character.

### "Form trigger references a deleted form"
If you rebuild a form, the workflow trigger goes stale. After form rebuild, edit the workflow trigger and re-select the new form by name.

---

## When you hit a real blocker

**Don't force the AI Builder to do something it can't.** Examples that are easier to build manually:

- **Increment a numerical custom field by 1** (workflow 8, step 5) — no native action. Use a Custom Webhook → fetch contact → set value+1, OR skip and add via custom code in Phase 5.
- **Slugify a custom field for dynamic tag generation** (workflow 4) — AI Builder has no string-transform. Just build N hardcoded If/Else branches, one per event option. For now there are 2 options (`Russell Center July 3`, `Other (TBD)`), so 2 branches.
- **"Wait until custom field date - 7 days"** — most builders support this, but check the unit. If the field is a string, parse to date first.

If a workflow can't be built end-to-end via AI Builder, save what you have, document the gap in `logs/workflow-blockers.md`, and continue. Phase 5 will revisit with custom code actions.

---

## After Track B is done

Hand back to Track A (Claude Code) by:

1. Running `scripts/09-verify-workflows.js` and pasting the output to confirm all 8 are matched
2. Running `scripts/10-wire-form-submissions.js` and following the regenerated checklist `docs/form-wiring-checklist.md`
3. Capturing the App Lobby webhook URL from CreateOS workflow 8's settings into `logs/workflow-5-webhook-url.txt`
4. Sending the webhook URL to Thomas's app developer

---

## Quick reference: files Track B reads

| File | Purpose |
|------|---------|
| [`config/workflows.json`](../config/workflows.json) | Source of truth for the 8 specs |
| [`docs/workflow-ai-builder-prompts.md`](workflow-ai-builder-prompts.md) | Paste-ready AI Builder prompts |
| [`docs/forms-manual-build-guide.md`](forms-manual-build-guide.md) | How to build the 6 forms |
| [`docs/sms-snippets-build-guide.md`](sms-snippets-build-guide.md) | How to build the 8 SMS snippets |
| [`config/email-templates.json`](../config/email-templates.json) | Subject + preview text per email |
| [`/email-templates/*.html`](../email-templates/) | HTML body to paste per email |
