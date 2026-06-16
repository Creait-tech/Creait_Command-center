# Tier 4 — Comment-Keyword Auto-DM (Paste-Ready)

**Status:** Trigger viability ✅ VERIFIED in CreateOS workflow builder
**Date:** 2026-05-25

---

## Verification finding

Live UI inspection (Workflows → Create Workflow → Start from Scratch → Add New Trigger) confirmed three native comment triggers exist:

- **Facebook — Comment(s) on a Post** (under Facebook/Instagram Events)
- **Instagram — Comment(s) on a Post** (under Facebook/Instagram Events)
- **TikTok — comment(s) on a video** (under Communication)

YouTube is NOT in the native trigger list — confirms the original spec note ("YouTube uses a separate API"). For YouTube comment auto-DM, a separate integration (Restream / Zapier / a third-party app) is needed. Park YouTube for Sprint 2.

What's still unverified by visual inspection (the picker doesn't expose its filter UI until a trigger is fully added to the canvas):
- Whether each trigger supports a "comment text contains [keyword]" filter
- Whether the "Send DM" action targets the original commenter automatically

**Recommended validation path:** build ONE workflow ("GAME" keyword) via AI Builder using the prompt below. If the AI Builder produces a working filter + DM action, clone for the other 8 keywords. If it fails or the filter doesn't exist, fall back to a single "respond to all comments" workflow (less precise but still useful).

---

## How to fire each one (~5 min per workflow)

1. Workflows → **Build using AI**
2. Paste prompt → Submit
3. Verify: trigger has keyword filter set, action sends DM with correct text, tag-on-add works
4. Edit subject/body if AI shifted from Thomas's voice
5. Flip Draft → Publish

---

## 1. GAME → Buy Link

```
Workflow name: Auto-DM GAME Keyword. Trigger: Instagram comment posted on any AGN post. Filter: comment text contains "GAME" (case-insensitive). Filter: contact does NOT have tag 'buyer' AND does NOT have tag 'escalate-to-thomas'. Step 1: Send DM reply to the commenter with text: "Yo! Liquor Store game's right here 🎲 https://adultgamenights.com — pull up." Step 2: Add the tag 'source-comment-game' to the contact. Step 3: End the workflow. Stop conditions: tag 'unsubscribed'. Do NOT include any if/else branches. Keep flat and linear.
```

**Then duplicate for Facebook + TikTok:** open the published workflow → ⋮ menu → **Clone** → rename to "Auto-DM GAME Keyword (FB)" → change trigger to Facebook Comment, repeat for TikTok.

---

## 2. BUY → Buy Link + Buyer Intent Tag

```
Workflow name: Auto-DM BUY Keyword. Trigger: Instagram comment posted on any AGN post. Filter: comment text contains "BUY" (case-insensitive). Filter: contact does NOT have tag 'buyer' AND does NOT have tag 'escalate-to-thomas'. Step 1: Send DM reply: "Bet — buy link right here 🎲 https://adultgamenights.com. Reach out if you got questions." Step 2: Add tags 'source-comment-buy' and 'buyer-intent'. Step 3: End. Stop conditions: tag 'unsubscribed'.
```

---

## 3. PRICE → Price Anchor + Buy Link

```
Workflow name: Auto-DM PRICE Keyword. Trigger: Instagram comment posted on any AGN post. Filter: comment text contains "PRICE" (case-insensitive). Filter: contact does NOT have tag 'buyer'. Step 1: Send DM reply: "$34.04 with free shipping over $50 🎲 https://adultgamenights.com — pull up before it sells out." Step 2: Add tag 'source-comment-price'. Step 3: End. Stop conditions: tag 'unsubscribed'.
```

---

## 4. BOOK → Service Booking Path

```
Workflow name: Auto-DM BOOK Keyword. Trigger: Instagram comment posted on any AGN post. Filter: comment text contains "BOOK" (case-insensitive). Filter: contact does NOT have tag 'service-booker'. Step 1: Send DM reply: "Yo! For game night bookings text 478-654-9574 or fill out https://adultgamenights.com/book-game-night — we'll lock you in." Step 2: Add tag 'source-comment-book'. Step 3: End. Stop conditions: tag 'unsubscribed'.
```

