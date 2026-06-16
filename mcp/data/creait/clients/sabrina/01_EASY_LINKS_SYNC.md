# Easy Links Sync — Technical Spec

## Why This Exists

Sabrina cannot drop Easy Links. Hartford + multiple A-rated carriers vetted her CRM there and her wholesalers (RPS, Holshire, Veracity, Vintage) require it. She pays $540/mo base for it with a locked contract (just renewed April 2026 — runs through April 2027).

**Our job:** Make GHL the operational CRM (marketing, nurture, AI agents, pipeline, client portal) and Easy Links the compliance system of record for basic contact info + bound policy docs.

## Integration Path (in priority order)

### Path A — Direct Easy Links API
- Confirm during onboarding whether Easy Links exposes REST/webhook endpoints
- Auth: API key via Easy Links support
- Endpoints needed:
  - `POST /contacts` — create
  - `PATCH /contacts/{id}` — update
  - `GET /contacts/{id}` — verify
- Rate limits: confirm with Easy Links (assume 60 req/min baseline)

### Path B — Zapier (Sabrina already has subscription)
- GHL webhook → Zapier → Easy Links "Connect" integration (if Zapier lists Easy Links)
- **Note from call:** Sabrina said Easy Links integrates with Zapier
- Setup:
  1. In GHL workflow, add "Webhook" action → Zapier URL
  2. In Zapier, create Zap: "Webhook Trigger → Easy Links Create/Update Contact"
  3. Map fields (see Synced Fields below)
- Cost: negligible on her existing Zapier plan for expected volume (~50–200 ops/month)

### Path C — CSV Export / Import (fallback)
- Nightly automated CSV export from GHL (via scheduled workflow → Google Sheets → downloadable CSV)
- Weekly manual import into Easy Links by Sabrina (5 min)
- Last-resort if API and Zapier fail

## Synced Fields (basic only)

| GHL Field | Easy Links Field | Notes |
|---|---|---|
| First Name | First Name | |
| Last Name | Last Name | |
| Email | Email | Primary match key |
| Phone | Mobile | |
| Business Legal Name | Company | |
| Business Phone | Work Phone | |
| Business Address Line 1+2 | Address | Concatenated |
| Business City | City | |
| Business State | State | |
| Business ZIP | Zip | |
| Primary Product Interest | Custom field "Product Interest" | |
| Lead Source | Custom field "Source" | |

## Fields That DO NOT Sync

- SSN, Driver's License, EIN (encrypted fields only in Easy Links — stay there)
- Marketing activity / email history
- Pipeline stages (different structure)
- Tags
- AI agent transcripts
- Notes (too voluminous; summarized in monthly export instead)

## Sync Direction

- **GHL → Easy Links:** one-way for contact create/update (GHL is source of truth for contact info)
- **Easy Links → GHL:** one-way for policy-bound status (monthly manual review — Sabrina tags clients `stage:client-active` in GHL based on what's bound in Easy Links)

## Error Handling

- Retry 3x with exponential backoff (30s, 2m, 10m)
- After 3 fails → create task for Sabrina + log to error channel
- Weekly automated audit: count contacts in GHL vs Easy Links, flag discrepancies > 5%

## Cutover / Initial Sync

At go-live:
1. Export current Easy Links contact list to CSV
2. Import to GHL (map fields)
3. Tag all imported contacts `stage:client-active` or `stage:warm-lead` per Sabrina's review
4. For each imported contact, store Easy Links Contact ID to enable bi-directional updates going forward
