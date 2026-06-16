# AI Agent Test Plan (Track B)

After agents are built per [`ai-agents-build-guide.md`](ai-agents-build-guide.md), run through this test plan. Document results in [`logs/ai-agent-test-results.json`](../logs/ai-agent-test-results.json) (create if missing).

The KB layer has automated tests via `node scripts/14-test-knowledge-base.js` — those passed 18/18 in Pass 1. Conversation tests below are manual / semi-manual since the agent endpoints aren't API-routable.

---

## Voice AI Receptionist Tests

### V1. Greeting + KB lookup
- **Test:** Call the agent's number from your phone.
- **Expected:** Greeting plays: "Yo! You've reached Adult Game Nights, what's good?"
- **Then say:** "How much is the Liquor Store game?"
- **Expected response:** Mentions $34.04, and either offers to text the link or completes with a CTA.
- **Result:** ✅ / ❌ / notes

### V2. Goal — Book a service
- **Say:** "I want to book a game night for my birthday."
- **Expected:** Agent asks for date, location, package preference, headcount. Caps at 4 questions then sends booking SMS.
- **Verify in CRM:**
  - Contact created/updated with phone match
  - Tags applied: `source-game-night-booking`, `service-booker`
  - Pipeline opportunity created in `Game Night Service` → `Inquiry`
  - SMS arrived with `crm.adultgamenights.com/book-game-night`

### V3. Goal — Sponsor inquiry, ask price
- **Say:** "I want to sponsor the game show. How much does it cost?"
- **Expected:** Agent does NOT quote pricing. Pivots to: "Pricing's tier-based and Thomas locks in founder rates personally. Wanna jump on a quick call?"
- **Then say "yes"** and verify Calendar 2 (`e9So05abGp6pRydHOPdO`) booking link arrives via SMS.

### V4. Escalation — "speak to Thomas"
- **Say:** "I want to speak to Thomas right now."
- **Expected:** Agent says "Aight, transferring you to Thomas now. Hold tight." and forwards to +14049542115.
- **Verify:** Thomas's phone rings within 10s.

### V5. Escalation — frustrated complaint
- **Say:** "This game broke my night. I want a refund."
- **Expected:** Agent escalates immediately (refund keyword). Forwards to Thomas OR if after-hours, takes a voicemail and SMSes Thomas.

### V6. Off-topic deflection
- **Say:** "What's the weather in Atlanta?"
- **Expected:** Agent stays in scope: "I gotcha, but I'm gonna stay locked in on Adult Game Nights stuff. Got a question about the game, booking a game night, or sponsorship?"

### V7. Voicemail capture (after hours)
- Test by calling between 11pm-7am ET (or simulate by enabling test mode).
- **Expected:** Voicemail message plays, recording happens, Thomas gets SMS alert with caller info + transcript link.

---

## Conversation AI Tests

### C1. SMS — KB lookup
- **From a test phone:** Send "How much does the game cost?"
- **Expected:** Reply within 60s, response is 1-2 sentences, mentions $34.04.

### C2. Instagram DM — keyword auto-reply
- **From a test IG account:** Comment "GAME" on any AGN post.
- **Expected:** Auto-DM fires: `Yo! Liquor Store game's right here 🎲 https://adultgamenights.com — comment 'GAME' on any post = instant link drop.`

### C3. SMS — book service intent
- **Send:** "Can y'all come to my birthday next month?"
- **Expected:** Brief response with packages summary + booking link. NOT a list of all 4 tiers.
- **Verify:** Contact tagged `service-booker-intent`.

### C4. Web Chat — sponsor inquiry
- **Open a test page with the chat widget.** After 30s, the greeting should appear.
- **Type:** "I want to advertise on the show."
- **Expected:** Agent captures business name, email, products. Tags `sponsor-lead`, `source-sponsor-inquiry`. Sends `sponsor_pitch` email. Offers Calendar 2 link.

### C5. Hard limit — discount over 10%
- **Send:** "Can I get 25% off?"
- **Expected:** Agent declines politely, offers 10% via PLAY10 OR escalates. Does NOT issue 25%.

### C6. Escalation — frustration trigger
- **Send:** "This is ridiculous, my order hasn't shipped."
- **Expected:** Agent stops responding within 1 message, sends final: "Aight, looping in Thomas now. He'll hit you back ASAP." Tags `escalate-to-thomas`. SMS sent to +14049542115.

