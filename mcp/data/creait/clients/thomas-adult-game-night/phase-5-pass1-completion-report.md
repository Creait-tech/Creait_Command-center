# Phase 5 Pass 1 Completion Report — AI Agents

**Date:** 2026-05-04
**Client:** Adult Game Nights (Thomas Gray)
**Location ID:** `1uN6mnlvX9JQ5QvrLewp`
**Pass:** 1 of 2 (Pass 2 = Thomas refresh, runs when voice samples + FAQs land)

---

## Headline

The AI agent endpoint probe revealed **only the Knowledge Base layer is API-routable** — Voice AI, Conversation AI, Agent Studio, Reviews AI, and Phone Numbers all return 404 for any path/payload combination. This is consistent with the broader pattern (forms, pipelines, workflows): GHL hasn't surfaced these as REST endpoints yet, regardless of token type.

So Pass 1 split into two clean halves:

**Half 1 — API-driven (live now):**
- ✅ Knowledge Base "Adult Game Nights Master KB" created (ID `y7rHRbRkznkFc8wTC8tk`)
- ✅ 54 FAQs seeded across 11 topics
- ✅ KB tested 18/18 checks passing

**Half 2 — Specs ready for UI build (Maurice/Track B):**
- 🟡 Voice AI Receptionist — full spec + build guide
- 🟡 Conversation AI Sales Rep — full spec + build guide (incl. 9 keyword auto-DMs)
- 🟡 Reviews AI — full per-rating rules + alert routing
- 🟡 Agent Studio (optional UI consolidation)

The KB is the load-bearing piece. Both Voice AI and Conversation AI read live from it — once Maurice points the agents at KB ID `y7rHRbRkznkFc8wTC8tk` in the UI, they immediately have access to all 54 FAQs covering business basics, products, services, events, sponsorship, wholesale, creators, shipping, and tone/escalation rules.

**Pass 2 hooks are in place.** The refresh script at `scripts/16-refresh-agent-personality.js` is tested (smoke run: 0 errors, 3 tone FAQs idempotently refreshed). When Thomas's deliverables land, drop them in `/inputs/`, run the script, paste the generated personality prompts. ~30 min of work to swap from generic-DJ-voice to Thomas-voice.

---

## Status Summary

| Task | Name | Status | Mechanism |
|------|------|--------|-----------|
| 5.0 | Probe AI agent endpoints | ✅ done | Only KB primitive is API-routable |
| 5.1 | Knowledge Base + FAQs | ✅ live | API-driven, 54 FAQs, 18/18 tests pass |
| 5.2 | Voice AI Receptionist | 🟡 spec ready | UI build per `docs/ai-agents-build-guide.md` |
| 5.3 | Conversation AI | 🟡 spec ready | UI build per same guide |
| 5.4 | Reviews AI | 🟡 spec ready | UI configuration per same guide |
| 5.5 | Agent Studio | 🟡 spec ready (optional) | UI consolidation if version supports |
| 5.6 | Test scripts | ✅ KB tests live | UI test plan written for Track B |
| 5.7 | Pass 2 refresh script | ✅ tested | Idempotent; runs in seconds when inputs land |

---

## ✅ API-Driven Outcomes

### Task 5.0 — Endpoint probe results

Probed 24 endpoint variations. Results captured in [`logs/ai-endpoint-probe.json`](../logs/ai-endpoint-probe.json).

| Resource | PIT scope | Verdict |
|----------|-----------|---------|
| `GET /knowledge-bases/?locationId=…` | ✅ | works |
| `POST /knowledge-bases/` | ✅ | full create |
| `GET /knowledge-bases/{id}?locationId=…` | ✅ | works (returns `kbMetadata.faqs/urls/richText/files`) |
| `DELETE /knowledge-bases/{id}?locationId=…` | ✅ | works |
| **`POST /knowledge-bases/faqs/`** | ✅ | **full create — only KB content type API-routable** |
| `GET /knowledge-bases/faqs/?locationId=…&knowledgeBaseId=…` | ✅ | works |
| `DELETE /knowledge-bases/faqs/{id}?locationId=…` | ✅ | works |
| `POST /knowledge-bases/rich-texts/` | ❌ 404 | not exposed |
| `POST /knowledge-bases/urls/` | ❌ 404 | not exposed |
| `POST /knowledge-bases/files/` | 🟡 | exists but requires multipart upload (deferred) |
| `GET /voice-ai-agents/?locationId=…` | ❌ 404 | route doesn't exist |
| `POST /voice-ai-agents/` | ❌ 404 | route doesn't exist |
| `GET /voice-ai-agent-goals/` | ❌ 404 | route doesn't exist |
| `GET /voice-ai-dashboard/` | ❌ 404 | route doesn't exist |
| `GET /conversation-ai/` | ❌ 404 | route doesn't exist |
| `POST /conversation-ai/` | ❌ 404 | route doesn't exist |
| `GET /agent-studio/` | ❌ 404 | route doesn't exist |
| `POST /agent-studio/` | ❌ 404 | route doesn't exist |
| `GET /reviews/` | ❌ 404 | route doesn't exist |
| `GET /phone-numbers/` | ❌ 404 | route doesn't exist |

