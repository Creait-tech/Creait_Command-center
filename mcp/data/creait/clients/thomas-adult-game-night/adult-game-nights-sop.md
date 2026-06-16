# Adult Game Nights — Standard Operating Procedures (SOP)

**Version:** 1.0 (Pass 1 — pre-Thomas-voice-refresh)
**Last updated:** 2026-05-04
**Owner:** Thomas Gray | Maintainer: Maurice Grant (CREAIT)

This SOP is the long-form companion to [`operations-manual.md`](operations-manual.md). The ops manual answers "how do I do X today"; this SOP answers "how does the whole system work and what's our cadence."

---

## Section 1 — System Overview

### What's connected

```
                       ┌──────────────────────┐
                       │ External traffic     │
                       │ (web, social, events)│
                       └──────────┬───────────┘
                                  ▼
            ┌─────────────────────────────────────────┐
            │ INPUT LAYER                             │
            │ • 6 forms (Service, Sponsor, Event,     │
            │   Wholesale, Affiliate, 3D Print)       │
            │ • Social DMs (4 platforms)              │
            │ • Voice AI receptionist (24/7)          │
            │ • Shopify checkout webhook              │
            │ • App lobby webhook (pending dev)       │
            │ • Manual contact entry                  │
            └──────────┬──────────────────────────────┘
                       ▼
            ┌─────────────────────────────────────────┐
            │ CRM LAYER (CreateOS / GoHighLevel)      │
            │ • 38 custom fields                      │
            │ • 39+ tags (4-bucket taxonomy)          │
            │ • 4 pipelines, 24 stages                │
            │ • 8 custom values                       │
            │ • Knowledge Base: 67 FAQs               │
            └──────────┬──────────────────────────────┘
                       ▼
            ┌─────────────────────────────────────────┐
            │ AUTOMATION LAYER                        │
            │ • 8 core workflows                      │
            │ • 3 AI agents (Voice, Conv, Reviews)    │
            │ • 20 email templates                    │
            │ • 8 SMS snippets                        │
            └──────────┬──────────────────────────────┘
                       ▼
            ┌─────────────────────────────────────────┐
            │ OUTPUT LAYER                            │
            │ • Email + SMS to contacts               │
            │ • Pipeline progression                  │
            │ • Internal alerts to Thomas             │
            │ • Social post scheduling                │
            │ • 3 automated reports (daily/wk/mo)     │
            │ • Dashboard real-time view              │
            └─────────────────────────────────────────┘
```

### Data flow at peak event

When Thomas hosts a Russell Center game night:
1. Pre-event: Workflow 4 sends 7-day + 1-day reminders to all registered contacts
2. Day-of: Players scan QR → app webhook fires → Workflow 5 creates contacts, tags, pipeline opps for each player
3. Mid-event: Photos/videos hit AGN server, recap rendering begins
4. Post-event (day +1): Workflow 4 fires post-event thank-you email
5. Post-event (day +7): Workflow 7 fires review request
6. Post-event (day +30): Engagement check → either keep nurturing or move to lapsed cohort

One game night with 50 attendees = ~50 new contacts, 3+ pipeline movements per contact, ~7 emails over 30 days.

---

## Section 2 — Daily Operations (5 min/day)

### Morning ritual (5 min)
1. Open dashboard
2. Top row scan:
   - Escalations needing response → handle first
   - Today's services → verify addresses
   - Negative reviews → respond if any
3. Read the daily snapshot email (8am ET)

### Throughout the day
- AI agents handle inbound DMs/SMS automatically
- Voice AI handles inbound calls
- Workflows fire emails on schedule
- New contacts auto-flow through forms

### Things that DON'T require daily attention
- Email sends (workflows handle)
- Social posts (scheduled per Phase 6 launch + ongoing)
- Tag application (workflows + AI agents apply)
- Pipeline moves (workflows handle 90% — Thomas only manually moves on edge cases)

### Things that DO require daily attention
- Escalated conversations (AI tagged `escalate-to-thomas`)
- Today's service bookings (verify, prep, show up)
- Negative reviews (4-hour SLA on responses)
- Anything flagged in the daily email

---

