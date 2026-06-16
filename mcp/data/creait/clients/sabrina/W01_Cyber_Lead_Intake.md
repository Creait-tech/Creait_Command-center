# W01 — Cyber Insurance Lead Intake

**Goal:** Convert form submit → qualified, tagged, nurtured contact in <60 seconds.

## Trigger
- **Form Submitted:** `Cyber Insurance Intake Form`

## Steps

1. **Create/Update Contact**
   - Map all form fields → custom fields
   - Set `Lead Source = Website Form` if coming from Wix; else carry UTM
   - Set `Compliance Class = Standard (5-yr)`

2. **Apply Tags**
   - `product:cyber`
   - `source:<from form>`
   - `stage:warm-lead`
   - `compliance:standard`
   - `consent:email-marketing` (only if opt-in checkbox is true — field is required)
   - `consent:sms-marketing` (same)

3. **Create Opportunity**
   - Pipeline: **Cyber Insurance**
   - Stage: **New Lead**
   - Name: `{{contact.business_legal_name}} — Cyber`
   - Value: estimated premium if known; else leave blank

4. **Wait 30 seconds** (let the contact record settle)

5. **Send Internal Notification**
   - Channel: SMS + Email to Sabrina
   - Template: `"New Cyber Lead: {{contact.first_name}} {{contact.last_name}} @ {{contact.business_legal_name}}. Form data in GHL. Reply BOUND {{contact.id}} when closed."`

6. **Send Confirmation Email to Lead**
   - Template: `Email_Cyber_01_Confirmation` (see Messaging doc)
   - Includes booking calendar link

7. **Wait 10 minutes**

8. **Send SMS to Lead** (ONLY if `consent:sms-marketing`)
   - Template: `SMS_Cyber_01_Intro`

9. **Webhook: Easy Links Sync**
   - POST basic contact fields to Easy Links API endpoint
   - Log response → `Last Synced to Easy Links`

10. **Apply Tag** `seq:cyber-nurture`
    - This triggers Workflow W02 (Cyber Nurture)

## Exit Conditions (stop this workflow)
- Contact already has tag `flag:reply-stop` (pre-existing)
- Contact has tag `unsubscribed:email` AND `unsubscribed:sms` (nothing to send)
- Duplicate contact detected (GHL built-in dedupe on email+phone)
