# Franklin Insurance Solutions — CreaitOS Build, Sequenced Phase Design

**Client:** Sabrina Franklin, Franklin Insurance Solutions (Houston, TX)
**Author:** Maurice Grant (with Claude)
**Date:** 2026-05-05
**Status:** Design — pending user review before plan-writing

---

## Why this document exists

Two parallel build threads existed for Sabrina before today:

1. **Local folder** (`/Sabrina/01_Blueprint/` through `/07_Onboarding/`) — a 23-workflow architecture with an n8n + Browser Use + Hetzner stack. Written immediately after the April 20 onboarding call.
2. **GitHub repo** (`Creait-tech/creait-insurance-automation1`) — a FastAPI server on Railway with Playwright automation for Sembley already partially built, idempotent GHL provisioner, simpler 5+3 workflow design. Last updated 2026-05-03 reflecting decisions from a May 1 follow-up call.

This design reconciles them. **The GitHub repo is the build target. The local folder becomes a content/reference library.** The April 20 transcript and the May 1 punch-list confirm every contested decision in the repo's favor (EasyLinks reduced to closed-client accounting only, single dynamic form preferred, simpler workflow set, multi-line Sembley scope, no active Medicare = no 10-yr retention requirement).

---

## Sabrina's actual goal, in one sentence

Sabrina wants to "sell in her sleep" on **cyber insurance, professional liability, surety bonds, and Veracity-supported low-hanging-fruit lines** (liquor liability + 23 others), while EasyLinks shrinks to a closed-client accounting record and her relationship-based commercial business runs in the background.

The product we're shipping isn't software. It's **Sabrina's trust that automation won't embarrass her in front of clients**. Every gate in this plan is a trust checkpoint, not a technical one.

---

## Section 1 — Source-of-truth map

### Two-folder split

| Goes in **GitHub repo** (`docs/franklin/specs/`) | Goes in **local folder** (`/Sabrina/active/`) |
|---|---|
| Custom-field manifests (JSON) | Phase design docs (markdown narrative) |
| Form schemas (JSON) | Decision log + transcripts |
| Workflow specs (one MD per workflow) | Client status / handoff notes |
| Message copy (email + SMS, in MD) | Sequencing & gates between phases |
| GHL pipeline definitions | "Why we're doing this" narrative |
| Webhook payload examples | Reference / archive of old plans |
| Python automation code | — |

**Rule:** anything someone *executing* the build needs → repo. Anything someone *understanding the project* needs → local folder. When the answer is "both," canonical version goes in the repo and the local folder links to it.

### Three deployment targets

1. **CreaitOS UI** (`app.getcreait.com/v2/location/pIevOG07v2c9Ry6wKOol/`) — Sabrina's daily-use surface. Forms, workflows, pipelines, Conversation AI, social planner, calendar.
2. **FastAPI server on Railway** (the GitHub repo deployed) — automation layer. Receives GHL webhooks, runs Playwright against ProWriters / Sembley / Veracity, applies tags, swaps stages.
3. **EasyLinks** (`app.ezlynx.com`) — accounting only. Receives weekly CSV uploads of closed clients. No API integration.

### Archive treatment

Existing `/Sabrina/01_Blueprint/` through `/Sabrina/07_Onboarding/` get moved into `/Sabrina/_archived/2026-04-20-original-build-plan/` with a top-level note explaining they're reference-only. Their message copy and custom-field schemas remain useful as a content library when writing Phase 1's nurture workflows.

---

## Section 2 — The 4 phases & gates

### Phase 1 — MVP: Lead Capture, Nurture, Social, Newsletter (2 weeks)

**Ships:** Sabrina's website rebuilt on CreaitOS, single dynamic intake form covering all LoBs, 5 nurture workflows triggered by campaign tags, Conversation AI on FB/IG DMs, social planner, weekly newsletter, calendar booking, EasyLinks CSV-export workflow for closed deals, **cross-channel reply-stop guardrail**.

