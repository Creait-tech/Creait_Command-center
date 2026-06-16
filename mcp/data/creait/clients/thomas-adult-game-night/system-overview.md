# System Overview — Plain English

A 3-minute read so anyone can understand the AGN system without prior context.

---

## What it does

Every person who interacts with Adult Game Nights — buys a game, comes to an event, slides in your DMs, calls the number, plays the game in the app, fills out the wholesale form — ends up in **one CRM**.

That CRM:
1. **Tags them** by source, behavior, product, and engagement level
2. **Talks to them** via AI agents (voice, SMS, DM, web chat) 24/7
3. **Moves them** through a sales pipeline automatically
4. **Sends them** the right email or SMS at the right time
5. **Reports back** to Thomas every day, week, and month
6. **Captures their data** for future marketing

The whole system runs without Thomas's daily intervention. He gets to focus on hosting, creating, and promoting — the things only he can do.

---

## The 4 input channels

```
1. WEBSITE                — Forms (booking, sponsor, event, wholesale, affiliate, 3D print)
                            and Shopify checkout

2. SOCIAL MEDIA           — DMs and comments on Facebook, Instagram, TikTok, YouTube
                            (auto-DMs fire when someone comments keywords like GAME, BUY, BOOK)

3. PHONE / SMS            — Voice AI receptionist answers calls, captures the goal,
                            sends booking links via SMS, escalates to Thomas if needed

4. APP                    — Every player who scans into a game lobby fires a webhook
                            (highest-leverage channel — 5-10 leads per game night)
```

---

## The 4 sales pipelines

```
1. GAME SALES (E-commerce)
   Cold Lead → Visited Site → Cart Abandoned → Purchased → App Downloaded → Repeat → 3D Kit

2. GAME NIGHT SERVICE
   Inquiry → Quote Sent → Deposit Paid → Confirmed → Day-Of → Completed → Review → Rebooked

3. EVENT ATTENDEES
   Registered → Checked In → Played Game (App Lobby) → Followed Up → Converted to Buyer

4. SPONSORSHIP/B2B
   Lead → Pitch Sent → Negotiating → Signed → Active Sponsor
```

Workflows handle 90% of pipeline movement automatically. Thomas only manually moves people for edge cases.

---

## The 8 automated workflows

```
1. Reactivation Campaign      — fires when 15K legacy contacts get imported
2. Cart Abandonment Recovery  — 3 emails + 1 SMS over 9 days, cart-tagged contacts
3. Post-Purchase Welcome      — 5 emails over 30 days, every new buyer
4. Event Registration         — pre-event reminders + day-of + post-event thank you
5. Sponsor Pipeline           — internal alert + auto-pitch + 3 follow-ups over 28 days
6. Service Booking            — most complex, 21 steps: confirmation through rebook
7. Review Request             — 7 days after purchase OR 1 day after service
8. App Lobby Capture          — webhook from Thomas's app → CRM contact
```

---

## The 3 AI agents

```
1. VOICE AI RECEPTIONIST       — answers every inbound call 24/7
                                  • Routes to: book service, buy game, ask about events,
                                    sponsorship, game help, wholesale
                                  • Escalates to Thomas on: refund/complaint/media/press

2. CONVERSATION AI SALES REP   — handles SMS, IG DM, FB DM, TikTok DM, web chat
                                  • Sends links, captures emails, applies tags
                                  • 9 keyword auto-DMs on Instagram/TikTok comments
                                  • Escalates after 8 messages or on negative sentiment

3. REVIEWS AI                  — auto-responds to 4-5 star reviews
                                  • SMS+email alert to Thomas on 1-3 star reviews
                                  • NEVER auto-responds to negatives (Thomas handles)
```

All 3 agents read live from the same Knowledge Base (67 FAQs covering business basics, products, services, events, sponsorship, wholesale, creators, shipping, tone/escalation rules).

---

## The reporting layer

```
DAILY (8am ET)         — Yesterday's revenue, new contacts, bookings, attention items
WEEKLY (Sun 6pm ET)    — Pipeline movement, top content, workflow performance
MONTHLY (1st 9am ET)   — P&L summary, top customers, social growth, recommendations
DASHBOARD (24/7)       — 15 tiles across TODAY / THIS WEEK / TRENDS rows
                          (5 tiles on mobile)
```

---

## What's plugged in vs what's not

```
PLUGGED IN ALREADY:
  ✅ Shopify (e-commerce)
  ✅ Facebook + Instagram + TikTok + YouTube (social)
  ✅ Knowledge Base (67 FAQs)
  ✅ 7 launch social posts (drafts ready)
  ✅ 20 email templates
  ✅ 8 custom values
  ✅ 38 custom fields, 39+ tags

NEEDS UI BUILD (Maurice / Track B):
  🟡 4 pipelines, 6 forms, 8 workflows, 3 AI agents, dashboard
  🟡 8 SMS snippets, landing pages

NEEDS EXTERNAL ACTION:
  🚦 Stripe (Thomas creates account)
  🚦 ShipStation (Thomas confirms login)
  🚦 QuickBooks (Thomas confirms login)
  🚦 Google My Business (Thomas + Maurice OAuth)
  🚦 App webhook URL (Thomas's developer)
  🚦 Pass 2: voice samples + FAQ list (Thomas delivers, then 30 min refresh)
```

---

## How it scales

```
DAY 1            10 contacts/day   →   AI handles 100% via KB
DAY 30          100 contacts/day   →   AI handles 95%, Thomas escalations 5%
DAY 90        1,000 contacts/day   →   AI handles 95%, daily ops mostly automated
DAY 180+      Unlimited            →   System runs without Thomas in the loop
                                       Thomas focuses on game show, brand, scale
```

The architecture has no Thomas-bottleneck. Everything that can be automated is automated. The things that need Thomas (creative, hosting, strategic, emotionally-charged conversations) get routed to him; everything else stays out of his way.

---

## The mission

Pull Thomas out of the weeds.

Get him on stages. Get him creating. Get him promoting.

Let the system handle:
- Customer questions
- Sales follow-ups
- Event reminders
- Review responses
- Pipeline movement
- Reporting

That's the system. That's the whole thing.

---

**For depth:** [`docs/MASTER-REPORT.md`](../docs/MASTER-REPORT.md)
**For day-to-day:** [`docs/operations-manual.md`](../docs/operations-manual.md)
**For training:** Loom videos 01-10 (when recorded)