## Section 3 — Weekly Operations (30 min/week, Sundays)

### Sunday 6pm ET — Weekly Review
1. Read the weekly review email (auto-fires)
2. Open dashboard, scroll to "THIS WEEK" row
3. Identify the **one** thing to optimize next week. Examples:
   - Cart recovery rate dipped → check Workflow 1, refresh discount code
   - Social engagement dropped → schedule a content burst
   - Pipeline bottleneck at "Quote Sent" → investigate why deposits aren't landing
   - Sponsor leads stalled → tighten the sponsor pitch email or add a "founder rate expires" post

### Sunday content planning
1. Open Social Planner → Drafts
2. Pick 2-3 posts to schedule for the upcoming week
3. Use AI Studio (Loom 09) if you need to generate fresh content
4. Approve any AI-drafted posts in queue

### Sunday team check (when team grows)
- Review escalations from the past week — is there a pattern?
- Review AI conversation length — long convos may signal KB gaps
- Update KB FAQs that gave wrong answers

---

## Section 4 — Monthly Operations (2 hr/month, 1st-3rd of month)

### 1st of month — read the monthly report
- Revenue trend
- Top 5 customers (DM each one personally to thank — biggest ROI activity in this whole system)
- Active sponsors count
- Social growth per platform

### Pipeline cleanup (1 hr)
- Filter opportunities by "Last activity > 30 days"
- For each: either reach out personally OR move to Lost
- Don't let dead opportunities pile up

### Content audit (30 min)
- What posts performed best last month? Replicate the format/timing.
- What posts flopped? Don't repeat that format.
- Did any UGC/affiliate creator content go viral? Reach out, deepen the partnership.

### KB freshness (30 min)
- Did the AI escalate any conversations because it didn't know the answer? Add the missing FAQ.
- Did pricing change? Update KB FAQs.
- Did a new product/service launch? Add the relevant FAQs.

### Performance optimization opportunities
- Email open rate < 30% → subject lines need work
- Cart recovery rate < 10% → discount needs to be stronger or workflow timing wrong
- Service booking inquiries dropping → marketing message stale
- Social engagement flat → content cadence or format needs change

---

## Section 5 — Event Operations

For each in-person event (Russell Center, future game nights):

### Pre-event (2 weeks out)
- [ ] Build event funnel page (per [`landing-pages/05-events-template.md`](../landing-pages/05-events-template.md))
- [ ] Add event option to "Event Selection" custom field
- [ ] Add event tag (`event-{slug}`)
- [ ] Schedule 7-day-out email (per Workflow 4)
- [ ] Schedule 1-day-out email + SMS
- [ ] Schedule day-of morning SMS
- [ ] Schedule post-event thank-you (day +1)
- [ ] Schedule review request (day +7)
- [ ] Confirm AGN photo wall QR codes are ready (per transcript discussion)

### Day-of execution
- [ ] Arrive 1 hour early for setup (per service flow)
- [ ] QR codes positioned at entry, on tables, on screen
- [ ] Photo wall live (selfie scan → screen)
- [ ] Live stream to FB / IG / YT / TikTok via Restream
- [ ] Prizes prepped (Black-owned products per game show vision)

### Post-event (within 24 hours)
- [ ] Verify Workflow 4 fired post-event thank-you
- [ ] Tag all attendees `event-attendee`
- [ ] Post recap photos to social (use AI Studio to compose captions)
- [ ] DM the 3-5 people who lit up the room — they're potential UGC creators

### Post-event (within 7 days)
- [ ] Review the photos/videos that came in via app webhook
- [ ] Send any standout clips to the people in them (drives social shares)
- [ ] Check review request workflow fired and responses came in
- [ ] Update the events landing page with "Past Events" entry

---

## Section 6 — Crisis Management

### How to pause AI agents

**Pause Conversation AI on a single thread:**
Conversation → top toggle → "AI replies OFF". Other threads unaffected.

**Pause Conversation AI globally:**
Settings → AI Employees → Conversation AI → toggle disabled. Use only when you NEED humans to handle everything for a few hours (e.g., during a brand crisis).

