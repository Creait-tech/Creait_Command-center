# Pass 2 Refresh — When Thomas Delivers

This is a **30-minute refresh**, not a rebuild. Pass 1 left the agent infrastructure live with placeholder personality. Pass 2 swaps in Thomas's real voice and FAQs.

---

## Trigger

Run Pass 2 when both are true:
- ✅ At least one voice sample is in `/inputs/voice-samples/`
- ✅ Thomas has delivered an FAQ list (any markdown format) at `/inputs/faqs.md`

You can run with just one of the two — the script gracefully handles missing inputs.

---

## Step 1 — Drop the inputs

### Voice samples
```bash
cp ~/Downloads/thomas-intro.mp3 /Users/reecebyob/adult-game-nights-build/inputs/voice-samples/
cp ~/Downloads/event-clip.m4a /Users/reecebyob/adult-game-nights-build/inputs/voice-samples/
# any number of files; mp3, wav, m4a, ogg, webm all supported
```

3-5 minutes total of audio is plenty. Examples that work well:
- An "intro to Adult Game Nights" video voiceover
- A live event clip where Thomas is hosting
- A walkthrough of the game he recorded for social
- A voice memo where he just describes the brand and customers

### FAQ list
Save Thomas's real Q&A list as markdown at `/inputs/faqs.md`. Format flexible — script accepts:

**Pattern A — section headers:**
```markdown
## How does the game actually work?
You roll dice, pull a card, every card has a challenge — drink, dare, or one of the QR-code minigames. We've got 200+ challenges so games stay fresh.

## Is this just a drinking game?
Nah, we lean adult themes but you don't have to drink. Sub the drink rule for any other challenge.
```

**Pattern B — bold Q/A:**
```markdown
**Q:** How does the game actually work?
**A:** You roll dice, pull a card, every card has a challenge…

**Q:** Is this just a drinking game?
**A:** Nah, we lean adult themes…
```

**Pattern C — line-prefixed:**
```markdown
Q: How does the game actually work?
A: You roll dice, pull a card…
```

Mix patterns if needed — the parser handles all three.

---

## Step 2 — Run the refresh

```bash
cd /Users/reecebyob/adult-game-nights-build
node scripts/16-refresh-agent-personality.js
```

Output:
```
Parsed N FAQs from inputs/faqs.md
Found M voice sample(s) in inputs/voice-samples/

Deleting K placeholder FAQ(s) from topic frequently_asked...
Inserting N FAQ(s) from inputs/faqs.md...

Refreshing tone_brand FAQs (M voice samples included)...

Refresh complete.
  Created: N+3
  Updated: 0-3
  Errors:  0

Next step: open /Users/reecebyob/adult-game-nights-build/logs/pass-2-refresh-output.md and paste the personality prompts into the agents in CreateOS UI.
```

---

## Step 3 — Listen to voice samples (manual)

The script can't transcribe audio (no STT pipeline wired in). It marks the tone FAQs as "PASS 2 NOTE: N voice sample(s) provided. Listen to extract Thomas-isms."

**Manual task** (10-15 min):
1. Listen to each voice sample in `/inputs/voice-samples/`
2. Note specific phrases Thomas uses repeatedly:
   - Greetings ("Yo," "What's good fam," etc.)
   - Sign-offs ("Pull up," "Stay locked in")
   - Hype words he leans on ("crazy," "wild," "lit," whatever's specific)
   - Filler patterns ("you feel me," "no cap," "for real")
3. Open the **Adult Game Nights Master KB** in CreateOS UI
4. Find the FAQ "What's the Adult Game Nights vibe?"
5. Append the extracted phrases at the end of the answer

The agents will pick up the new phrases on their next response — KB is read live.

---

## Step 4 — Paste personality prompts

The script generates `/logs/pass-2-refresh-output.md` with two ready-to-paste prompts:

### Voice AI Receptionist
- Open: **Settings → AI Employees → Voice AI Agents → Adult Game Nights Receptionist**
- Find the personality / system prompt field
- Replace its contents with the **Voice AI Receptionist personality prompt** block from `pass-2-refresh-output.md`
- Save

### Conversation AI Sales Rep
- Open: **Settings → AI Employees → Conversation AI → Adult Game Nights Sales Rep**
- Find the personality / system prompt field
- Replace its contents with the **Conversation AI Sales Rep personality prompt** block
- Save

---

## Step 5 — (Optional) Voice cloning

If you want the Voice AI Receptionist to *sound* like Thomas (not just talk like him in text), set up an ElevenLabs voice clone:

1. Sign in to ElevenLabs (or use the GHL ElevenLabs integration if available)
2. Create a new voice clone — upload the voice samples from `/inputs/voice-samples/`
3. Wait for training (5-15 min)
4. In CreateOS Voice AI Receptionist settings → Voice → swap the voice ID to the new clone

This is optional. The agent works fine with a stock voice; the clone is a nice-to-have for premium brand feel.

---

## Step 6 — Re-test

Run the relevant tests from [`ai-agent-test-plan.md`](ai-agent-test-plan.md) again — focus on:
- V1 (greeting + KB lookup) to confirm new personality lands
- V2 (book a service) to confirm goals still fire
- C1, C3 (Conversation AI replies) to confirm new tone

If anything sounds off or the new FAQs aren't being used, re-run the refresh and check `/logs/pass-2-refresh-results.json` for errors.

---

## What this doesn't change (intentional)

- **Knowledge base structure** — same KB ID, same topics
- **Other FAQ topics** — only `frequently_asked` and `tone_brand` are touched
- **Agent IDs** — voice/conversation/reviews agents keep the same IDs
- **Workflows** — Phase 4 workflows untouched
- **Pipelines, forms, calendars, custom fields** — untouched

This is why Pass 2 is a 30-min refresh and not a rebuild.

---

## Roll back if needed

To revert to Pass 1 placeholder personality:
```bash
# Re-run the original KB seed script (idempotent — it'll skip everything that exists)
node scripts/13-create-knowledge-base.js
# Then manually delete the new FAQs that came from inputs/faqs.md if you want them gone
```

Or just clear `/inputs/faqs.md` and re-run Pass 2 — the script will skip the FAQ section and only refresh tone.
