# AI Agents Build Guide (Track B)

**Why this is a build guide instead of API automation:** Phase 5 endpoint probe (run `node scripts/12-probe-ai-endpoints.js` to repro) confirmed that GHL exposes only the **Knowledge Base** primitive via REST API. Voice AI Agents, Conversation AI, Agent Studio, Reviews AI, and Phone Numbers all return 404 — the routes don't exist for any token type yet. They're UI-only resources at the moment.

What we did from API:
- ✅ Created the master KB ([`logs/knowledge-base-created.json`](../logs/knowledge-base-created.json), ID: `y7rHRbRkznkFc8wTC8tk`)
- ✅ Seeded 54 FAQs across 11 topics (the entire content corpus the agents will reference)

What Maurice/Track B does from UI:
- 🟡 Build Voice AI Receptionist — point it at our KB
- 🟡 Build Conversation AI — point it at our KB
- 🟡 Configure Reviews AI auto-replies
- 🟡 (Optional) Centralize in Agent Studio

When all three are built, run:
```bash
node scripts/15-fetch-ai-agent-ids.js
```
to capture agent IDs into `/logs/voice-ai-agent-created.json`, etc., for cross-reference.

---

## Pre-build dependencies

| Dependency | Status | Source |
|---|---|---|
| Master KB seeded with 54 FAQs | ✅ live | KB ID `y7rHRbRkznkFc8wTC8tk` |
| Phone number provisioned in CreateOS | 🟡 may need to provision | Settings → Phone Numbers |
| Google My Business connected | 🟡 needs OAuth | Reputation → Connections |
| Facebook page connected | 🟡 needs OAuth | Settings → Integrations |
| Instagram business account connected | 🟡 needs OAuth | Settings → Integrations |
| TikTok account connected | 🟡 needs OAuth (if available) | Settings → Integrations |

---

## Agent 1 — Voice AI Receptionist

**Spec source:** [`config/voice-ai-agent.json`](../config/voice-ai-agent.json)

### Build path
**Settings → AI Employees → Voice AI Agents → + Create Agent**

(May appear under "Voice AI" or "AI Receptionist" depending on CreateOS UI version. Look for the Voice AI section.)

### Configuration walkthrough

#### 1. Basic Info
- **Name:** `Adult Game Nights Receptionist`
- **Phone number:** Attach the GHL number you've provisioned. If none yet, buy one in **Settings → Phone Numbers** (404 area code preferred for brand fit).
- **Knowledge Base:** Select **Adult Game Nights Master KB** (ID `y7rHRbRkznkFc8wTC8tk` — should appear in dropdown)