**Pause Voice AI:**
Settings → Voice AI Agent → toggle disabled. Calls go to voicemail.

### How to handle a negative review

1. SMS alert hits at 478-654-9574 within 15 min of review posting
2. Open the review (link in alert)
3. Within 4 hours (1 hour for 1-star):
   - Acknowledge the specific issue
   - Apologize for the experience
   - Offer concrete fix
   - Move private: "DM us @adultgamenights or text 478-654-9574"
4. After resolution: tag the contact `complaint`, follow up directly

**Don't auto-respond to negatives — Reviews AI is configured NOT to.**

### How to reach support

- **Maurice's team:** info@byobseries.com or 404-800-1192
- **GHL platform issues:** status.gohighlevel.com (status page) — also `support@gohighlevel.com`
- **Stripe issues:** support.stripe.com (after Stripe is connected)
- **Twilio / phone issues:** routed through CreateOS support

### How to recover from data import errors

If a CSV import created duplicates or wrong tags:
1. Filter contacts by the bad import (e.g., `klaviyo-import` tag added in last 24h)
2. Bulk delete OR bulk re-tag
3. Re-export clean from source
4. Re-import correctly

If you accidentally deleted a contact, GHL may have a 30-day soft-delete recovery window. Email Maurice immediately.

---

## Section 7 — Growth Roadmap

### 30-day milestones (post-launch)
- [ ] All Track B UI work complete (pipelines, forms, workflows, AI agents)
- [ ] Voice samples + FAQs delivered → Pass 2 personality refresh executed
- [ ] First 100 contacts imported and engaging
- [ ] Russell Center event executed end-to-end
- [ ] First 3-5 customer reviews captured
- [ ] First sponsor signed (or first sponsorship pitch sent)

### 60-day milestones
- [ ] App developer integration live (webhook capturing players)
- [ ] Stripe connected, first $1K revenue tracked
- [ ] Cart abandonment recovery rate >15%
- [ ] Email list grown 3x (from imports + new sign-ups)
- [ ] Smoking Section pre-orders open (bundle strategy)
- [ ] Daily/weekly/monthly reports flowing
- [ ] First Loom training videos recorded and shared

### 90-day milestones
- [ ] Game show pilot episode shot
- [ ] 10+ active sponsors signed
- [ ] First $5K revenue month
- [ ] System running without daily Maurice involvement
- [ ] Thomas using AI Studio to draft his own content
- [ ] Wholesale partnership with at least 1 retailer

### Scaling triggers (when to upgrade)
- **Contacts > 25K** → may need GHL Scale tier ($797/mo)
- **Daily AI conversations > 200** → audit AI usage limits
- **Send volume > 10K emails/day** → upgrade Mailgun / move to dedicated IP
- **Phone calls > 100/day** → consider AI Voice Agent SLA upgrade
- **Team > 3 people** → set up role-based permissions, audit logs

### Feature additions to consider (post-90-days)
- **Memberships product**: launch the Premium app subscription ($0.99/mo) as a real GHL membership
- **Affiliate dashboard**: surface creator referral commissions in real-time
- **Sponsor dashboard**: sponsors see episode views, product placement counts, ROI
- **Multi-language**: Spanish version for Atlanta market expansion
- **Predictive churn**: tag contacts likely to lapse before they do

---

## Quick reference card

| Need to do this | Open this |
|---|---|
| Daily check-in | Dashboard |
| Find a customer | Contacts → search |
| Move someone in pipeline | Opportunities |
| Respond to escalation | Conversations → filter `escalate-to-thomas` |
| Update an FAQ | AI / Knowledge Bases → Adult Game Nights Master KB |
| Schedule a post | Marketing → Social Planner → Drafts |
| Send a campaign | Marketing → Emails → New Campaign |
| Update a workflow | Automations → Workflows |
| Add an event | Sites → Funnels → duplicate event template |
| Reconnect a social | Settings → Integrations → Social Planner |
| Run health check | `node scripts/21-integration-health-check.js` |
| Pass 2 refresh | `node scripts/16-refresh-agent-personality.js` |

---

**Treat this as a living doc. As Thomas's business grows, sections 5-7 evolve. Maurice updates quarterly.**
