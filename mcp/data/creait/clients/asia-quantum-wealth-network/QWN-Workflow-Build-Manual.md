# QWN Workflow Build Manual
## Complete GHL Automation Build Guide — All 9 Workflows
**Location ID**: sTlvUPTx6xuouNAJ2JvA | **Date**: 2026-04-21
**Prepared by**: CREAIT (Maurice/Reece) for Asia K.

> Build all workflows in: **Automation > Workflows**
> All 4 existing drafts already named correctly — open each and wire the steps below.
> Publish each workflow AFTER wiring + testing with a test contact.

---

## PRE-BUILD CHECKLIST

Before building workflows, confirm these are live:
- [x] Pipeline: "QW Founder Journey" with 6 stages (Stage 0–5) — CONFIRMED LIVE
- [x] 26 custom fields created — CONFIRMED LIVE
- [x] 20 tags created — CONFIRMED LIVE (April 21)
- [ ] 8 email templates created (PC-01 through GRAD-01) — DO THIS FIRST
- [ ] Sending domain verified in Settings > Email Services
- [ ] Calendar for kickoff calls created in Calendars
- [ ] Asia's phone number connected for SMS sending

---

## WORKFLOW 1: QW Founder Warm Lead Nurture
**GHL ID**: 489c3f46-02ef-4f2e-8b0e-72d865e5415b (currently DRAFT)
**Status**: Exists as draft — wire steps below

### Trigger
- Type: **Pipeline Stage Changed**
- Pipeline: QW Founder Journey
- Stage: **Warm Lead** (Stage 0)

### Steps

```
[TRIGGER: Contact enters Warm Lead stage]
    |
    v
[SEND EMAIL] → Template: "QPilot - Day 1 Welcome"
  - From: Q-Pilot | Quantum Wealth Network
  - Subject: Your rocket is sitting on the launchpad, {{contact.first_name}}.
    |
    v
[WAIT] → 2 days
    |
    v
[SEND SMS]
  Text: "Q-Pilot here — still thinking it over? Your spot is open. Book a quick call or fill 
  out the intake form whenever you're ready: {{intake_or_booking_link}}"
    |
    v
[WAIT] → 2 days
    |
    v
[SEND EMAIL] → Template: "QPilot - Day 5 Value"
  - Subject: What most business owners don't know about their own books
    |
    v
[WAIT] → 3 days
    |
    v
[SEND SMS]
  Text: "Q-Pilot checking in. Want me to send you more info about what the cleanup process 
  looks like? Just reply YES and I'll send it over."
    |
    v
[WAIT] → 4 days
    |
    v
[SEND EMAIL] → Template: "QPilot - Day 12 Urgency"
  - Subject: We only take on a limited number of new founders each month
    |
    v
[WAIT] → 2 days
    |
    v
[SEND SMS]
  Text: "No pressure — just didn't want to lose touch. We're here when you're ready. 
  {{booking_link}} — Q-Pilot"
    |
    v
[IF/ELSE] → Condition: "Contact pipeline stage is NOT Stage 0 (Warm Lead)"
    |-- YES (moved forward) → [END WORKFLOW]
    |-- NO (still in Stage 0)
              |
              v
         [ADD TAG] → nurture-complete-no-conversion
              |
              v
         [PIPELINE STAGE CHANGE] → Move to "Paused - Needs Follow-Up" (Stage 5)
```

### Communication Limits
- Max 1 email per day, max 1 SMS per day
- Send window: 9am–6pm EST (set in workflow settings)

### Exit Condition
Contact advances past Stage 0 (configure as workflow exit trigger)

---

## WORKFLOW 2: QW Engagement Letter Follow-Up
**GHL ID**: 31b1a50c-c29e-47ca-bae1-dd3d3368101b (currently DRAFT)
**Status**: Exists as draft — wire steps below

### Trigger
- Type: **Pipeline Stage Changed**
- Pipeline: QW Founder Journey
- Stage: **Pre-Onboarding (Awaiting Docs)** (Stage 1)

### Steps

