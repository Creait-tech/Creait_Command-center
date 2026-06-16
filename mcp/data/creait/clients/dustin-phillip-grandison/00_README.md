# Dustin's Bespoke — Creait OS (GHL) Build Package

**Prepared by:** Maurice Grant — Creait OS
**Sub-account:** Dustin's Bespoke
**Location ID:** `pisXuG0XOHoNDquxzSKG`
**Scope:** Phases 1–4 (Foundation → Core Automations → Nurture & AI → Retention & Growth)
**Date:** April 2026

---

## What's in this package

This package contains everything required to fully build out Dustin's Creait OS sub-account — every custom field, tag, pipeline stage, calendar, form, message template, workflow spec, AI prompt, and internal notification. It is designed to be executed in order using the Implementation Runbook (file 12).

| # | File | What it is |
|---|---|---|
| 00 | README.md | You are here |
| 01 | CUSTOM_FIELDS.md | 17 custom fields with types, options, API payloads |
| 02 | TAGS.md | 33 tags organized in 5 groups |
| 03 | PIPELINE.md | 12-stage Bespoke Client Journey pipeline |
| 04 | CALENDARS.md | Consultation (90-min) + Fitting (60-min) calendar specs |
| 05 | CUSTOM_VALUES.md | Business phone, studio address, links, etc. |
| 06 | FORMS.md | Bespoke Inquiry, Feedback, Satisfaction, Referral |
| 07 | MESSAGING_TEMPLATES.md | All SMS + Email templates, organized in folders |
| 08 | EMAIL_SEQUENCES.md | Sequence A (7 emails), B (3 emails), C (4 emails) |
| 09 | WORKFLOWS.md | Complete WF1–WF13 specs — triggers, actions, timing, copy |
| 10 | AI_CONCIERGE.md | System prompts, guardrails, knowledge base, handoff rules |
| 11 | INTERNAL_NOTIFICATIONS.md | 11 event triggers with exact copy |
| 12 | IMPLEMENTATION_RUNBOOK.md | Step-by-step click-path build guide |
| 13 | api-bulk-import.js | Node script to bulk-create fields/tags/pipeline via API |
| 14 | REVIEW_NOTES.md | Review findings + playbook↔questionnaire consistency check |

---

## How to execute

1. **Read `14_REVIEW_NOTES.md` first** — confirms the playbook matches Dustin's questionnaire answers and flags 3 small inconsistencies to resolve with him before build starts.
2. **Run the API bulk import (file 13)** from your machine. This creates all 17 custom fields, 33 tags, 12 pipeline stages, and 5 custom values in about 90 seconds.
3. **Follow the Implementation Runbook (file 12)** in order. It orders everything as Phase 1 → Phase 2 → Phase 3 → Phase 4 with click-paths for anything not handled by the API script (workflows, AI agent, calendars, forms, email builder).
4. **Use file 09 as the workflow bible.** It contains the full trigger, timing, action sequence, and exact message copy for every workflow. Keep it open in a second monitor while building inside GHL's Automation → Workflows builder.

---

## Phase timing

| Phase | Days | Deliverable |
|---|---|---|
| Phase 1 Foundation | 1–3 | Pipeline, calendars, fields, tags, Stripe, domain |
| Phase 2 Core Automations | 3–6 | WF1–WF4 + WF6A/B/C, lead form, notifications |
| Phase 3 Nurture & AI | 6–9 | WF5, WF7, WF8, WF9, email sequences, Conversation AI |
| Phase 4 Retention & Growth | 9–12 | WF10–WF13, feedback survey, referral form, go-live |

Total: 12 working days for the full Phases 1–4 build.

---

## Conventions used throughout

- `{{name}}`, `{{contact.first_name}}`, `{{appointment.start_time_formatted}}`, `{{custom_values.studio_address}}` — merge fields you will wire up in GHL's native builder.
- All time delays are business-hours aware where noted.
- Every automated message starts with "— Dustin" sign-off unless noted. This is enforced because luxury copy must feel personal, not generic.
- Every workflow has **Stop on Reply** enabled unless explicitly stated otherwise.
