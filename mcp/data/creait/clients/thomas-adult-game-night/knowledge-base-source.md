# Knowledge Base — Source-of-Truth Long Form

**Why this doc exists:** GHL's Knowledge Base API only exposes FAQs (Q&A pairs) for content seeding. Rich-text and URL document types are not yet routable via API (verified in Phase 5 endpoint probe). We've converted the 8 source documents from the Phase 5 spec into FAQ format in [`config/knowledge-base.json`](../config/knowledge-base.json), but the original long-form prose is preserved here for reference, refresh cycles, and any future document-style API support.

---

## Document 1: Business Basics

- **Business Name:** Adult Game Nights
- **Owner:** Thomas Gray
- **Address:** 504 Fair Street, Atlanta, GA 30313
- **Phone:** 478-654-9574
- **Email:** adultgamenights@gmail.com
- **Service Area:** Atlanta metro area, with travel options outside I-285
- **Hours of Operation:** 24/7 inbound (AI handles after-hours)
- **Brand Voice (placeholder until Pass 2):** Energetic, casual, hype, DJ-host energy. Uses phrases like "vibe," "lit," "turn up." Direct and friendly. Never corporate.

---

## Document 2: Liquor Store Board Game

- **Product:** The Liquor Store Adult Board Game
- **Price:** $34.04 (subject to periodic adjustment)
- **Description:** An adult drinking board game where players roll dice, pull cards, and complete drink-related challenges. Comes with a digital companion app that includes mini-games (bowling, this-or-that, dance-off with avatar) accessed via QR codes on the cards.

**What's Included:**
- Game board, cards, dice, 4 player pieces
- Companion app access (free version + premium upgrade $0.99)

**Where to Buy:** https://adultgamenights.com (or current site URL)
**Stock Status:** 10,000 units in stock as of build date
**Shipping:** Customer pays shipping. Free shipping promotions run periodically.

**Premium App Features:** Save game night photos/videos to folders, custom photo frames, save recap videos, organize by event (birthday, family reunion, holiday).
**Free App Features:** All gameplay, QR code minigames, basic recap viewing.

---

## Document 3: Game Night Service

Done-for-you adult game night events. Thomas drops off games, optionally hosts as MC.

**Tiers:**
- **Drop-Off Only:** $199. Thomas drops off games for a few hours, picks them up later that night or next day.
- **Drop-Off + Host:** $299. Thomas comes for 2-3 hours, hosts the game night, brings energy as MC.
- **Premium Full Event:** $499+. Full corporate or commercial event hosting (bars, lounges, corporate offsites).
- **Backyard Package:** Custom pricing. Big yard games (Connect Four giant, big Jenga, etc.).

**Booking Lead Time:** 7 days minimum. 48-hour bookings subject to emergency rush fees.
**Service Area:** Inside I-285 = base price. Outside I-285 = $25 travel fee. Out-of-town destinations = customer covers travel/lodging.
**Deposit:** 50% required to lock the date. Balance due upon arrival.
**Cancellation Policy:** Full refund if cancelled 14+ days out. Partial refund within 7-14 days. Within 7 days the deposit is non-refundable.

**How to Book:** crm.adultgamenights.com/book-game-night, or call/text 478-654-9574.

---

## Document 4: 3D Print Custom Orders

Custom NFC-enabled 3D printed accessories.

**Products:**
- NFC Keychains (tap-to-launch business cards or links) — from $8/unit
- Custom Game Pieces — from $4/piece
- Wine Holders — quote-based
- Custom 3D Prints (brand logos, event swag) — quote-based

**How It Works:** Customer uploads logo and specs via the 3D Print order form. Thomas designs and prints in-house.
**Turnaround:** 5-7 business days production after design approval, then ships nationwide.
**How to Order:** crm.adultgamenights.com/3d-prints

---

## Document 5: Events

Adult Game Night events happen periodically at various Atlanta venues.

**Confirmed Upcoming:**
- Russell Center Game Night — July 3, 2026

**Past Events:** Multiple game nights throughout Atlanta over the past 2+ years. Built loyal community.

**How to Find Out About Events:** Follow @adultgamenights on Instagram, TikTok, Facebook. Sign up at the website to get email notifications.

---

## Document 6: Game Show — "Adult Game Nights Live"

In production. A live game show featuring Black-owned products and businesses. Format inspired by The Price is Right. Contestants compete in trivia and games to win prizes that are all Black-owned.

**Sponsorship:** Open to Black-owned businesses. Sponsors submit 2 products for placement, automatically becoming a sponsor at the minimum tier. Tiers: Bronze, Silver, Gold, Platinum. Pricing set after pilot performance data — founder rates locked through Q3 2026.

**Production:** Season 1 = 8 episodes, weekly drops planned for Q3 2026.

**How to Sponsor:** crm.adultgamenights.com/sponsor

---

## Document 7: Frequently Asked Questions (PASS 2 REPLACEMENT)

> Placeholder content until Thomas delivers his real FAQ list. The questions below are best-guess defaults. Pass 2 refresh (`scripts/14-refresh-agent-personality.js`) replaces these with extracted content from `inputs/faqs.md`.

**Q: How do I play the Liquor Store game?**
Roll the dice, pull a card, complete the challenge. Use the QR codes on cards to launch minigames in the app. Take shots, take photos, have fun.

**Q: Is the app required?**
No, but it makes the experience way better. Free version available, premium is $0.99.

**Q: How many players?**
Designed for 2-8 players. More fun with bigger groups.

**Q: How long does a game last?**
Typically 30-60 minutes per round. Most game nights play multiple rounds.

**Q: Can I host a game night with the service?**
Yes — book through our service page. Three tiers depending on whether you want drop-off only or full hosting.

**Q: Do you ship outside Atlanta?**
Yes, the board game ships nationwide via Shopify. Customer pays shipping.

**Q: Do you do corporate events?**
Yes — Premium Full Event tier ($499+) covers corporate offsites, bars, lounges, etc.

---

## Document 8: Tone & Brand Guidelines (PASS 2 REPLACEMENT)

> Placeholder personality until Thomas delivers voice samples. Pass 2 refresh extracts characteristics from `inputs/voice-samples/` and replaces this section.

**Default Pass 1 personality:**
- Energetic and hype, like a DJ-host
- Casual and friendly, never corporate
- Direct — gets to the point fast
- Uses sentence fragments OK
- Drops occasional hype words: "vibe," "lit," "turn up," "fam," "bro"
- Emojis sparingly in body, more in subject lines
- Short paragraphs (1-3 sentences)
- Always confident, never apologetic
- Pro-Black, community-oriented, supports Atlanta culture
- Comfortable with adult themes (it's an adult game) but not crude

Pass 2 will analyze voice samples and replace this with extracted style.