```
[TRIGGER: Contact enters Pre-Onboarding stage]
    |
    v
[ADD TAG] → engagement-letter-sent
    |
    v
[SEND EMAIL] → Template: "QPilot - Engagement Sent"
  - Subject: Your Quantum Wealth engagement letter is ready, {{contact.first_name}}
    |
    v
[WAIT] → 3 days
    |
    v
[IF/ELSE] → Condition: Contact still in Stage 1?
    |-- NO (moved to Stage 2) → [END WORKFLOW]
    |-- YES (still Stage 1)
              |
              v
         [SEND SMS]
           Text: "Q-Pilot here. Your engagement letter is still waiting for your signature. 
           Once you sign, we can get your cleanup started: {{engagement_letter_link}}"
    |
    v
[WAIT] → 2 days
    |
    v
[IF/ELSE] → Condition: Contact still in Stage 1?
    |-- NO → [END WORKFLOW]
    |-- YES
              |
              v
         [SEND EMAIL] → Template: "QPilot - Engagement Reminder"
           - Subject: Quick reminder — your engagement letter is ready
    |
    v
[WAIT] → 5 days
    |
    v
[IF/ELSE] → Condition: Contact still in Stage 1?
    |-- NO → [END WORKFLOW]
    |-- YES
              |
              v
         [INTERNAL NOTIFICATION / TASK]
           - Assign to: Asia Kuykendall
           - Note: "{{contact.first_name}} hasn't signed engagement letter after 10 days. 
             Manual follow-up required."
```

---

## WORKFLOW 3: QW Document Collection
**GHL ID**: e82a7033-9e9b-4501-9097-6cab369fd8d3 (currently DRAFT)
**Status**: Exists as draft — wire steps below

### Trigger
- Type: **Pipeline Stage Changed**
- Pipeline: QW Founder Journey
- Stage: **Onboarding Kickoff (Setup/Access)** (Stage 2)

### Steps

```
[TRIGGER: Contact enters Onboarding Kickoff stage]
    |
    v
[ADD TAG] → docs-pending
    |
    v
[SEND EMAIL] → Template: "QPilot - Welcome Aboard"
  - Subject: Welcome aboard, Captain {{contact.first_name}}. Here's what we need from you.
    |
    v
[WAIT] → 3 days
    |
    v
[SEND SMS]
  Text: "Q-Pilot here — just checking in. We still need a few documents to kick off your 
  cleanup. Check your email for the checklist. Need help? Reply here."
    |
    v
[WAIT] → 4 days
    |
    v
[IF/ELSE] → Condition: Contact still in Stage 2?
    |-- NO → [END WORKFLOW]
    |-- YES
              |
              v
         [SEND EMAIL] → Template: "QPilot - Doc Reminder"
           - Subject: Still waiting on a few items, {{contact.first_name}}
    |
    v
[WAIT] → 7 days
    |
    v
[IF/ELSE] → Condition: Contact still in Stage 2?
    |-- NO → [END WORKFLOW]
    |-- YES
              |
              v
         [INTERNAL NOTIFICATION / TASK]
           - Assign to: Asia Kuykendall
           - Note: "Docs outstanding for 14 days for {{contact.first_name}}. 
             Manual outreach needed."
```

---

## WORKFLOW 4: QW Re-Engagement
**GHL ID**: 8e3076e4-d670-4d99-8337-2dad6933a974 (currently DRAFT)
**Status**: Exists as draft — wire steps below

### Trigger
- Type: **Pipeline Stage Changed**
- Pipeline: QW Founder Journey
- Stage: **Paused - Needs Follow-Up** (Stage 5)

### Steps

```
[TRIGGER: Contact enters Paused stage]
    |
    v
[ADD TAG] → paused-needs-outreach
    |
    v
[WAIT] → 1 day
    |
    v
[SEND EMAIL] → Template: "QPilot - Re-Engage Day 1"
  - Subject: {{contact.first_name}}, we noticed you've been quiet
    |
    v
[WAIT] → 4 days
    |
    v
[SEND SMS]
  Text: "Q-Pilot checking in. Haven't heard from you in a while. Just reply READY when you 
  want to pick back up. No pressure."
    |
    v
[WAIT] → 9 days
    |
    v
[SEND EMAIL] → Template: "QPilot - Re-Engage Final"
  - Subject: Last check-in from Q-Pilot
    |
    v
[WAIT] → 30 days
    |
    v
[IF/ELSE] → Condition: Contact still in Stage 5?
    |-- NO → [END WORKFLOW]
    |-- YES
              |
              v
         [ADD TAG] → inactive-archived
         [REMOVE TAG] → paused-needs-outreach
```

