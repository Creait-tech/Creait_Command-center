# Architecture — Franklin Insurance Solutions on GHL

## System Map

```
  ┌──────────────────────────────────────────────────────────────┐
  │                  PUBLIC / MARKETING LAYER                    │
  │                                                              │
  │  Wix Site  │  Social (IG/FB/LI/TT)  │  Google + ChatGPT SEO  │
  │     │             │                          │               │
  └─────┼─────────────┼──────────────────────────┼───────────────┘
        │             │                          │
        ▼             ▼                          ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                     GHL INTAKE SURFACES                      │
  │                                                              │
  │   Cyber Form   Pro-Liab Form   Surety Form   Gen'l Contact   │
  │   Booking Calendar (round-robin ready)                       │
  │   Web Chat Widget → AI Agent                                 │
  │   Inbound Phone → AI Voice Agent                             │
  │   IG/FB/WhatsApp DMs → AI Agent                              │
  │   Business Card Photo Upload → AI Extraction                 │
  └───────────────────────────┬──────────────────────────────────┘
                              │
                              ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                GHL CONTACT RECORD (source of truth)          │
  │                                                              │
  │   • Custom fields (see Schema doc)                           │
  │   • Tags: product interest, source, lifecycle, compliance    │
  │   • Timeline: every email/SMS/call/DM in one thread          │
  └───────┬───────────────────────────────────────────┬──────────┘
          │                                           │
          ▼                                           ▼
  ┌───────────────────────────┐       ┌──────────────────────────┐
  │    AUTOMATION ENGINE      │       │   OUTBOUND COMPLIANCE    │
  │                           │       │                          │
  │  • Lead-stage pipelines   │       │  Easy Links sync         │
  │  • Nurture sequences      │       │  (basic contact fields   │
  │  • Quote follow-up        │       │   only — SSN/DL stay     │
  │  • Cross-sell             │       │   in Easy Links)         │
  │  • Newsletter             │       │                          │
  │  • Reputation requests    │       │  A2P 10DLC + marketing   │
  │  • Reply-stop guardrail   │       │  label on every blast    │
  └───────────┬───────────────┘       └──────────────────────────┘
              │
              ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                   FULFILLMENT (manual + link)                │
  │                                                              │
  │   Cyber        → Sabrina → ProWriters (manual)               │
  │   Pro-Liab     → Direct carrier referral link (automated)    │
  │   Surety Bond  → Direct quoting link (automated)             │
  │   Commercial   → Wholesaler (RPS/Holshire/Veracity/Vintage)  │
  └──────────────────────────────────────────────────────────────┘
```

## Data Flow — The Three Critical Journeys

### Journey A: Cyber Insurance Lead (semi-automated)

1. Prospect hits Cyber Intake Form (Wix-embedded or GHL-hosted page)
2. Form submit → GHL Contact created, tag `cyber-lead`, pipeline = *Cyber — New Lead*
3. Instant email: "Thanks, we received your details." Booking link included.
4. SMS 10 min later: "Hey {first_name}, it's Sabrina at Franklin Insurance..."
5. Easy Links sync fires (basic fields only)
6. Internal notification to Sabrina: full form data in GHL + email copy
7. Sabrina manually inputs into ProWriters, pulls quote
8. Sabrina attaches quote PDF → moves pipeline to *Quoted*
9. Workflow "Quote Sent" fires → email with quote + 3-touch follow-up over 7 days
10. Client clicks "Accept" link → pipeline moves to *Bound*
11. Post-bind workflow: welcome, asks for Google review, starts annual renewal reminder (11-month check-in)

### Journey B: Professional Liability (fully automated)

1. Prospect hits Pro-Liab Form (or clicks ad)
2. Form captures contact info → GHL Contact + tag `pro-liab-lead`
3. **Redirect page** after submit = carrier's direct referral link (prospect lands there having already been captured by us)
4. Instant email + SMS confirming receipt, explaining the carrier link they're seeing
5. Daily check: has the carrier-side policy been bound? (Sabrina flags via quick SMS reply "bound {name}" → workflow auto-moves pipeline)
6. If not bound in 48 hours → nurture sequence kicks off
7. If bound → post-bind workflow (same as above)

### Journey C: Surety Bond (fully automated)

Same pattern as Journey B. Direct quoting link for home health / DME / Medicare-Medicaid contractors.

## Why Easy Links Stays

- **Hartford, RPS, Holshire, Veracity, Vintage** all vet CRM security; dropping Easy Links would lose carrier appointments already earned
- **Insurance-specific forms** (ACORD, etc.) live there and she pays $99/seat if she wants them separately
- **5-year/10-year retention** is built-in for insurance docs
- **After April 2027**, re-evaluate if GHL + a point solution can replace it

## Why GHL Wins for the Rest

- **One inbox** (email, SMS, IG DM, WhatsApp, web chat, phone transcripts) — kills her hated "email threads"
- **AI voice agent + AI chat agent** — handles after-hours inbound while she sleeps
- **Calendar replaces Calendly** — built in, round-robin ready for future producers
- **Social scheduler** — post once to IG/FB/LI/TT/YT
- **Newsletter** — tagged segments (cyber-interested vs pro-liab-interested vs bond)
- **Reputation** — Google review auto-ask after bind
- **Document signing** — replaces her need for a separate e-sign tool
- **Client portal (AI-built)** — clients log in to see insurance cards, docs, pay invoices
- **Business card scan → CRM → drip** — replaces what Blink *could* do but she hasn't wired up

## Guardrails Sabrina Explicitly Asked For

1. **"I don't want to be a nuisance."** — Every sequence has a hard reply-stop and a 7-day minimum gap between SMS blasts to the same contact.
2. **"What if they reply, 'I already responded'?"** — Reply on any channel (email, SMS, DM) stops ALL active sequences for that contact. One-click resume.
3. **Marketing label** — every marketing-class message carries the footer disclosure + unsubscribe. Transactional messages are tagged `non-marketing` and exempt.
4. **No silent auto-send** — Sabrina gets a daily digest of what went out in her name.
5. **Compliance archive** — all outbound is logged in GHL (5-yr retention native) and mirrored to a dedicated Google Drive folder via weekly export for 10-yr retention on Medicare/Medicaid records.
