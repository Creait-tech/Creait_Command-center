# Phase 7 — Dashboard Spec

**Goal:** Single-pane-of-glass for Thomas. Open CreateOS in the morning, see the state of the business in 30 seconds, decide what to do.

**Build path:** CreateOS → Dashboard → + Custom Dashboard. CreateOS dashboards are widget-based; you drag tiles in from a library, configure each. **No API for dashboard creation** (verified via Phase 6 probe — no `/dashboards` endpoint exposed). This is a UI-only build, but the spec below is paste-ready.

---

## Design principle

Three rows, top to bottom, in priority order:

1. **TODAY** — what needs Thomas's attention right now (escalations, day-of services, active orders)
2. **THIS WEEK** — pipeline movement, leads, scheduled events
3. **TRENDS** — month-over-month metrics, audience growth, top traffic sources

Color-code the top row red/yellow/green so Thomas can read it from across the room.

---

## Row 1 — TODAY (top of dashboard)

### Tile 1.1 — Escalations needing response (KPI tile, red if > 0)
- **Source:** Conversations with tag `escalate-to-thomas`, status open
- **Display:** Big number — count of open escalations
- **Click-through:** Conversations tab filtered to that tag
- **Why:** This is the only thing that can't wait. AI escalated for a reason.

### Tile 1.2 — Today's services (list tile)
- **Source:** Calendar 1 (Game Night Service Booking) appointments where date = today
- **Columns:** Customer name, time, package, address
- **Click-through:** Calendar event detail
- **Why:** Day-of execution. Thomas needs the address and time at a glance.

### Tile 1.3 — Open orders not yet shipped (list tile)
- **Source:** Shopify orders with status "paid" but no fulfillment (once Shopify webhook is connected)
- **Columns:** Order #, customer, total, days since order
- **Click-through:** Order detail in CreateOS or Shopify
- **Why:** Reduces shipment lag.

### Tile 1.4 — Negative reviews unanswered (KPI tile, yellow if > 0)
- **Source:** Reviews ≤3 stars, status "no response"
- **Click-through:** Review detail
- **Why:** Reviews AI alerts but doesn't auto-respond to negatives — Thomas handles personally within 4 hours.

---

## Row 2 — THIS WEEK

### Tile 2.1 — Pipeline funnel (funnel tile)
- **Source:** "Game Sales (E-commerce)" pipeline (once built in UI)
- **Stages:** Cold Lead → Visited Site → Cart Abandoned → Purchased → App Downloaded → Repeat Buyer → 3D Kit Buyer
- **Display:** Funnel chart with counts per stage
- **Why:** Shows conversion bottleneck week to week.

### Tile 2.2 — Service bookings this week (list tile)
- **Source:** Calendar 1 appointments, current week (Mon-Sun)
- **Columns:** Day, customer, package, status
- **Why:** Quick glance at the week's prep load.

### Tile 2.3 — New leads by source (bar chart)
- **Source:** Contacts created in last 7 days, grouped by source tag (`source-shopify`, `source-event`, `source-app-lobby`, `source-dm-instagram`, `source-website-form`, etc.)
- **Y-axis:** Count
- **X-axis:** Source tag
- **Why:** Shows which channels are working.

### Tile 2.4 — Cart recovery rate (KPI tile)
- **Source:** Contacts tagged `recovered-cart` ÷ contacts tagged `cart-abandoned` in the last 7 days
- **Display:** Percentage
- **Color:** Green > 15%, yellow 5-15%, red < 5%
- **Why:** Direct measure of Workflow 1's effectiveness.

### Tile 2.5 — Sponsor pipeline (kanban tile)
- **Source:** "Sponsorship/B2B" pipeline (once built)
- **Display:** Card view, stage columns
- **Why:** Sponsorship is high-ticket B2B — small number of conversations matter a lot.

### Tile 2.6 — Upcoming events (list tile)
- **Source:** Contacts in "Event Attendees" pipeline → Registered, grouped by event tag (e.g. `event-russell-center-july-3`)
- **Columns:** Event, date, registered count, capacity (if known)
- **Why:** Capacity planning.

---

## Row 3 — TRENDS

### Tile 3.1 — Revenue this month vs last month (KPI tile)
- **Source:** Stripe payouts via `/payments/orders` (once Stripe is connected)
- **Display:** Current month total + Δ vs prior month
- **Why:** Single most important number for a small business.

### Tile 3.2 — Top performing email (list tile)
- **Source:** Email campaigns sent in last 30 days, sorted by open rate
- **Columns:** Subject, open rate, click rate, sent count
- **Why:** Tells Thomas which voice/topic resonates.

### Tile 3.3 — Social engagement (line chart)
- **Source:** Social Planner analytics (Facebook + Instagram + TikTok)
- **Y-axis:** Engagement (likes + comments + shares)
- **X-axis:** Day, last 30 days
- **Series:** One line per platform
- **Why:** Track content traction.

### Tile 3.4 — Reviews summary (KPI tile)
- **Source:** Google + Facebook reviews, last 30 days
- **Display:** Avg rating + count + Δ vs prior 30 days
- **Click-through:** Reviews tab
- **Why:** Reputation drift — catch decline early.

### Tile 3.5 — Lifetime customer value (KPI tile)
- **Source:** Avg of `Lifetime Order Value` custom field across `buyer`-tagged contacts
- **Display:** $ value
- **Why:** Long-term unit economics.

### Tile 3.6 — Knowledge Base usage (KPI tile, if available)
- **Source:** AI agent KB lookup count — Voice AI + Conversation AI combined
- **Display:** Count of KB-served responses, last 30 days
- **Why:** Validates AI agents are actually doing work (not just sitting there).

---

## Mobile dashboard

Thomas runs the business on his phone. CreateOS mobile app surfaces a subset of dashboard tiles. Configure these for mobile:

- Tile 1.1 (Escalations)
- Tile 1.2 (Today's services)
- Tile 1.4 (Negative reviews)
- Tile 2.4 (Cart recovery rate)
- Tile 3.1 (Revenue MoM)

Five tiles. Mobile users glance, decide, act.

---

## Build process

In CreateOS:

1. Dashboard → + Custom Dashboard → Name: **"Thomas's Daily View"**
2. For each tile above, drag the matching widget type from the Widget Library
3. Configure data source per the **Source** field in this spec
4. Set color thresholds where specified
5. Save

**Time estimate:** 60-90 min for the full 15 tiles.

## Tile dependencies

Some tiles need upstream work to populate with data:

| Tile | Depends on |
|---|---|
| 1.3 — Orders not shipped | Shopify webhook connected, Phase 6 |
| 2.1 — Pipeline funnel | Pipelines built (Phase 1 retry) |
| 2.5 — Sponsor pipeline | Pipelines built |
| 3.1 — Revenue MoM | Stripe connected, Phase 6 |
| 3.2 — Top email | At least 1 email campaign sent |
| 3.4 — Reviews | GMB connected, Phase 6 |
| 3.6 — KB usage | Voice + Conversation AI built and processing volume |

Minimum-viable dashboard before any Phase 6 OAuth happens: tiles 1.1, 1.2, 1.4, 2.2, 2.3, 2.6 — six tiles, all from data already in the system.

---

## Refresh cadence

CreateOS dashboards typically refresh every 15 minutes by default. For tiles 1.1 and 1.4 (escalations + negative reviews), set to **5 min** or real-time if available — those are the response-time-critical ones.
