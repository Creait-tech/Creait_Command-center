# W20 — Easy Links Sync (Outbound Webhook)

**Trigger:** Contact created OR Contact updated (on a filtered set of fields)

**Why:** Sabrina has a $540/mo locked contract on Easy Links that also hosts insurance-specific forms and bound policy records. We mirror the basic contact record so nothing is lost and carriers who audit see her CRM of record.

## Synced Fields (basic only — NO SSN, DL, or sensitive PII)
- First Name, Last Name
- Email
- Phone
- Business Legal Name
- Business Phone
- Business Address
- Primary Product Interest
- Lead Source

## Method
- Preferred: Easy Links REST API (check auth method during onboarding call)
- Fallback: Zapier (Sabrina already has subscription) — GHL webhook → Zapier → Easy Links
- Fallback 2: If Easy Links has no API: nightly CSV export from GHL → dropbox → Easy Links import (manual weekly)

## Steps
1. On trigger, check if contact has `Easy Links Contact ID`
2. If yes → PATCH update to Easy Links
3. If no → POST create in Easy Links → store returned ID in `Easy Links Contact ID`
4. Update `Last Synced to Easy Links` = NOW
5. If sync fails → log error, retry 3x with exponential backoff, then create task for Sabrina

## What Does NOT Sync to Easy Links
- Marketing activity (email/SMS history)
- Pipeline stages
- Social interactions
- AI agent conversations

**Those stay in GHL.** Easy Links is the contact-of-record for carrier compliance; GHL is the operating system.

---

# W22 — AI Voice Call Post-Call

**Trigger:** AI voice agent handles an inbound call

## AI Agent Setup
- Platform: GHL AI Employee (voice)
- Phone number: Sabrina's forwarded number (rings Sabrina 3x → if no answer, routes to AI)
- Persona: *Confident, warm, professional, educational-first. Never pushy. Mirrors Sabrina's brand voice — modern, approachable, knowledgeable about business insurance. Says "Franklin Insurance Solutions" on pickup.*
- Job:
  1. Greet and ask reason for call (quote / claim / existing client question / other)
  2. Capture: name, business name, phone, email, product of interest
  3. If quote request: qualify with 3–5 product-specific questions
  4. Book appointment on Sabrina's calendar if caller wants to talk to human
  5. Send follow-up: SMS with booking confirmation + email with resource for the product

## Post-Call Workflow
1. Transcript attached to contact record
2. Apply tags based on qualified product interest
3. If opportunity worth > $2000 estimated premium → SMS Sabrina right away (high-value leads get her attention)
4. Otherwise → included in next daily digest
5. Enter appropriate nurture sequence based on captured product interest

---

# W23 — AI Chat / DM Post-Conversation

**Trigger:** AI agent handles web chat widget, IG DM, FB Messenger, or WhatsApp

## Same persona as voice agent. Handles text-based inquiries.

## Job
1. Identify whether this is a new prospect or existing client (check CRM)
2. For new prospects: qualify product interest, collect contact info, book or push to form
3. For existing clients: answer common Qs (policy details, claim contact info, renewal timing) or escalate to Sabrina
4. Never quote prices (always route to Sabrina or to the intake form)

## Post-Convo
- Save full transcript to contact
- Apply tags based on conversation
- If qualified → create opportunity + start appropriate nurture
- If escalation needed → create task for Sabrina + send SMS alert if urgent

---

# W21 — Compliance Archive (Weekly)

**Trigger:** Schedule — Sunday 11:00 PM CT

## Steps
1. Query all contacts with `compliance:medicare-medicaid` updated in last 7 days
2. Export all associated comms (emails, SMS transcripts, call recordings, notes) to PDF/CSV
3. Upload to dedicated Google Drive folder (Sabrina owns): `Franklin Insurance — 10yr Archive / {{year}} / {{week}}`
4. Set folder retention label (via Drive API or manual) to 10 years
5. Email Sabrina: "Weekly compliance archive complete. {{count}} records archived. Folder: {{link}}"

**Why this matters:** GHL default retention is sufficient for 5-yr standard insurance, but belt-and-suspenders for the 10-yr Medicare/Medicaid rule.
