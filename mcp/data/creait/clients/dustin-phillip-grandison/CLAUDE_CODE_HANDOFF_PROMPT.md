# Claude Code Handoff Prompt — Dustin's Bespoke GHL Build

Copy everything below the horizontal rule into a fresh Claude Code session. Make sure your working directory contains the `dustins-bespoke/` package folder (all 15 files) so Claude Code can read them directly.

---

I'm Maurice Grant. I run Creait OS — a white-labeled GoHighLevel (GHL) instance. I'm building out a sub-account for my client **Dustin's Bespoke** (luxury custom suits). The complete build package — pipeline design, workflow specs, message copy, AI prompts, custom fields, tags, forms, and an implementation runbook — is in this directory under `dustins-bespoke/`. Read `00_README.md` first for the index, then `14_REVIEW_NOTES.md` for context, then work from `12_IMPLEMENTATION_RUNBOOK.md` as the master build order.

## GHL credentials

- **Private Integration Token (PIT):** `pit-117f3a50-c2db-419c-8b96-fa8ff1d01652`
- **Location ID:** `pisXuG0XOHoNDquxzSKG`
- **API base:** `https://services.leadconnectorhq.com`
- **Required headers:** `Authorization: Bearer <PIT>`, `Version: 2021-07-28`, `Content-Type: application/json`

Store these in a `.env` file in this directory — don't hardcode.

## Your job

Build Phases 1–4 of the playbook inside Dustin's sub-account — all 17 custom fields, 33 tags, 12 pipeline stages, 12 custom values, 2 calendars, 4 forms, 22 message templates, 14 email sequence pieces, 13 workflows (WF1–WF13), the AI Concierge, and 11 internal notifications. Use the GHL API v2 wherever possible; fall back to marking items as "UI-required" only when the API genuinely doesn't support them (workflow builder and AI Concierge configuration are the main UI-only pieces — for those, produce a detailed click-path checklist for me to execute inside GHL, don't try to fake them through undocumented endpoints).

## Start here

1. **Read the package.** `00_README.md`, then `14_REVIEW_NOTES.md`, then skim `12_IMPLEMENTATION_RUNBOOK.md`. Build a TodoList for Phase 1 before touching the API.

2. **Run a connectivity check.** `GET /locations/{locationId}` with the PIT. Report the response. If the token or location is wrong, stop and tell me. If it works, show me the location name so I can confirm.

3. **Audit current state.** For each of these, list what already exists in the sub-account vs. what we need to create: custom values, custom fields, tags, pipelines, calendars, forms, workflows, AI agents. Don't assume the account is blank — it's partially built. Skip anything that already matches the spec; flag anything that exists but doesn't match so we can decide (update vs. leave).

4. **Execute Phase 1 via API.** In order:
   - Custom Values (file 05) — note that 8 of the 12 values need real data from me. For those, create the key with a placeholder value `REPLACE_ME` and list them at the end so I can fill in before Phase 2 starts.
   - Custom Fields (file 01) — all 17, on the Contact model, placed in a "Bespoke Order Details" folder
   - Tags (file 02) — all 33, exact names from the file
   - Pipeline (file 03) — "Bespoke Client Journey" with the 12 stages; enable "Allow Multiple Opportunities Per Contact"
   - Calendars (file 04) — Private Style Consultation (90 min) + Fitting (60 min). If the Calendar API doesn't support all the settings in file 04, create what it does support and flag the remainder for me to finish in the UI.

5. **Verify.** After each creation step, GET the resource back and confirm it matches spec. If anything fails, stop and report — don't silently continue.

6. **Phase 2 forms.** Build "Bespoke Inquiry" and "Refer a Friend" forms per file 06. Map every form field to its custom field. Wire the Inquiry form to fire WF1 (we'll build WF1 in the UI later).

7. **Phase 2 templates.** Create the 5 template folders (Welcome, Appointments, Payments, Follow-Up, Retention) and upload all 22 SMS + email templates from file 07 using the naming convention `[Folder] [Number] — [Short name]`. If GHL's Templates API is limited, create what you can and produce a paste-ready file for the rest.

8. **Stop after Phase 2 template creation.** Do NOT attempt to build workflows or the AI Concierge via API — those are UI-only in GHL. Instead, produce:
   - A `PHASE_3_UI_CHECKLIST.md` covering the 13 workflows (reference file 09 for specs) broken into per-workflow click-paths
   - A `PHASE_4_UI_CHECKLIST.md` covering AI Concierge configuration, retention workflows, and the remaining forms
   - A `BUILD_LOG.md` listing everything you created via API with IDs, everything that already existed, and everything that failed with error text

## Rules

- **Idempotent.** If an item already exists with the same name, skip it. Don't duplicate.
- **One-step-at-a-time reports.** After each major step (custom values done, custom fields done, tags done, etc.), give me a one-line status update. Don't bundle all progress into a single end-of-run summary.
- **Fail loudly.** If any API call returns non-2xx, stop that section and report the exact error response. Don't retry blindly.
- **Don't paraphrase the package.** Names, copy, field options — use the exact strings from the package files. The tone and naming is intentional.
- **No new files in the outputs folder** without telling me first. Everything you generate should go into `build-output/` (create that subfolder).

## When you're done

Report:
1. A table of what was created (resource type, count, IDs)
2. A table of what was skipped (already existed)
3. A table of what failed and why
4. The two UI checklists (Phase 3, Phase 4)
5. The values in Custom Values that still need real data from me

Ask me any clarifying question before you touch the API — I'd rather answer once upfront than discover a wrong assumption after 40 API calls.