---

## WORKFLOW 5: QWS JumpStart — Week 1 Unlock
**Status**: NEW — create from scratch

### Trigger
- Type: **Pipeline Stage Changed**
- Pipeline: QW Founder Journey
- Stage: **Onboarding (Educational Series)** (Stage 3)

### Steps

```
[TRIGGER: Contact enters Onboarding / Educational Series stage]
    |
    v
[ADD TAG] → jumpstart-active, jumpstart-week1-active
    |
    v
[UPDATE CONTACT FIELD] → Onboarding Start Date = today's date
    |
    v
[SEND EMAIL] → Template: "W1-01 Week 1 Webinar Unlock"
  - Subject: Your first lesson is ready, Co-Pilot. Let's go.
    |
    v
[WAIT] → 7 days
    |
    v
[SEND EMAIL] → Template: "W2-01 Week 2 Webinar Unlock"
  - Subject: Week 2 is here, {{contact.first_name}}. Time to build your foundation.
    |
    v
[ADD TAG] → jumpstart-week2-active
[REMOVE TAG] → jumpstart-week1-active
    |
    v
[CREATE TASK]
  - Title: "Review {{contact.first_name}} Week 1 assignment before kickoff call"
  - Assign to: Asia Kuykendall
    |
    v
[WAIT] → 7 days (Day 14 from Stage 3)
    |
    v
[SEND EMAIL] → Template: "W3-01 Week 3 Webinar Unlock"
  - Subject: Week 3: It's time to put profit first, {{contact.first_name}}.
    |
    v
[ADD TAG] → jumpstart-week3-active
[REMOVE TAG] → jumpstart-week2-active
    |
    v
[CREATE TASK]
  - Title: "Send first financial deliverable to {{contact.first_name}}"
  - Assign to: Asia Kuykendall / LJ
    |
    v
[WAIT] → 7 days (Day 21 from Stage 3)
    |
    v
[SEND EMAIL] → Template: "W4-01 Week 4 Webinar Unlock"
  - Subject: Final week, {{contact.first_name}}. Let's talk strategy.
    |
    v
[ADD TAG] → jumpstart-week4-active
[REMOVE TAG] → jumpstart-week3-active
    |
    v
[WAIT] → 7 days (Day 28 from Stage 3)
    |
    v
[SEND EMAIL] → Template: "GRAD-01 JumpStart Graduation"
  - Subject: You did it, {{contact.first_name}}. Welcome to the Active Founder Family.
    |
    v
[ADD TAG] → jumpstart-graduate
[REMOVE TAG] → jumpstart-week4-active, jumpstart-active
    |
    v
[PIPELINE STAGE CHANGE] → Move to "Active Founder" (Stage 4)
    |
    v
[ADD TAG] → active-founder-ongoing
```

---

## WORKFLOW 6: Entry Point — Calendar Booking
**Status**: NEW — create from scratch

### Trigger
- Type: **Appointment**
- Calendar: QWN Discovery Call / Founder Discovery
- Event: **Appointment Booked**

### Steps

```
[TRIGGER: Discovery call booked]
    |
    v
[IF/ELSE] → Contact already has tag "warm-lead" or stage ≥ Stage 0?
    |-- YES → [END WORKFLOW] (already in system)
    |-- NO
              |
              v
         [ADD TAG] → warm-lead, new lead
         [PIPELINE: CREATE OPPORTUNITY]
           - Pipeline: QW Founder Journey
           - Stage: Warm Lead (Stage 0)
           - Title: {{contact.full_name}} — Discovery
```

---

## WORKFLOW 7: Entry Point — Intake Form Submission
**Status**: NEW — create from scratch
**Note**: Requires intake form to be built in GHL first (Forms > Builder)

### Trigger
- Type: **Form Submitted**
- Form: Client Intake Form

### Steps

```
[TRIGGER: Intake form submitted]
    |
    v
[ADD TAG] → warm-lead
    |
    v
[PIPELINE: CREATE OPPORTUNITY]
  - Pipeline: QW Founder Journey
  - Stage: Warm Lead (Stage 0)
  - Title: {{contact.full_name}} — Intake Form
    |
    v
[CREATE TASK]
  - Title: "Review intake form: {{contact.full_name}}"
  - Assign to: Asia Kuykendall
  - Due: 24 hours
    |
    v
[SEND SMS — INTERNAL]
  Text: "New intake form submitted: {{contact.first_name}} {{contact.last_name}}. 
  Check GHL for details."
  To: Asia's number
```