**Gate to Phase 2:** A real test contact submits the form → lands in CRM with correct LoB tag → receives the first nurture email + SMS → Sabrina manually advances them through pipeline stages → the right campaign tags swap and the right next-step messages fire. Reply-stop tested cross-channel (reply to SMS pauses email sequence too). Sabrina has used the system for one week and confirmed it doesn't feel "spammy" to her.

### Phase 2 — Veracity (1 week)

**Ships:** All 24+ Veracity-powered LoBs get their own form fields on the dynamic intake. After form submit → contact + opportunity created in CRM → confirmation email + SMS sent containing Veracity self-quote URL with Sabrina's agency code suffix. Outbound webhook captures full contact data BEFORE redirect (so even if they bail at Veracity, we have them in the funnel). Daily check via Sabrina's quick "bound {firstname}" SMS reply moves opportunity to Bound stage.

**Gate to Phase 3:** One real prospect submits a Veracity-eligible form, completes (or abandons) the Veracity flow, and either lands in Bound stage with a Sabrina SMS confirmation or stays in nurture if they didn't bind. **Sabrina has earned $1 of automated commission.** Symbolic but important — first "money in my sleep" moment.

### Phase 3 — Sembley (3-4 weeks)

**Ships:** Sembley browser automation in the FastAPI server (continuing what's already partially built in the repo). Multi-LoB ACORD form pre-fill: existing-policy PDF upload → Sembley extracts → pre-fills new application → generates partial application PDF → emails to client with "fill in the rest" link → on completion, Sembley produces final ACORD application that Sabrina then sends to her wholesalers (Holshire / Veracity-broker / RPS / Vintage). Contact and opportunity stay in CRM throughout.

**Gate to Phase 4:** One real existing-client cross-sell or one real new commercial-line lead goes through Sembley end-to-end. Sabrina confirms the pre-filled application matches what she'd type manually. The full app PDF is in the contact's CRM record.

### Phase 4 — ProWriters (4-6 weeks, the prestige finale)

**Ships:** ProWriters browser automation. Cyber intake form submit → FastAPI server triggers Playwright → logs into ProWriters → fills the cyber application from form data → captures returned quotes from each carrier (Cobble, Cowbell, Westchester, CFC, Travelers) → uploads quote PDFs to the contact in CRM → moves opportunity to Quoted stage → fires the Quoted nurture sequence with quotes attached. **Sabrina-in-the-loop guardrail:** system does NOT auto-send to client. Quotes land in Sabrina's review queue. She picks which to forward.

**Gate to launch as "fully sell-in-her-sleep":** Real cyber prospect submits form Friday at 11pm. By 11:08pm Sabrina has 5 carrier quotes in her review queue. Saturday morning she reviews + sends. She didn't touch ProWriters once.

### Out-of-scope across all 4 phases

- AI talking-head avatar (Sabrina wants this; deferred to Tuesday training per Maurice's commitment)
- Multi-user broker/contractor permissions
- Reputation / Google review automation beyond Phase 1's Onboarding & Referral Ask sequence
- Renewal automation (no closed clients yet, no test data)
- Compliance archive to Google Drive (no active Medicare/Medicaid lines)

### Total time budget

| Phase | Build time | Wait time | Calendar |
|---|---|---|---|
| Phase 1 (MVP) | 11-13 days | 1-3 weeks A2P approval (parallel) | 2 weeks |
| Phase 2 (Veracity) | 5-7 days | None | 1 week |
| Phase 3 (Sembley) | 15-20 days | Live session capture coordination | 3-4 weeks |
| Phase 4 (ProWriters) | 20-30 days | Same | 4-6 weeks |

**~12-14 weeks total** if back-to-back. Could compress to ~10 weeks if Phase 2 starts during Phase 1's A2P wait window.

---

## Section 3 — Phase 1 in detail

### 1A. Provisioner script extensions (GitHub repo, ~1 day)

The repo's `provision/run_franklin.py` already creates 27 custom fields and a calendar shell. It needs:

- **3 pipelines created via API** (Cyber, Pro Liability, Surety Bonds) — script has the data; smoke test failed on permissions. Either get higher-scope token or skip and create in UI.
- **5 campaign tags pre-created** (`campaign-cold`, `campaign-warm`, `campaign-quoted`, `campaign-won`, `campaign-nurture`).
- **Master `intake_notes` custom field** added to the existing 27.
- **`flag:reply-stop` tag** pre-created.

### 1B. CreaitOS UI build — daily-use surfaces (~1 week)

Done in this order, because each depends on the previous:

1. **Sub-account config** — DNS at Cloudflare (SPF/DKIM/DMARC), A2P sacrificial site stood up + A2P registration submitted, Outlook + Zoom verified, branding (logo, colors, address) loaded, Houston phone number set as default outbound SMS.
2. **Single dynamic intake form** — one form with a "What kind of coverage?" dropdown that conditionally shows extra fields based on selection. Maps to `line_of_business` custom field. TCPA opt-in checkbox required. Form lives at `/get-quote` on her new site.
3. **Website rebuild** — 7 pages (Home, /cyber, /professional-liability, /surety-bonds, three thank-you pages). Forms embedded. Mobile-responsive. Same colors/fonts/voice as Wix site but on CreaitOS.
4. **Calendar config** — Outlook OAuth done; needs hours, notifications, buffer config.
5. **Conversation AI bot** — "Sabrina Assistant" persona, "Texan warm but a little less country" (her exact words), seeded with cyber/pro-liab/bonds basics. Connected to FB Page DMs + IG Business DMs + web chat widget.

### 1C. The 5 nurture workflows (~3-4 days)

Each workflow triggered by its corresponding `campaign-*` tag. Tag is applied/swapped by the FastAPI server when form submitted or pipeline stage changes.

| Workflow | Trigger | Sequence | Exit conditions |
|---|---|---|---|
| Cold Lead Nurture | tag `campaign-cold` applied | 4-week sequence: 7 emails + 3 SMS at Day 0, 1, 3, 5, 8, 13, 19, 27 | Reply on any channel → `flag:reply-stop` → exit. Stage advance → tag swap → exit. |
| Warm Lead Nurture | tag `campaign-warm` applied | 2-week sequence: 4 emails + 2 SMS focused on booking a call | Same |
| Quoted Follow-Up | tag `campaign-quoted` applied | 7-day intensive: 3 touches over 7 days, then weekly check-ins | Same |
| Onboarding & Referral Ask | tag `campaign-won` applied | 30-day: welcome Day 0, tips Day 3 + 10, Google review ask Day 14, referral ask Day 30 | Same |
| Long-term Re-engagement | tag `campaign-nurture` applied | Quarterly: one email every 90 days, no SMS | Same |

### Reply-stop logic (cross-channel)

- FastAPI server adds an `/webhook/inbound-message` endpoint.
- GHL fires this webhook on every inbound: email reply, SMS reply, FB DM, IG DM, web chat message.
- Server applies `flag:reply-stop` tag to the contact via GHL API.
- Every workflow has an exit condition: "if contact has `flag:reply-stop`, exit immediately."
- Server sends Sabrina an immediate notification ("Heads up — Jane Doe just replied on email, her sequences are paused.").
- Resume = Sabrina manually removes the `flag:reply-stop` tag (one click in GHL).

**Trade-off:** This is cross-channel-aware but not marketing/transactional-aware. A "your quote is ready" email after the prospect replied to a cold-nurture email last week would still be paused. Acceptable risk at Sabrina's volume (10-50 active contacts). Upgrade path to marketing/transactional split documented for Phase 5+ if volume grows.

### 1D. Social planner + newsletter (~1-2 days)

- FB + IG already connected. Add LinkedIn Company once Jaylen accepts admin invite.
- Schedule 12 starter posts (4 weeks × Mon/Wed/Fri).
- Build "Weekly Newsletter Template" — Tuesday 9am CT recurring send. Two segments: clients vs. non-clients. Reuse drafted copy from local folder content library.

### 1E. EasyLinks CSV bridge (~half day)

- Workflow trigger: opportunity moved to "Bound (Won)" stage in any pipeline.
- Action: append contact data to a Google Sheet **owned by Sabrina** (shared with the Creait team for read access), one row per closed client, formatted as EasyLinks-importable CSV columns.
- Sabrina's task (manual): once a week, download sheet as CSV, log into EasyLinks, click Import. ~5-minute task.
- We do not auto-push. EasyLinks would be one less thing to debug if she ever decides to fully drop them.

### Phase 1 → Phase 2 gate (sharper)

> Sabrina submits a real form on her own new site, watches the welcome email arrive, watches the SMS arrive 10 minutes later, replies "stop" to the SMS, watches that her sequence stops AND the email sequence also stops (cross-channel), waits a day, watches a different test contact get the next nurture touch, manually moves them to "Quoted" in the pipeline, watches the quote follow-up sequence start. She says "OK, this isn't going to embarrass me" and we proceed to Phase 2.

### Phase 1 risks

1. **A2P 10DLC approval** can take 1-3 weeks of waiting. Submit ASAP on Day 1 of Phase 1. Sacrificial site approach the team already planned is the right call.
2. **Cloudflare DNS delegate access** wasn't requested in the May 1 call. Without it, email deliverability slips and the gate can't fully validate. **Add to Sabrina's homework list immediately.**

---

## Section 4 — Phases 2-4 sketched

### Phase 2 — Veracity (1 week)

**Pattern:**

```
User on Sabrina's site → fills dynamic form, picks "Liquor Liability"
        ↓
GHL form submit → contact + opportunity created
        ↓
Stage = "New Lead" → tag campaign-cold
        ↓
GHL fires webhook → FastAPI server
        ↓
Server reads line_of_business → "Liquor Liability"
        ↓
Form thank-you page redirects prospect to Veracity referral URL
(with Sabrina's agency code suffix) immediately
        ↓
Server ALSO fires confirmation email + SMS containing the same link
("Here's your direct quote link, you can buy in seconds, or come back
to this email anytime…")
        ↓
Prospect completes purchase on Veracity → done
(Either via the immediate redirect OR by clicking the link later)
        ↓
Sabrina gets commission notification from Veracity (email)
        ↓
Sabrina texts "bound jane" to her GHL number → workflow advances
opp to "Bound (Won)"
        ↓
Won workflow fires → CSV row written for EasyLinks weekly upload
```

**What's actually built:**

- New custom field: `veracity_referral_link_sent_at` (datetime)
- New router branch in FastAPI: `_handle_veracity()` for any LoB in the Veracity-supported list
- Veracity-supported LoB list as config constant (24+ entries: liquor, videographer, photographer, salon, etc.)
- Per-LoB referral URLs stored in `config/franklin.json` (Sabrina provides spreadsheet, we paste)
- "Veracity Confirmation" email template (one template, dynamic per LoB)
- "Bound" SMS shortcut workflow — Sabrina texts `bound jane`, GHL parses, finds the most recent Jane Doe sent a Veracity link, advances to Bound

**Out of scope Phase 2:** form prefill on Veracity side (their team confirmed no), status sync from Veracity → CRM (no API; SMS shortcut is the manual workaround), bond delivery follow-up.

### Phase 3 — Sembley (3-4 weeks)

**Existing state:** `sembley/client.py`, `sembley/data_model.py`, `sembley/submission.py` partially built. Login flow drafted, submission creation flow drafted with placeholder selectors. Not tested end-to-end. No live session captured yet.

**What gets built:**

1. **Live Sembley session capture** — Maurice or Sabrina logs in once with screen recording so we capture exact selectors, post-login URLs, form field IDs. Updates `sembley/client.py` selectors.
2. **PDF upload + extraction flow** — extends `submission.py`. User submits the form with an existing-policy PDF attached → FastAPI receives PDF → Sembley client uploads it → Sembley extracts → we read the resulting pre-filled application.
3. **Multi-LoB ACORD form support** — generalize beyond pro-liability. General liability uses ACORD 125+126; commercial auto uses ACORD 125+127; pro-liab uses ACORD 125 + carrier-specific. Each LoB tells Sembley which form to apply.
4. **"Fill in the rest" link to client** — Sembley produces partial app PDF + a unique URL where prospect completes remaining fields. URL is hosted by Sembley, not us; we email it via the GHL workflow.
5. **Completion webhook** — when prospect finishes the Sembley application, Sembley sends completed PDF back. Sabrina's email gets it. We catch it via Gmail integration → upload PDF to GHL contact's documents tab → advance opp to "Application Sent."
6. **Wholesaler dispatch helper** — Sabrina uploads completed app + tags which wholesalers (Holshire / RPS / Veracity-broker / Vintage). System emails each wholesaler with the app attached + a unique reply-to address that lets us thread their quote responses back to the correct CRM contact.

**Out of scope Phase 3:** Quote aggregation across wholesalers (different formats — too much variability), premium comparison UI, direct carrier appointments (that's Sabrina's business goal, not a tech feature).

### Phase 4 — ProWriters (4-6 weeks)

**The hardest one.** Multi-page form, conditional fields based on revenue/industry, dynamic carrier list (5+ carriers), separate quote PDFs per carrier, sometimes referred to underwriting (email follow-up rather than instant quote).

**What gets built:**

1. **ProWriters session capture** — login flow + selectors captured live, same as Sembley.
2. **Cyber form → ProWriters fill mapping** — every field on Sabrina's cyber intake form mapped to a ProWriters field. Stored as a config dict in repo.
3. **Application submission Playwright flow** — login, navigate to "New Submission," fill out application page-by-page, submit.
4. **Quote capture loop** — captures both instant quotes (Cobble, Cowbell — PDF download) and "referred to underwriting" status (Travelers — email-watcher follow-up).
5. **Quote-to-CRM upload** — quote PDFs uploaded to GHL contact documents. Custom fields populated: list of carriers that quoted, instant-quote premiums, underwriting-pending list.
6. **Stage advance to "Quoted"** → fires Quoted nurture sequence with quotes attached.
7. **Sabrina-in-the-loop guardrail** — system does NOT auto-send to client. Quotes land in Sabrina's review queue. One-click "send these 3 quotes" action.
8. **Underwriting email parser** — when underwriting emails come in ("we need this info from this client"), parse, attach to right CRM contact, notify Sabrina.

**Out of scope Phase 4:** Auto-send quotes to clients (Sabrina explicitly forbade), cross-carrier comparison "which is best" (needs her eyes), bind/policy issuance automation (deal closing is off-platform).

---

## Section 5 — Cross-cutting concerns

### 5A. Testing strategy

**Phase 1** — manual end-to-end testing only. Test contacts created by Sabrina + Maurice submit forms, watch workflows fire, confirm nurture sequences send/stop correctly. Repo's `tests/` directory has pytest setup; we extend with router unit tests for form-submission and stage-change handlers.

**Phases 2-4** — every Playwright automation gets two layers:

- **Recorded-trace tests:** Playwright trace mode captures full session. Tests replay against saved DOM, no live credentials needed in CI.
- **Live smoke tests:** one real submission per week against each automation, run by cron. If Veracity/Sembley/ProWriters changes their UI, we catch it before Sabrina does.

Acceptance: test suite green when each phase ships. CI blocks merges if it isn't.

### 5B. Secrets + credentials

Sabrina's logins for ProWriters, Sembley, EasyLinks all in repo's `.env` (gitignored, lives only on Railway). Nothing in code, commits, or MD files. CreaitOS PIT token same.

When Sabrina rotates a password (every 90 days for any insurance system credential), Maurice updates Railway env vars. No redeploy needed. Document the rotation procedure in `docs/franklin/credentials-rotation.md`.

**Lockout risk:** if Sabrina's ProWriters/Sembley account gets flagged for "automated access" (unusual login pattern, headless browser fingerprints), her account could lock. Mitigation: Playwright runs with realistic user-agent + viewport + slow-typing humanization. Document lockout-recovery procedure.

### 5C. Failure modes + Sabrina-in-the-loop fallbacks

Principle: **never silently fail.** If automation breaks, Sabrina knows about it before her client does.

| Failure | Detection | Action | Sabrina notification |
|---|---|---|---|
| ProWriters login fails | Playwright timeout on post-login URL check | Skip automation; mark contact `automation_status=login_failed` | SMS: "Heads up, ProWriters login is failing. I've flagged 1 cyber lead for manual quoting." |
| Sembley UI changed | Selector not found | Same as above | Same |
| Veracity referral link broken | Form submit succeeds but redirect URL 404s | GHL workflow alerts | Same pattern |
| GHL webhook drops | Health check from server hits GHL every 6h | If 3 consecutive fail → alert | SMS: "CRM connection looks broken. Probably nothing — but check." |
| Reply-stop fires unexpectedly | n/a | All sequences exit, contact tagged | Daily digest the next morning + immediate notification |

---

## Section 6 — Homework before we start

### Sabrina's homework (this week, blocking Phase 1)

1. **Cloudflare DNS delegate access for Maurice/Jaylen** — required for SPF/DKIM/DMARC. Without it, no email goes out.
2. **Final answer on EasyLinks downgrade** — emailed account manager, no response. Contract just renewed in April so she may be locked at $954/mo. Need to know where she stands.
3. **Brand assets PowerPoint to Google Drive** — promised May 1, not yet delivered.
4. **Houston business address** for the CreaitOS profile.
5. **Full Veracity LoB list** with all 24+ referral URLs (she has the spreadsheet).

### Team homework before Phase 1 starts

1. **Get a higher-scope GHL Private Integration Token** so the provisioner can create pipelines via API.
2. **Stand up the A2P sacrificial site** — separate domain, separate hosting, clean compliance content. Day 1.
3. **Move `/Sabrina/01_Blueprint/` through `/07_Onboarding/` into `/Sabrina/_archived/2026-04-20-original-build-plan/`** with top-level note explaining they're reference, not active plan.
4. **Confirm with Sabrina the 5 nurture workflow tone before writing copy** — "Texan warm but a little less country" voice should run through email/SMS copy too.

---

## Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-05 | Repo as build target, local folder as content library | April 20 transcript and May 1 punch-list confirm every contested decision in repo's favor |
| 2026-05-05 | 4 phases, sequential not parallel | Solo builder + client trust-building > raw build velocity |
| 2026-05-05 | Phase order: MVP → Veracity → Sembley → ProWriters | Momentum-driven (easiest win first) earns Sabrina's trust before harder builds |
| 2026-05-05 | Cross-channel reply-stop, not native-only | Asymmetric downside: one ruined referral relationship costs more than build cost |
| 2026-05-05 | EasyLinks = CSV upload only, no API | Sabrina explicitly said in April 20 call: only closed clients, accounting purposes |
| 2026-05-05 | Single dynamic form, not 4 per-LoB forms | Sabrina explicitly preferred simplicity in April 20 call |
| 2026-05-05 | AI avatar deferred to Phase 5+ / Tuesday training | Maurice deferred in April 20 call |
| 2026-05-05 | No Medicare retention archive | Sabrina explicitly said she's not writing Medicare anymore |

---

## What happens next

1. User reviews this spec.
2. On approval, transition to writing-plans skill to break Phase 1 into concrete implementation tasks.
3. Each subsequent phase gets its own implementation plan written when it's its turn (not all up-front — too much will change between now and Phase 4).
