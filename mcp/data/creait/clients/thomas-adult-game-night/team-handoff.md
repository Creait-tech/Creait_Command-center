# Team Handoff Document

**Audience:** Maurice's team at CREAIT, future Adult Game Nights staff hires.
**Goal:** Anyone joining can get up to speed in 30 minutes and operate the system without breaking it.

---

## Who's who

| Role | Person | Contact |
|---|---|---|
| Business owner | Thomas Gray | thomas@adultgamenights.com / 478-654-9574 |
| CRM build owner | Maurice "Reece" Grant | info@byobseries.com / 404-800-1192 |
| Build framework | CREAIT (CreateOS white-label of GoHighLevel) | get.createos.com |
| App developer | TBD — Thomas to introduce | (waiting on intro) |

---

## Login credentials structure

**Where credentials live:**
- All shared credentials in 1Password vault "Adult Game Nights — CRM" (Maurice manages)
- Personal credentials (Thomas's social accounts) stay with Thomas
- API tokens (PIT) checked into `/Users/reecebyob/adult-game-nights-build/.env` — gitignored, never committed

**Token rotation schedule:**
- GHL Private Integration Token (PIT): rotate every 90 days OR if a team member leaves
- Stripe API key (post-connect): rotate every 90 days
- Social OAuth: re-auth per platform expiry (YouTube ~30 days, Meta ~60 days, TikTok ~365 days)
- App webhook URL: rotate after any incident, otherwise stable

---

## Permission tiers (CreateOS)

When team grows, set up role-based permissions:

| Tier | Who | What they can do |
|---|---|---|
| **Admin** | Thomas, Maurice | Everything: settings, integrations, billing, delete data |
| **Manager** | Future ops manager | Contacts, conversations, opportunities, calendars, reports — no settings |
| **Staff** | Future event staff | Contacts (read+update), conversations (read+respond), check-in actions only |
| **Read-only** | Sponsors who request data access | Reports + their own pipeline only |

Configure under **Settings → My Staff → Roles**.

---

## Onboarding checklist for a new team member

When you bring someone onto the system:

- [ ] Day 1: Add user via Settings → My Staff → Add User. Pick role tier above.
- [ ] Day 1: Share `crm.adultgamenights.com` login URL.
- [ ] Day 1: Add to 1Password vault (just the credentials they need for their tier).
- [ ] Day 1: Have them watch Loom videos 01 + 02 (welcome + dashboard).
- [ ] Day 2: Walk through their first 3 daily check-ins together (15 min/day).
- [ ] Week 1: Read [`docs/operations-manual.md`](operations-manual.md) end-to-end.
- [ ] Week 1: Read [`docs/adult-game-nights-sop.md`](adult-game-nights-sop.md).
- [ ] Week 1: Watch all 10 Loom videos (`docs/loom-scripts/` — one per day).
- [ ] Week 2: They handle their first escalation under supervision.
- [ ] Week 2: They handle their first negative review under supervision.
- [ ] Week 4: Sign-off — they can run a full day without escalating to Thomas/Maurice.

---

## Architecture diagram

```
                    ┌───────────────────────────────────────┐
                    │         Thomas Gray (Owner)           │
                    │   • Brand, content, hosting           │
                    │   • Strategic decisions               │
                    │   • Sponsor + wholesale negotiations  │
                    └───────────────┬───────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────────────┐
                    │   CreateOS / GoHighLevel              │
                    │   PIT scope: location-level CRUD      │
                    └─┬───────────────────────────────────┬─┘
                      │                                   │
        ┌─────────────┼───────────────┐    ┌──────────────┼─────────────┐
        ▼             ▼               ▼    ▼              ▼             ▼
   ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ Shopify │  │ Stripe   │  │ Mailgun  │  │ Twilio   │  │ Google   │  │ Social   │
   │ (live)  │  │ (TBD)    │  │ (TBD)    │  │ (default)│  │ Workspace│  │ FB/IG/TT │
   │         │  │          │  │          │  │          │  │ (TBD)    │  │ /YT      │
   └─────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
                                                          ┌─────────────────────────┐
                                                          │ Thomas's Game App       │
                                                          │ (custom, dev TBD)       │
                                                          │ Webhook → Workflow 5    │
                                                          └─────────────────────────┘
```

---

## API key management

**The PIT (Private Integration Token):**
- Token: stored in `.env` under `GHL_API_KEY`
- Scopes: location-level only (cannot create pipelines, forms, AI agents — UI required for those)
- Rotation: 90 days, OR after team turnover
- Revocation: Settings → API Keys → revoke. Existing scripts will 401 immediately — re-issue and update `.env`.

**Webhook URLs:**
- Workflow 5 inbound webhook: shared with Thomas's app developer
- Shopify → CreateOS webhook: configured in Shopify admin
- Stripe → CreateOS webhook: auto-configured by CreateOS Stripe integration

---

## Backup procedures

### Weekly automated backups
- All build configs, scripts, docs are version-controlled in this repo (`/Users/reecebyob/adult-game-nights-build/`)
- Maurice should `git init` this directory + push to a private GitHub repo (recommended next step — currently local-only)
- CRM data backups handled by GHL platform (rolling 30-day window)

### Manual exports (recommended monthly)
1. Contacts CSV: Contacts → Export → All
2. Opportunities CSV: Opportunities → Export → All pipelines
3. Email template HTML: already in `/email-templates/*.html`
4. KB FAQs: re-run `node scripts/13-create-knowledge-base.js` after exporting current state
5. Save all to a Google Drive folder "AGN Monthly Backups / YYYY-MM"

### Disaster recovery
If CreateOS account is compromised or accidentally deleted:
1. Maurice spins up fresh location
2. Re-runs all scripts in order (`scripts/00` through `scripts/21`)
3. Maurice rebuilds Track B items in UI (pipelines, forms, workflows, AI agents)
4. Imports last monthly contact CSV
5. Total recovery time: 4-6 hours from a clean account

---

## Emergency contacts

| Issue | First contact | Fallback |
|---|---|---|
| AI agent saying something dangerous/wrong | Maurice (urgent) | Pause AI globally + investigate |
| Customer payment dispute | Stripe support | Maurice + Thomas |
| Negative press / PR crisis | Thomas direct | Maurice for system-side response (pause AI, draft reply) |
| Data breach concern | Maurice immediately | Notify Thomas, change PIT + all OAuth tokens |
| GHL platform outage | status.gohighlevel.com | Wait it out — no DIY fix |
| Domain / DNS issue | GoDaddy support | Maurice |
| Shopify store issue | Shopify support | Maurice |

---

## Communication norms

- **Slack/Discord:** TBD when team grows past 2 people. For now, email + SMS.
- **Daily ops decisions:** Thomas decides, Maurice supports
- **Strategic decisions** (new pipelines, major workflow changes, pricing changes): joint Thomas + Maurice
- **Tactical decisions** (KB FAQ updates, copy tweaks, schedule shifts): whoever's available
- **Critical issues:** SMS Maurice at 404-800-1192 — get a response within 1 hour

---

## What this team handoff doc enables

In 30 minutes, a new team member can:
- Know who to call for what
- Know where credentials live
- Know their permission tier
- Have the architecture in their head
- Know the backup/recovery posture
- Know the emergency escalation path

After 30 days, they should be largely autonomous on daily ops. After 90 days, they should be running their own initiatives.

---

**Maintainer note:** Update this doc when:
- Team composition changes (new hires, departures)
- Permission tiers shift
- New integrations come online (especially when OAuth credentials need new owners)
- Token rotation schedule changes