### C7. Length cap — long conversation
- Force an 8+ exchange chat where the user keeps asking follow-ups without resolution.
- **Expected:** After 8th AI reply, the agent escalates to Thomas.

### C8. Forbidden phrases check
- Across all C1-C7 responses, verify the agent NEVER says: "I'm sorry but...", "Unfortunately", "As an AI", "Per our policy", "Kindly", "best regards".

---

## Reviews AI Tests

### R1. 5-star review
- Post a real or sandbox 5-star review on the connected Google My Business listing.
- **Expected:** Within 15 min, AGN auto-replies: `Yo {{customer_name}}! Appreciate the love 🎲 …`
- Verify customer name is interpolated correctly.

### R2. 4-star review
- Post a 4-star review.
- **Expected:** Auto-reply with the 4-star template offering email feedback.

### R3. 3-star review
- Post a 3-star review.
- **Expected:** **NO auto-response.** Thomas gets SMS alert at 478-654-9574 within 15 min.
- Verify the `Negative Review Alert (Internal)` email arrives in Thomas's inbox.

### R4. 2-star review
- Post a 2-star review.
- **Expected:** No public response. SMS + email to Thomas, marked high-priority.

### R5. 1-star review
- **Optional** — only test in sandbox if available. Can have permanent reputation impact in real GMB.
- **Expected:** No public response. Critical-priority SMS + email + (optional) auto-call to Thomas.

### R6. Review request workflow integration
- Tag a test contact `buyer`.
- Wait 7 days (or simulate via workflow time-travel if CreateOS supports).
- **Expected:** `review_request_email` + `review_request_sms` fire (these are Phase 4 workflow assets).

---

## End-to-end customer journey test

The full happy path. Run this once everything's wired:

1. **Discovery:** Comment "GAME" on Instagram → auto-DM with checkout link → click → buy game on adultgamenights.com.
2. **Post-purchase:** Order tag fires → Workflow 2 (Post-Purchase Welcome Series) starts → welcome email arrives → app download email next day.
3. **Question:** Customer texts the AGN number "How do I play this card?" → Conversation AI responds from KB.
4. **Booking:** Customer DMs "I want to book you for my birthday" → AI sends booking link → customer fills out Form 1.
5. **Service execution:** Workflow 6 (Game Night Service Booking) fires → confirmation, deposit reminder, day-of SMS, post-event thank-you.
6. **Review:** 7 days later → Workflow 7 (Review Request) → customer leaves 5-star review on Google → Reviews AI auto-thanks them.
7. **Reactivation:** 90 days of silence → contact lapses to `lapsed-90d` → eventually hits Workflow 1 (Reactivation Campaign) trigger if re-imported.

If all 7 steps work end-to-end, Pass 1 is verified.

---

## Test Results Template

Save to `logs/ai-agent-test-results.json`:

```json
{
  "test_run_date": "YYYY-MM-DD",
  "tester": "Maurice / Thomas / etc",
  "voice_ai": {
    "V1": {"pass": true, "notes": ""},
    "V2": {"pass": true, "notes": ""},
    "V3": {"pass": true, "notes": ""},
    "V4": {"pass": true, "notes": ""},
    "V5": {"pass": true, "notes": ""},
    "V6": {"pass": true, "notes": ""},
    "V7": {"pass": true, "notes": ""}
  },
  "conversation_ai": {
    "C1": {"pass": true, "notes": ""},
    "C2": {"pass": true, "notes": ""},
    "C3": {"pass": true, "notes": ""},
    "C4": {"pass": true, "notes": ""},
    "C5": {"pass": true, "notes": ""},
    "C6": {"pass": true, "notes": ""},
    "C7": {"pass": true, "notes": ""},
    "C8": {"pass": true, "notes": ""}
  },
  "reviews_ai": {
    "R1": {"pass": true, "notes": ""},
    "R2": {"pass": true, "notes": ""},
    "R3": {"pass": true, "notes": ""},
    "R4": {"pass": true, "notes": ""},
    "R5": {"pass": "skipped", "notes": "real GMB — skipped"},
    "R6": {"pass": true, "notes": ""}
  },
  "e2e_journey_passed": true,
  "issues_to_revisit_in_pass_2": []
}
```
