# Pipelines (Opportunities)

Four pipelines. Keep them separate so reporting and automation stay clean.

## Pipeline 1: Cyber Insurance

| Stage | Auto Entry Trigger | Auto Exit / Move Trigger |
|---|---|---|
| New Lead | Cyber form submitted OR tag `product:cyber` applied | Sabrina logs a call / sends first email |
| Contacted | First outbound comm logged | Quote attached to opportunity |
| Quoted | Quote PDF uploaded to opportunity | "Bind Date" custom field populated |
| Bound | Bind Date populated | Always terminal until renewal |
| Lost | Manual move OR Decline Reason set | Terminal (moves to `stage:dormant` after 90 days, re-enters nurture) |

## Pipeline 2: Professional Liability

Same stage names as Cyber. Trigger: Pro-Liab form submitted OR tag `product:pro-liab`.

Note: for direct-link carriers (the beautician/salon flow), "Bound" is confirmed by Sabrina manually replying "bound {contact}" via SMS (parsed by workflow) or clicking a quick-action link in her daily digest.

## Pipeline 3: Surety Bonds

Same stage names. Trigger: Surety form OR tag `product:surety`.

Extra stage:
- **Credit Check** (between Contacted and Quoted) — because surety underwriting leans on credit

## Pipeline 4: Cross-Sell / Renewal

| Stage | Purpose |
|---|---|
| Upcoming Renewal (90d) | Policy expiration in 60–90 days |
| Upcoming Renewal (30d) | Policy expiration in ≤30 days |
| Cross-Sell Eligible | Client has one product, likely candidate for second (e.g., has pro-liab but no cyber) |
| Cross-Sell In Progress | Active cross-sell outreach |
| Won | New policy bound |

## Commercial GL + Workers Comp

Explicitly **NOT** getting their own pipeline in the initial build. Sabrina is moving away from this. Tracked only with tags on the contact and managed in Easy Links for existing clients.

## Dashboard Views (Sabrina's home screen)

1. **Cyber — This Week** — leads + quoted + bound, with premium total
2. **Pro-Liab — This Week** — same
3. **Surety — This Week** — same
4. **Renewals 60–90 Days** — single glance
5. **Conversations Needing Reply** — inbox filter for contacts where last message is inbound + unread
6. **Quotes Aging** — opportunities in Quoted stage >3 days with no follow-up