---

## 5. EVENT → Event Inquiry

```
Workflow name: Auto-DM EVENT Keyword. Trigger: Instagram comment posted on any AGN post. Filter: comment text contains "EVENT" (case-insensitive). Step 1: Send DM reply: "Bet! Text 478-654-9574 with the date and we'll send you the next event details 🎲." Step 2: Add tag 'source-comment-event'. Step 3: End. Stop conditions: tag 'unsubscribed'.
```

---

## 6. SPONSOR → B2B Funnel

```
Workflow name: Auto-DM SPONSOR Keyword. Trigger: Instagram comment posted on any AGN post. Filter: comment text contains "SPONSOR" (case-insensitive). Step 1: Send DM reply: "Big bet — for sponsor inquiries email adultgamenights@gmail.com with your brand + budget and we'll pull up." Step 2: Add tags 'source-comment-sponsor' and 'sponsor-lead'. Step 3: End. Stop conditions: tag 'unsubscribed'.
```

---

## 7. CREATOR → UGC Pipeline

```
Workflow name: Auto-DM CREATOR Keyword. Trigger: Instagram comment posted on any AGN post. Filter: comment text contains "CREATOR" (case-insensitive). Step 1: Send DM reply: "Yo creator — reply with your @handle and follower count and we'll send the brief 🎲." Step 2: Add tag 'source-comment-creator'. Step 3: End. Stop conditions: tag 'unsubscribed'.
```

---

## 8. WHOLESALE → Wholesale Inquiry

```
Workflow name: Auto-DM WHOLESALE Keyword. Trigger: Instagram comment posted on any AGN post. Filter: comment text contains "WHOLESALE" (case-insensitive). Step 1: Send DM reply: "Bet — for wholesale reply with your store name, city, and target qty. We'll send pricing." Step 2: Add tag 'source-comment-wholesale'. Step 3: End. Stop conditions: tag 'unsubscribed'.
```

---

## 9. 3D → 3D Print Quote

```
Workflow name: Auto-DM 3D Keyword. Trigger: Instagram comment posted on any AGN post. Filter: comment text contains "3D" (case-insensitive). Step 1: Send DM reply: "We do 3D-printed custom pieces 🎲 — reply with your idea + qty and we'll quote you in 24h." Step 2: Add tag 'source-comment-3d'. Step 3: End. Stop conditions: tag 'unsubscribed'.
```

---

## After all 9 are built per platform

You'll end up with up to **27 workflows** (9 keywords × 3 platforms). To keep this manageable:

- Start with **Instagram only** (highest comment volume per AGN's social data)
- Validate that the 9 IG workflows fire correctly over 3-5 days
- Only then duplicate to Facebook + TikTok

**Faster alternative:** if the AI Builder lets a single workflow have multiple platform triggers, build 9 multi-platform workflows directly (saves ~18 duplicate workflows). Test on the GAME workflow first.

---

## Critical sanity checks before publishing each

- [ ] Trigger filter has "comment text contains [KEYWORD]" set with case-insensitive flag
- [ ] DM reply text matches Thomas's voice (Yo / Bet / Pull up — no corporate "Hello!")
- [ ] Tag-on-comment is correct (`source-comment-[keyword]`)
- [ ] Stop condition `unsubscribed` is set
- [ ] No if/else branches (keep flat — AI Builder can't reliably build branched workflows)
- [ ] Has the "Don't run again for same contact within 24h" option ticked (if available) — prevents spam

---

## Fallback if AI Builder fails on keyword filter

If the AI Builder cannot configure the "comment text contains" filter:

1. Build one workflow manually (drag trigger → click trigger node → Add Filter → "Comment Text" → Contains → "GAME")
2. Use the Workflow → ⋮ → Clone option 8 times
3. Edit each clone: change keyword filter + DM text + tag

Manual cloning is fast (~3 min each) and avoids AI Builder hallucinations.

---

**Date:** 2026-05-25
**Author:** Maurice / CREAIT
