# GHL Setup Guide — QW Founder Journey
## Items Requiring Manual UI Configuration

**Account**: Quantum Wealth Network (Location: sTlvUPTx6xuouNAJ2JvA)
**Date**: 2026-04-14
**Prepared by**: CREAIT Team (Maurice)

---

## What's Already Done (via API)

| Item | Status | Details |
|------|--------|---------|
| Henry (Green Egg Mender) tagged | Done | Tags: founder, service-cleanup, lead-source-referral, active-founder, onboarded |
| Henry pipeline opportunity | Done | ACE FM pipeline, Stage 3 (Service/Cleanup), $1,500 value |
| Friends Funeral & Cremation Group | Done | Tagged warm-lead, opportunity at Stage 0 (Lead) |
| Diamond Davis / Lit Cocktails | Done | Tagged warm-lead, opportunity at Stage 0 (Lead) |
| Daryl Bond contact created | Done | Tagged referral-partner, team-member |
| Q-Pilot email sequences written | Done | See QW-Founder-Journey-Email-Sequences.md |

---

## STEP 1: Rename ACE FM Pipeline to "QW Founder Journey"

**Location**: Opportunities > Pipelines > ACE FM > Settings (gear icon)

1. Click the **gear icon** next to "ACE FM"
2. Change the pipeline name to: **QW Founder Journey**
3. Rename each stage:

| Current Stage Name | New Stage Name | Position |
|---|---|---|
| 0. LEAD | **Warm Lead** | 0 |
| 1. AGREEMENT | **Pre-Onboarding (Awaiting Docs)** | 1 |
| 2. ONBOARD | **Onboarding Kickoff (Setup/Access)** | 2 |
| 3. SERVICE (Set/Clean Up) | **Onboarding (Educational Series)** | 3 |
| 4. SERVICE (Monthly) | **Active Founder** | 4 |
| 5. RETENTION | **Paused - Needs Follow-Up** | 5 |

4. Save changes

**Note**: The existing opportunities (Henry, Friends Funeral, Diamond Davis) will automatically update to the new stage names.

---

## STEP 2: Create Email Templates from Q-Pilot Sequences

**Location**: Marketing > Emails > Templates > Create Template

Create **one template per email** in the sequence file (`QW-Founder-Journey-Email-Sequences.md`):

### Templates to Create:

| Template Name | Sequence | Subject Line |
|---|---|---|
| QPilot - Day 1 Welcome | Lead Nurture | Your rocket is sitting on the launchpad, {{contact.first_name}}. |
| QPilot - Day 5 Value | Lead Nurture | What most business owners don't know about their own books |
| QPilot - Day 12 Urgency | Lead Nurture | We only take on a limited number of new founders each month |
| QPilot - Engagement Sent | Pre-Onboarding | Your Quantum Wealth engagement letter is ready, {{contact.first_name}} |
| QPilot - Engagement Reminder | Pre-Onboarding | Quick reminder — your engagement letter is ready |
| QPilot - Welcome Aboard | Onboarding Kickoff | Welcome aboard, Captain {{contact.first_name}}. Here's what we need from you. |
| QPilot - Doc Reminder | Onboarding Kickoff | Still waiting on a few items, {{contact.first_name}} |
| QPilot - Module 1 Complete | Educational Series | Module 1 complete. You're learning to read the instruments. |
| QPilot - Module 2 Complete | Educational Series | Module 2 down. Your foundation is set. |
| QPilot - Module 3 Complete | Educational Series | Module 3 complete. Your money now has a system. |
| QPilot - Module 4 Complete | Educational Series | You've cleared the hangar. Welcome to the crew, {{contact.first_name}}. |
| QPilot - Re-Engage Day 1 | Re-Engagement | {{contact.first_name}}, we noticed you've been quiet |
| QPilot - Re-Engage Final | Re-Engagement | Last check-in from Q-Pilot |

