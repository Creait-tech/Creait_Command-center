# /inputs/ — Pass 2 Refresh Drop Zone

Drop Thomas's deliverables here when they arrive. The Pass 2 refresh script reads from this directory.

## What goes here

### `voice-samples/`
Audio files (mp3, wav, m4a). Anything 3-5 minutes total of Thomas talking naturally about the business is enough. Examples that work well:
- A short "intro to Adult Game Nights" video voiceover
- A live event clip where Thomas is hosting
- A walkthrough of the game he recorded for social media
- A voice memo where he just describes the brand and customers

The Pass 2 script extracts characteristic phrases, tone, and style markers from these samples. It does NOT clone the voice itself for Voice AI playback — that's done separately via ElevenLabs voice cloning in the agent UI. The samples drive *text-side* personality only.

### `faqs.md`
Markdown file of real customer questions and Thomas's actual answers. Format flexible — section headers, bulleted Q/A, anything readable. Example:

```markdown
# Questions we get all the time

## How does the game actually work?
You roll dice, pull a card, every card has a challenge — drink, dare, or one of the QR-code minigames in the app. We've got like 200+ challenges so games stay fresh.

## Is this just a drinking game?
Nah, we lean into adult themes but you don't have to drink. Substitute the drink rule for any other challenge. The vibe is the point, not the alcohol.

## How is this different from Cards Against Humanity?
…
```

The script normalizes whatever format Thomas uses into clean Q&A pairs and writes them to the KB.

## After dropping files

```bash
node scripts/16-refresh-agent-personality.js
```

Idempotent — running it multiple times only updates content, doesn't duplicate. See [`docs/pass-2-refresh-instructions.md`](../docs/pass-2-refresh-instructions.md) for the full process.