---

## WORKFLOW 8: Module Completion Tracker
**Status**: NEW — create from scratch
**Note**: This workflow fires when you manually check a module checkbox on the contact record.
Each module completion is tracked via custom field updates + tag application.

### Trigger
- Type: **Contact Field Changed**
- Field: **Module 1: Orientation Complete**
- Value: **Yes (checked)**

### Steps (duplicate this workflow 3x for Modules 2, 3, 4)

```
[TRIGGER: Module 1 Orientation Complete = Yes]
    |
    v
[ADD TAG] → module-1-complete
    |
    v
[CREATE TASK]
  - Title: "{{contact.first_name}} completed Module 1 — review self-assessment"
  - Assign to: Asia Kuykendall

---
[Repeat for Module 2 → module-2-complete]
[Repeat for Module 3 → module-3-complete]
[Repeat for Module 4 → module-4-complete + jumpstart-graduate check]
```

---

## WORKFLOW 9: Engagement Letter Signed
**Status**: NEW — create from scratch
**Note**: Triggered when Asia/team manually marks engagement letter as signed

### Trigger
- Type: **Contact Field Changed**
- Field: **Doc: Engagement Letter Signed**
- Value: **Yes (checked)**

### Steps

```
[TRIGGER: Engagement Letter Signed = Yes]
    |
    v
[ADD TAG] → engagement-letter-signed
[REMOVE TAG] → engagement-letter-sent
    |
    v
[PIPELINE STAGE CHANGE] → Move to "Onboarding Kickoff (Setup/Access)" (Stage 2)
    |
    v
[SEND EMAIL] — Internal notification
  - To: Asia's email
  - Subject: "Engagement letter signed — {{contact.first_name}} moving to Stage 2"
```

---

## BUILD ORDER (execute in this sequence)

1. Create all 8 email templates first (see QWS-Email-Templates-GHL.md)
2. Wire **Workflow 1** (Warm Lead Nurture) — most urgent, protects leads NOW
3. Wire **Workflow 2** (Engagement Letter) — protects Stage 1 contacts
4. Wire **Workflow 3** (Document Collection) — protects Stage 2
5. Wire **Workflow 4** (Re-Engagement) — Stage 5 safety net
6. Create **Workflow 5** (JumpStart 4-Week) — educational series engine
7. Create **Workflow 6** (Calendar Entry) — intake automation
8. Create **Workflow 7** (Form Entry) — only after intake form is built
9. Create **Workflows 8+9** (Module tracking / Engagement signing)

## PUBLISH ORDER
Test each workflow with Henry (test contact) before publishing.
Once confirmed: Workflows 1–4 first (protect existing contacts), then 5–9.

---

## WORKFLOW SETTINGS (apply to all)

| Setting | Value |
|---------|-------|
| Communication Limits | Max 1 email/day, max 1 SMS/day |
| Send Window | 9am–6pm EST |
| Stop on Reply | Yes (for re-engagement workflows) |
| Allow Re-entry | No (except Module Completion tracker) |
| Test before publish | Always — use Henry as test contact |

---

## MERGE FIELDS QUICK REFERENCE

| Token | What It Pulls |
|-------|--------------|
| `{{contact.first_name}}` | Contact first name |
| `{{contact.full_name}}` | Full name |
| `{{contact.email}}` | Email address |
| `{{contact.phone}}` | Phone number |
| `{{intake_form_link}}` | URL of intake form (add as custom value) |
| `{{engagement_letter_link}}` | URL of engagement letter (add as custom value) |
| `{{booking_link}}` | Discovery call booking URL (add as custom value) |
| `{{portal_link}}` | Founder portal URL (add as custom value) |
| `{{drive_link}}` | Google Drive upload folder (add as custom value) |

### Adding Custom Values (for merge fields above):
Settings > Custom Values > Add New Value
- `intake_form_link` = [intake form URL once built]
- `engagement_letter_link` = [DocuSign/PandaDoc URL]
- `booking_link` = https://www.quantumwealththeory.com/widget/bookings/founderdiscovery
- `portal_link` = [Founder portal URL]
- `drive_link` = [Shared Google Drive folder URL]