**For each template:**
- Sender Name: **Q-Pilot | Quantum Wealth Network**
- Copy the body text from `QW-Founder-Journey-Email-Sequences.md`
- Use brand colors: buttons = #0b7066, accents = #361766
- Add QWN logo to header
- Keep layout clean and minimal (matches Asia's flat design style)

---

## STEP 3: Build Workflow — Lead Nurture Automation

**Location**: Automation > Workflows > Create Workflow > Start from Scratch

### Workflow: "QW Lead Nurture Sequence"

**Trigger**: Pipeline Stage Changed → "Warm Lead" (Stage 0)

```
TRIGGER: Contact enters "Warm Lead" stage
    |
    v
[Wait 0 min] → Send Email: "QPilot - Day 1 Welcome"
    |
    v
[Wait 2 days] → Send SMS: "Q-Pilot here — still thinking it over?..."
    |
    v
[Wait 2 days] → Send Email: "QPilot - Day 5 Value"
    |
    v
[Wait 3 days] → Send SMS: "Q-Pilot checking in. Want me to send you more info?..."
    |
    v
[Wait 4 days] → Send Email: "QPilot - Day 12 Urgency"
    |
    v
[Wait 2 days] → Send SMS: "No pressure — just didn't want to lose touch..."
    |
    v
[IF/ELSE] → Check: Has contact moved to Stage 1?
    |-- YES → End workflow (they converted)
    |-- NO → Add tag "nurture-complete-no-conversion"
                → Move to "Paused - Needs Follow-Up" stage
```

**Important Settings:**
- Communication Limits: Max 1 SMS per day, max 1 email per day
- Business Hours: Send between 9am-6pm EST only
- Exit Condition: Contact advances past Stage 0

---

## STEP 4: Build Workflow — Pre-Onboarding (Engagement Letter)

**Location**: Automation > Workflows > Create Workflow

### Workflow: "QW Engagement Letter Follow-Up"

**Trigger**: Pipeline Stage Changed → "Pre-Onboarding (Awaiting Docs)" (Stage 1)

```
TRIGGER: Contact enters "Pre-Onboarding" stage
    |
    v
[Wait 0 min] → Send Email: "QPilot - Engagement Sent"
    |
    v
[Wait 3 days] → [IF/ELSE] Still in Stage 1?
    |-- YES → Send SMS: engagement letter reminder
    |-- NO → End (they signed)
    |
    v
[Wait 2 days] → [IF/ELSE] Still in Stage 1?
    |-- YES → Send Email: "QPilot - Engagement Reminder"
    |-- NO → End
    |
    v
[Wait 5 days] → [IF/ELSE] Still in Stage 1?
    |-- YES → Internal notification to Asia: "{{contact.first_name}} hasn't signed after 10 days"
    |-- NO → End
```

---

## STEP 5: Build Workflow — Onboarding Kickoff (Doc Collection)

### Workflow: "QW Document Collection"

**Trigger**: Pipeline Stage Changed → "Onboarding Kickoff (Setup/Access)" (Stage 2)

```
TRIGGER: Contact enters "Onboarding Kickoff" stage
    |
    v
[Wait 0 min] → Send Email: "QPilot - Welcome Aboard"
    |
    v
[Wait 3 days] → Send SMS: doc collection reminder
    |
    v
[Wait 4 days] → [IF/ELSE] Still in Stage 2?
    |-- YES → Send Email: "QPilot - Doc Reminder"
    |-- NO → End
    |
    v
[Wait 7 days] → [IF/ELSE] Still in Stage 2?
    |-- YES → Internal notification: "Docs outstanding for 14 days"
    |-- NO → End
```

---

## STEP 6: Build Workflow — Re-Engagement (Stage 5)

### Workflow: "QW Re-Engagement"

**Trigger**: Pipeline Stage Changed → "Paused - Needs Follow-Up" (Stage 5)

```
TRIGGER: Contact enters "Paused" stage
    |
    v
[Wait 1 day] → Send Email: "QPilot - Re-Engage Day 1"
    |
    v
[Wait 4 days] → Send SMS: re-engagement check-in
    |
    v
[Wait 9 days] → Send Email: "QPilot - Re-Engage Final"
    |
    v
[Wait 30 days] → [IF/ELSE] Still in Stage 5?
    |-- YES → Add tag "inactive-archived"
    |-- NO → End
```

---

## STEP 7: Update PIT Token Scopes (Optional)

To enable full API automation in the future, the PIT needs additional scopes:

**Current scopes**: contacts (read/write), opportunities (read/write), pipelines (read only), workflows (read only)

**Needed scopes for full automation**:
- `opportunities/pipelines.write` — create/update pipelines
- `workflows.write` — create/update workflows
- `emails/templates.write` — create email templates

**How to update**: Settings > Integrations > Private Integrations > Edit > Add scopes

---

## STEP 8: Verify Everything Works

After completing Steps 1-6, verify:

- [ ] Pipeline renamed to "QW Founder Journey" with correct stage names
- [ ] Henry shows at "Onboarding (Educational Series)" stage
- [ ] Friends Funeral shows at "Warm Lead" stage
- [ ] Diamond Davis shows at "Warm Lead" stage
- [ ] All 13 email templates created with Q-Pilot branding
- [ ] Lead Nurture workflow triggers when contact enters Stage 0
- [ ] Engagement Letter workflow triggers when contact enters Stage 1
- [ ] Document Collection workflow triggers when contact enters Stage 2
- [ ] Re-Engagement workflow triggers when contact enters Stage 5
- [ ] SMS messages send from correct number
- [ ] Email sender shows "Q-Pilot | Quantum Wealth Network"

---

## Tag System Reference

| Tag | Purpose | Applied When |
|-----|---------|-------------|
| `founder` | Client receiving financial services | Engagement letter signed |
| `member` | Community participant | Joins community |
| `warm-lead` | Expressed interest, not yet converted | Enters Stage 0 |
| `active-founder` | Fully onboarded, monthly service active | Reaches Stage 4 |
| `onboarded` | Completed educational series | All 4 modules done |
| `service-cleanup` | Needs/received bookkeeping cleanup | At intake |
| `service-maintenance` | On monthly maintenance retainer | After cleanup |
| `service-cfo` | Fractional CFO client | CFO engagement signed |
| `lead-source-referral` | Came via referral partner | At intake |
| `lead-source-event` | Met at networking event | At intake |
| `lead-source-linkedin` | Found via LinkedIn content | At intake |
| `referral-partner` | Is a referral partner (not a client) | Partner approved |
| `team-member` | Internal team member | Manual |
| `nurture-complete-no-conversion` | Went through full nurture without converting | Day 14 no action |
| `inactive-archived` | Paused for 30+ days, no response | Auto after 30 days in Stage 5 |
