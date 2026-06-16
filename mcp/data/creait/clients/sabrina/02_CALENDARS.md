# Calendars

Configured in **Calendars → Calendar Settings**. Replaces Sabrina's Calendly.

## Calendar 1: Discovery Call (Cyber)

- **Name:** Cyber Insurance Discovery Call — 20 min
- **Duration:** 20 minutes
- **Buffer before/after:** 5 min
- **Availability:** Mon–Fri, 10 AM – 4 PM CT (Sabrina's commercial hours); Tue/Wed/Thu evenings 7–9 PM CT for after-hours
- **Form attached:** Quick prep (asks Business Name, top concern in 1 line)
- **Confirmation email:** Includes agenda — "We'll talk through your cyber exposure, what coverage would look like, and pricing. Expect a number by the end of the call."
- **Reminder cadence:** 24 hr email + 1 hr SMS

## Calendar 2: Discovery Call (Pro-Liab)

Same structure, pro-liab-focused prep questions.

## Calendar 3: Discovery Call (Surety Bond)

- **Duration:** 15 min (surety is faster, often just a timing/docs conversation)
- Same availability

## Calendar 4: Renewal Review (existing clients)

- **Duration:** 30 minutes
- **Description:** "We'll review your current policy, talk about anything that's changed in your business, and I'll share 2–3 renewal options."
- **Availability:** Same commercial hours
- **Reminder cadence:** 24 hr email + 1 hr SMS

## Calendar 5: New Client Onboarding (post-bind)

- **Duration:** 15 minutes
- **Description:** "Quick call to confirm you have everything you need from your new policy and answer any questions."
- **Offered automatically** in the W08 welcome email

## Team / Round-Robin (future-ready)

- When Sabrina hires producers, configure each calendar as round-robin
- Settings: Distribute evenly, skip unavailable, fall back to Sabrina if all unavailable

## Calendar → Workflow Triggers

| Event | Trigger |
|---|---|
| Call booked | Apply tag `stage:contacted`, move opp to Contacted |
| Call no-show | Apply tag `flag:no-show`, send gentle "missed you — want to rebook?" |
| Call completed | Create task "Log call outcome" for Sabrina; send her a 1-click pipeline move link |
| Call canceled by client | Apply tag `flag:cancelled-last-call`; after 2 cancellations, require pre-payment / deposit |