**Verdict:** Knowledge Base is the only AI primitive surfaced via REST API. Everything else lives in the CreateOS UI only. The pattern matches what we saw with forms (Phase 2) and workflows (Phase 4) — GHL exposes data resources via API but not orchestration / agent / page resources.

The API quirks doc was updated with these findings.

### Task 5.1 — Knowledge Base + FAQs (54 entries seeded)

**KB:** `Adult Game Nights Master KB` — ID `y7rHRbRkznkFc8wTC8tk`

**FAQs by topic:**

| Topic | Count | Purpose |
|-------|-------|---------|
| `business_basics` | 6 | Business name, owner, address, contact, service area, hours |
| `liquor_store_game` | 9 | Product specs, price, where to buy, gameplay, app details |
| `service` | 10 | All 4 service tiers, booking lead time, deposit, cancellation, corporate events |
| `3d_print` | 4 | Products, pricing, turnaround, ordering |
| `events` | 4 | Upcoming events, how to find out, ticketing, guests |
| `game_show` | 4 | Adult Game Nights Live launch, sponsorship tiers |
| `creators_affiliates` | 2 | Creator network, 15% commission |
| `wholesale` | 4 | Bulk pricing tiers, MSRP, lead time, account setup |
| `shipping_returns` | 3 | Nationwide shipping, timing, returns |
| `frequently_asked` | 5 | Generic FAQs (PASS 2 REPLACEMENT — Thomas's real FAQs replace these) |
| `tone_brand` | 3 | Vibe definition + AI response style + escalation rules (PASS 2 REPLACEMENT) |
| **Total** | **54** | |

Sources: 8 long-form documents from the Phase 5 spec, decomposed into Q&A pairs since FAQs are the only API-seedable content type. Long-form prose preserved at [`docs/knowledge-base-source.md`](knowledge-base-source.md) for reference.

### Task 5.6 — KB tests (18/18 passing)

Run: `node scripts/14-test-knowledge-base.js`

```
KB Test Results: 18 passed, 0 failed.
  ✅ kb_exists                                {"id":"y7rHRbRkznkFc8wTC8tk", ...}
  ✅ faq_count                                {"expected_min":54,"actual":54}
  ✅ faq_present:"What is the Liquor Store…"
  ✅ faq_present:"How do I book a game night service?"
  ✅ faq_present:"How do I sponsor Adult Game Nights Live?"
  ✅ faq_present:"What's the Adult Game Nights vibe?"
  ✅ faq_present:"What should the AI escalate to a human?"
  ✅ topic_coverage:business_basics            (6/6)
  ✅ topic_coverage:liquor_store_game          (9/9)
  ✅ topic_coverage:service                    (10/10)
  ✅ topic_coverage:3d_print                   (4/4)
  ✅ topic_coverage:events                     (4/4)
  ✅ topic_coverage:game_show                  (4/4)
  ✅ topic_coverage:creators_affiliates        (2/2)
  ✅ topic_coverage:wholesale                  (4/4)
  ✅ topic_coverage:shipping_returns           (3/3)
  ✅ topic_coverage:frequently_asked           (5/5)
  ✅ topic_coverage:tone_brand                 (3/3)
```

### Task 5.7 — Pass 2 refresh script (smoke-tested)

Run: `node scripts/16-refresh-agent-personality.js`

Smoke test with no inputs:
```
Parsed 0 FAQs (no inputs/faqs.md yet)
Found 0 voice samples
Refreshing tone_brand FAQs (idempotent delete+recreate)...
  [REFRESHED] What's the Adult Game Nights vibe?
  [REFRESHED] How should the AI assistant respond?
  [REFRESHED] What should the AI escalate to a human?
Refresh complete. Created: 0, Updated: 3, Errors: 0
```

The script is idempotent (re-running with same inputs → no spurious changes), tolerates missing inputs gracefully, and generates `/logs/pass-2-refresh-output.md` with paste-ready personality prompts for Maurice.

KB still passes 18/18 after the refresh smoke test.

---

## 🟡 Specs-Only Outcomes (UI build needed)

### Task 5.2 — Voice AI Receptionist

**Spec:** [`config/voice-ai-agent.json`](../config/voice-ai-agent.json)
**Build guide:** [`docs/ai-agents-build-guide.md`](ai-agents-build-guide.md#agent-1--voice-ai-receptionist)

**Highlights:**
- 7 conversation goals (book service, buy game, ask about events, sponsorship, game help, wholesale, general info)
- All 3 calendar IDs pre-wired in spec (`xX4X3z2vKwjBPldnYVj0`, `e9So05abGp6pRydHOPdO`, `bYMA4jte9RSdIWNDxDsP`)
- 14 escalation phrases with `forward_call` to +14049542115
- After-hours voicemail → SMS alert flow
- Linked to KB ID `y7rHRbRkznkFc8wTC8tk`

**Pass 2 refresh targets:** personality prompt, greeting, fallback, tone examples.

### Task 5.3 — Conversation AI Sales Rep

**Spec:** [`config/conversation-ai.json`](../config/conversation-ai.json)

**Highlights:**
- 5 channels: SMS, Instagram DM, Facebook DM, TikTok DM, Web Chat
- Response style: 1-2 sentences SMS, 2-3 sentences chat, moderate emojis
- 8 forbidden phrases (no "I'm sorry but...", no "Unfortunately", no "As an AI", etc.)
- 6 preferred phrases ("Yo", "Pull up", "Locked in", "Bet", "I gotchu", "What's good")
- 11 allowed actions (send links, capture email/phone, apply tags, schedule, pipeline moves)
- 7 hard limits (no >10% discounts, no custom sponsor pricing, no refunds, etc.)
- Escalation triggers: 18 phrases + sentiment <0.3 + 8-exchange length cap
- **9 keyword auto-DMs** (GAME, BUY, PRICE, BOOK, EVENT, SPONSOR, CREATOR, WHOLESALE, 3D) — paste-ready for Instagram/TikTok comment automation

**Pass 2 refresh targets:** personality prompt, response style, example replies.

### Task 5.4 — Reviews AI

**Spec:** [`config/reviews-ai.json`](../config/reviews-ai.json)

**Highlights:**
- Auto-respond to 4-5 stars (templates ready, character-limited)
- 3-star: SMS alert to Thomas, NO public response
- 2-star: SMS + email alert (high priority)
- 1-star: SMS + email + (optional) auto-call (critical priority)
- Negative review email uses existing `negative_review_alert` template (ID `69f81d12fe87bad8ce2777fe` from Phase 3)
- 15-minute response delay (avoids robotic feel)
- Integrates with Workflow 7 from Phase 4 (review request 7d post-purchase)

### Task 5.5 — Agent Studio (optional)

If CreateOS version exposes Agent Studio, consolidate the 3 agents into one view. Otherwise, no-op — the agents work independently.

---

## 📋 Resource Inventory Update

| Phase | Resource | Count | Status |
|-------|----------|-------|--------|
| 1 | Custom fields | 11 | ✅ live |
| 1 | Tags | 32 | ✅ live |
| 1 | Calendars + blockout | 3 + 1 | ✅ live |
| 2 | Custom fields (form support) | 27 | ✅ live |
| 3 | Email template stubs | 20 | ✅ live |
| 4 | Custom values | 8 | ✅ live |
| **5** | **Knowledge Base** | **1** | **✅ live** |
| **5** | **KB FAQs** | **54** | **✅ live** |
| **Total via API** | | **156 resources** | |
| 1.1 | Sub-account profile | — | 🟡 manual UI fix |
| 1.4 | Pipelines | 4 | 🟡 manual UI build |
| 2.1 | Forms | 6 | 🟡 manual UI build |
| 2.3 | Landing pages | 6 | 🟡 manual UI build |
| 3.2 | SMS snippets | 8 | 🟡 manual UI build |
| 4 | Workflows | 8 | 🟡 manual UI build (Track B) |
| **5** | **Voice AI Receptionist** | **1** | **🟡 manual UI build** |
| **5** | **Conversation AI** | **1** | **🟡 manual UI build** |
| **5** | **Reviews AI config** | **1** | **🟡 manual UI build** |
| **Pending UI** | | **36** items | ~6-7 hours of paste/click |

---

## API Quirks Discovered (Phase 5)

Added to [`docs/api-reference.md`](api-reference.md):

1. **KB primitive is the only API-routable AI resource.** All other AI agent endpoints (Voice AI, Conversation AI, Agent Studio, Reviews) return 404 — routes don't exist for any token type. They're UI-only.
2. **KB content shape:** `kbMetadata` returns counts for `faqs / urls / richText / files / webSearch`. **Only `faqs` is API-creatable.** rich-texts/URLs return 404 on POST. Files endpoint exists but requires multipart upload (deferred — most content fits as Q&A anyway).
3. **KB FAQ path is unusual:** `POST /knowledge-bases/faqs/` (kebab-case + plural sub-resource). The natural-feeling `/knowledge-bases/{id}/faqs` and `/knowledge-base/faqs` (singular) both 404.
4. **Phone numbers endpoint not exposed:** `GET /phone-numbers/` returns 404. Provisioning + agent attachment is UI-only.
5. **No `PATCH` route on FAQs.** To update content, delete + recreate. The Pass 2 refresh script does this idempotently.

---

## File Tree (delta from Phase 4)

```
/Users/reecebyob/adult-game-nights-build/
├── /scripts/
│   ├── 12-probe-ai-endpoints.js           ✅ executed (probe results in logs/)
│   ├── 13-create-knowledge-base.js        ✅ executed (idempotent)
│   ├── 14-test-knowledge-base.js          ✅ executed (18/18 pass)
│   ├── 15-fetch-ai-agent-ids.js           ✅ executed (writes paste template)
│   └── 16-refresh-agent-personality.js    ✅ tested (Pass 2 ready)
│
├── /config/
│   ├── knowledge-base.json                ← 54 FAQs source of truth
│   ├── voice-ai-agent.json                ← Voice AI spec for UI build
│   ├── conversation-ai.json               ← Conversation AI spec
│   └── reviews-ai.json                    ← Reviews AI per-rating rules
│
├── /inputs/                               ← Pass 2 drop zone
│   ├── README.md
│   └── voice-samples/.gitkeep
│
├── /logs/
│   ├── ai-endpoint-probe.json
│   ├── knowledge-base-created.json
│   ├── kb-test-results.json
│   ├── ai-agents-created.json             ← manual paste template (waiting for UI build)
│   └── pass-2-refresh-output.md           ← regenerated each refresh
│
└── /docs/
    ├── ai-agents-build-guide.md           ← Track B UI build instructions
    ├── ai-agent-test-plan.md              ← V1-V7, C1-C8, R1-R6 + e2e journey
    ├── knowledge-base-source.md           ← long-form content reference
    ├── pass-2-refresh-instructions.md     ← when Thomas delivers
    └── phase-5-pass1-completion-report.md ← this file
```

---

## ⏭️ Recommended Next Steps

### Immediate (Track B UI work in CreateOS)
1. **Knowledge Base verification** (5 min) — Open CreateOS → AI / Knowledge Bases → confirm "Adult Game Nights Master KB" exists with 54 FAQs.
2. **Voice AI Receptionist** (60-90 min) — Build per `ai-agents-build-guide.md`. Provision a phone number first if not done.
3. **Conversation AI** (60 min) — Build, connect IG/FB/TikTok, paste keyword auto-DM rules.
4. **Reviews AI** (30 min) — Connect GMB, set per-rating auto-replies.
5. **Run test plan** (60 min) — Walk through V1-V7, C1-C8, R1-R6.
6. **Run** `node scripts/15-fetch-ai-agent-ids.js` — captures agent IDs into `logs/ai-agents-created.json` (or prompts manual paste).

### Parallel (no blocker on Track B)
- Maurice can pursue Phase 6 (Integrations) — Stripe, ShipStation, Google Workspace OAuth flows are independent of AI agent build.
- Thomas's voice samples + FAQ list — still the gating item for Pass 2.

### Pass 2 (when Thomas delivers, ~30 min)
1. Drop voice samples in `/inputs/voice-samples/`
2. Save FAQ list to `/inputs/faqs.md`
3. `node scripts/16-refresh-agent-personality.js`
4. Listen to samples, append Thomas-isms to KB tone FAQ in CreateOS UI (10-15 min manual)
5. Paste new personality prompts from `logs/pass-2-refresh-output.md` into Voice AI + Conversation AI agent settings
6. Re-run abbreviated test plan (V1, C1)

### Phase 6 prep
Phase 6 is **Integrations & Connections** per your prompt — Social Planner, Stripe, ShipStation, QuickBooks, Google Workspace. Mostly OAuth, mostly UI-driven. Worth probing early which OAuth flows expose anything to the API (Stripe webhooks for instance) before kicking off — same probe-first pattern that's been working.

---

**Pass 1 awaiting review. Pass 2 awaiting Thomas's deliverables.**