#### 2. Voice & Personality
- **Voice provider:** ElevenLabs if available; otherwise GHL default.
- **Voice ID:** PASS2 placeholder. Pick any clean masculine voice for now — Pass 2 will swap to a Thomas-clone via ElevenLabs voice cloning once samples land.
- **Speaking rate:** 1.0 (default)
- **Personality prompt** (paste into the personality/instructions field):
  > Energetic, casual, hype, like a DJ-host. Always direct. Drops occasional 'vibe' or 'pull up' or 'fam'. Confident, never apologetic. Pro-Black, community-oriented, supports Atlanta. Comfortable with adult themes (it's an adult game brand) but never crude. Keep responses under 3 sentences. Always offer a clear next action — book, buy, sign up, or transfer.

#### 3. Greeting & Fallbacks
- **Greeting:** `Yo! You've reached Adult Game Nights, what's good?`
- **Fallback (didn't catch it):** `Sorry, I didn't catch that — can you say it again?`
- **Off-topic:** `I gotcha, but I'm gonna stay locked in on Adult Game Nights stuff. Got a question about the game, booking a game night, or sponsorship?`
- **Uncertain:** `Honestly not sure on that one — let me get Thomas to ring you back. Cool?`
- **Voicemail:** `Yo this is Adult Game Nights. Drop your name, your number, and what you tryna do. Thomas hits back fast 🎲`

#### 4. Goals (the agent's playbook)

GHL's Voice AI lets you define **Goals** (sometimes called "Intents" or "Skills"). Each goal has a name, trigger phrases, and actions. Build these 7 goals:

| Goal | Trigger phrases | Primary action |
|---|---|---|
| Book a game night service | "I want to book", "do a game night", "have you come out", "book you for", "host a game night", "service", "y'all come out" | Capture event details + send Calendar 1 booking link (`xX4X3z2vKwjBPldnYVj0`) |
| Buy the game | "where do I buy", "want to order", "Liquor Store game", "shop", "purchase" | Send checkout SMS: `https://adultgamenights.com` |
| Ask about events | "next event", "when's the next", "where can I play", "live game night" | Pull from KB, send event signup link |
| Sponsorship inquiry | "sponsor", "advertise", "partnership", "media kit" | Capture business + email, send sponsor_pitch email, offer Calendar 2 (`e9So05abGp6pRydHOPdO`) |
| Game help / how to play | "how do I play", "rules", "what does this mean" | Answer from KB, offer SMS tutorial |
| Wholesale inquiry | "wholesale", "bulk", "stock for my store", "B2B" | Send wholesale form link, alert Thomas |
| General info (fallback) | catchall | Answer from KB, keep ≤3 sentences, always end with CTA |

Full action sequences and form URLs in [`config/voice-ai-agent.json`](../config/voice-ai-agent.json).

#### 5. Escalation
Configure call forwarding when caller says any of:
> speak to Thomas, talk to a human, speak to the owner, manager, press, media, journalist, interview, complaint, refund, lawyer, legal, exclusive deal, custom pricing

- **Forward destination:** `+14049542115` (Thomas's mobile)
- **Transfer message:** `Aight, transferring you to Thomas now. Hold tight.`
- **After-hours fallback:** Send voicemail + SMS alert to Thomas with caller info and reason.

#### 6. Tools / Integrations to enable

Within the agent settings, enable these integrations:
- ✅ Calendar booking — link to all 3 calendars (`xX4X3z2vKwjBPldnYVj0`, `e9So05abGp6pRydHOPdO`, `bYMA4jte9RSdIWNDxDsP`)
- ✅ SMS sending (for follow-up links)
- ✅ Contact create/update by phone match
- ✅ Tag application
- ✅ Pipeline opportunity creation

#### 7. Call handling
- ✅ Recording enabled
- ✅ Transcription enabled
- Max call duration: 10 min (force escalation to Thomas if longer)
- Voicemail after: 30 sec

### Verification checklist
- [ ] Phone number rings the agent (test by calling it)
- [ ] Greeting plays correctly
- [ ] Each of the 7 goals fires when its trigger phrase is spoken
- [ ] KB lookup answers a basic question correctly (e.g., "How much is the game?")
- [ ] Escalation forwards to 478-654-9574 when "manager" is spoken
- [ ] After-hours voicemail captures and sends Thomas an SMS
- [ ] Call recording shows up in Conversations within 5 min of test call

---

## Agent 2 — Conversation AI Sales Rep

**Spec source:** [`config/conversation-ai.json`](../config/conversation-ai.json)

### Build path
**Settings → AI Employees → Conversation AI** (or **Conversations → ⚙ → AI Bot**)

### Configuration walkthrough

#### 1. Basic Info
- **Name:** `Adult Game Nights Sales Rep`
- **Knowledge Base:** Select **Adult Game Nights Master KB**
- **Personality prompt:**
  > Hype but not pushy. Like Thomas in your DMs — short, friendly, gets to the point. Drops 'vibe' or 'pull up' once per convo. Never corporate. Pro-Black, Atlanta-rooted. Always direct — give the answer first, soft-sell second. If you don't know an answer, say so and offer to connect them with Thomas at 478-654-9574.

#### 2. Channels
Enable on:
- ✅ SMS
- ✅ Instagram DM (also enable story replies)
- ✅ Facebook DM
- ✅ TikTok DM (if integration available — TikTok is intermittent in CreateOS)
- ✅ Web Chat widget — position bottom-right, accent color `#D50000` (brand red), greeting delay 30 sec

#### 3. Response style
- **Max length SMS:** 1-2 sentences (160 char ideal, never over 320)
- **Max length chat:** 2-3 sentences
- **Use emojis:** moderate (0-1 per response)
- **Tone:** hype but not pushy
- **Never use phrases:** "I'm sorry but...", "Unfortunately", "As an AI", "Per our policy", "Kindly", "best regards"
- **Preferred phrases:** "Yo", "Pull up", "Locked in", "Bet", "I gotchu", "What's good"

#### 4. Allowed actions

Enable in the agent's tool/action panel:

| Action | URL / target | Tag on success |
|---|---|---|
| Send checkout link | adultgamenights.com | buyer-intent |
| Send service booking link | crm.adultgamenights.com/book-game-night | service-booker-intent |
| Send event signup link | crm.adultgamenights.com/events | event-interest |
| Send sponsor inquiry link | crm.adultgamenights.com/sponsor | sponsor-lead |
| Send 3D print order link | crm.adultgamenights.com/3d-prints | source-3d-print-inquiry |
| Send wholesale link | crm.adultgamenights.com/wholesale | wholesale-inquiry |
| Send creator/affiliate link | crm.adultgamenights.com/creators | affiliate-applicant |
| Capture email + phone |  |  |
| Apply tags from Phase 1 taxonomy |  |  |
| Move contact through pipelines |  |  |
| Schedule on Calendars 1 / 2 / 3 |  |  |

#### 5. Hard limits (disallowed)
Set these as explicit constraints in the personality prompt or guardrails section:
- Discounting beyond 10%
- Custom sponsorship pricing
- Media/press inquiries
- Refund decisions
- Wholesale negotiation beyond standard tier sheet
- Contract / legal language
- Speculating on future products

For all of these, the agent should escalate (see below).

#### 6. Escalation rules
**Trigger phrases:** manager, owner, Thomas, speak to a human, real person, complaint, refund, lawyer, legal, media, press, journalist, wholesale, bulk, exclusive, custom deal, "this is ridiculous", "fed up", "garbage"

**Sentiment trigger:** if sentiment score drops below 0.3 OR frustration keywords detected.

**Length trigger:** if conversation exceeds 8 back-and-forth exchanges without resolution.

**Action when escalation fires:**
1. Tag conversation `escalate-to-thomas`
2. Send SMS to `+14049542115`: `🚨 Conversation needs your attention: {{contact.first_name}} ({{contact.phone}}) — '{{conversation_excerpt}}' — channel: {{channel}}`
3. Pause AI responses on this conversation
4. Final AI message to user: `Aight, looping in Thomas now. He'll hit you back ASAP.`

#### 7. Keyword auto-DM rules

For Instagram, TikTok, and Facebook posts where the caption invites comments, configure these comment-keyword auto-DMs:

| Keyword | Auto-DM message |
|---|---|
| GAME | `Yo! Liquor Store game's right here 🎲 https://adultgamenights.com — comment 'GAME' on any post = instant link drop.` |
| BUY | `Bet — order link incoming. https://adultgamenights.com 🎲` |
| PRICE | `Liquor Store game is $34.04 + shipping. Order here: https://adultgamenights.com 🎲` |
| BOOK | `We pull up to you 🎲 Three packages from $199. Lock in your night: https://crm.adultgamenights.com/book-game-night` |
| EVENT | `Pull up — events drop on the regular. Get on the list: https://crm.adultgamenights.com/events` |
| SPONSOR | `Adult Game Nights Live is coming 🎬 Founder rates locked through Q3. Submit here: https://crm.adultgamenights.com/sponsor` |
| CREATOR | `Creators get free games + 15% lifetime commission 🎲 Apply: https://crm.adultgamenights.com/creators` |
| WHOLESALE | `Bulk pricing locked in 💼 https://crm.adultgamenights.com/wholesale — we'll respond in 48h.` |
| 3D | `Custom NFC keychains, game pieces, all that 🎨 Quote in 24h: https://crm.adultgamenights.com/3d-prints` |

### Verification checklist
- [ ] DM the connected Instagram with "GAME" → auto-DM fires within 60s
- [ ] Send the connected SMS number "How much is the game?" → response within 60s with correct price
- [ ] Send a frustrated message ("This is garbage") → escalation fires, Thomas gets SMS, AI pauses
- [ ] Web chat widget appears on a test page after 30s
- [ ] Sponsor inquiry routes through 1-2 messages then offers Calendar 2 link

---

## Agent 3 — Reviews AI

**Spec source:** [`config/reviews-ai.json`](../config/reviews-ai.json)

### Build path
**Reputation → Settings → Auto Reply** (path may vary by UI version — look for "Reputation" or "Reviews")

### Pre-requisites
1. **Connect Google My Business** — Reputation → Connections → Google My Business → OAuth
2. **Connect Facebook Reviews** — Settings → Integrations → Facebook → OAuth (if Adult Game Nights has a FB page with reviews enabled)

### Configuration walkthrough

#### 1. Auto-response toggles
- ✅ Enable auto-reply for Google reviews
- ✅ Enable auto-reply for Facebook reviews
- ✅ Response delay: 15 minutes (prevents auto-replies feeling robotic)

#### 2. Per-rating rules

| Rating | Action | Template / Alert |
|---|---|---|
| ⭐⭐⭐⭐⭐ (5) | Auto-respond | `Yo {{customer_name}}! Appreciate the love 🎲 Glad y'all had a vibe. Tag us @adultgamenights when you play again, we want to see it! 🔥` |
| ⭐⭐⭐⭐ (4) | Auto-respond | `{{customer_name}} — thanks for playing! Glad you enjoyed it. If there's anything that would've made it 5 stars, hit us up at adultgamenights@gmail.com — we're always leveling up. 🙌` |
| ⭐⭐⭐ (3) | **Alert Thomas, NO auto-response** | SMS to 478-654-9574: `⚠️ 3-star review from {{customer_name}}: '{{review_excerpt}}' — Thomas, take a look: {{review_url}}. NO auto-response sent.` |
| ⭐⭐ (2) | **Alert Thomas (high priority), NO auto-response** | SMS + email to Thomas. Message: `🚨 2-star review — needs personal response within 4 hours.` |
| ⭐ (1) | **Alert Thomas (critical), NO auto-response, optionally auto-call** | SMS + email + call. Message: `🚨🚨 1-STAR review — RESPOND TODAY.` |

The negative-review email alert uses the existing **Negative Review Alert (Internal)** template (ID `69f81d12fe87bad8ce2777fe`) from Phase 3.

#### 3. Review request flow
This is already built in **Phase 4 Workflow 7 (review_request_automation)** — fires 7 days post-purchase or 1 day post-service-completed via the `review_request_email` template + `review_request_sms` SMS snippet. Reviews AI just handles the response side once the customer leaves a review.

### Verification checklist
- [ ] Google My Business connected and pulling reviews into Reputation tab
- [ ] Test 5-star review (post a real one or use a sandbox if CreateOS supports) → auto-reply within 15 min, copy matches template
- [ ] Test 4-star review → 4-star template fires
- [ ] Test 3-star review → Thomas gets SMS, NO auto-response posted publicly
- [ ] Negative Review Alert email arrives at adultgamenights@gmail.com

---

## Agent 4 (optional) — Agent Studio

**Endpoint:** `/agent-studio/` returns 404 — UI-only.

If your CreateOS version has Agent Studio (a unified control center for all AI employees):

### Build path
**Settings → AI Employees → Studio** (may be a tab labeled "AI Studio" or "Agent Center")

### Setup
1. Add the Voice AI Receptionist
2. Add the Conversation AI Sales Rep
3. Add the Reviews AI
4. Configure routing rules (which agent handles which channel — should already be set per-agent above)
5. Set up the unified analytics dashboard if available

If your CreateOS doesn't surface a Studio view, that's fine — the three agents work independently. Studio is just a convenience pane.

---

## After Track B build is complete

1. Run from `/Users/reecebyob/adult-game-nights-build`:
   ```bash
   node scripts/15-fetch-ai-agent-ids.js
   ```
   This pulls whatever agent endpoints become available (in case GHL ships them between now and then) and writes captured IDs to `/logs/voice-ai-agent-created.json`, `/logs/conversation-ai-created.json`, etc.

   **If those endpoints still 404**, the script will instead prompt you to manually paste agent IDs into a JSON template — the Pass 2 refresh script needs them.

2. Run the test plan from [`docs/ai-agent-test-plan.md`](ai-agent-test-plan.md).

3. Document any UI-build deviations in [`logs/ai-agent-build-notes.md`](../logs/ai-agent-build-notes.md) so Pass 2 can incorporate.

---

## Pass 2 trigger (when Thomas delivers)

When Thomas delivers:
- Voice samples → drop into `/inputs/voice-samples/` (any format: mp3, wav, m4a)
- FAQ list → save to `/inputs/faqs.md` (markdown Q&A format)

Then run:
```bash
node scripts/14-refresh-agent-personality.js
```

This script will:
1. Update KB FAQs (replace placeholder Q&As with Thomas's real FAQs)
2. Update KB tone-brand FAQs with extracted phrases from voice samples
3. Generate new personality prompts for Voice AI + Conversation AI
4. Print a UI-paste checklist for Maurice to drop the new prompts into the agents

(See [`docs/pass-2-refresh-instructions.md`](pass-2-refresh-instructions.md) for full Pass 2 process.)
