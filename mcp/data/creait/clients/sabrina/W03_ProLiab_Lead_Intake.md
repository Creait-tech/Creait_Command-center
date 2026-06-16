# W03 — Professional Liability Lead Intake

**Goal:** Capture info BEFORE redirecting to direct carrier quoting link.

## Trigger
- Form Submitted: `Pro-Liab Intake Form`

## Steps

1. **Create/Update Contact** — map fields, set `Primary Product Interest = Professional Liability`

2. **Apply Tags**
   - `product:pro-liab`
   - `stage:warm-lead`
   - `source:<form source>`
   - `compliance:standard`
   - `consent:email-marketing` / `consent:sms-marketing` (as checked)

3. **Create Opportunity** — Pipeline: Pro-Liab, Stage: New Lead

4. **Set Custom Field** `Carrier Referral Link Sent` = NOW

5. **Redirect Action (form-level)**
   - On form submit, redirect prospect to the correct direct carrier link based on `Service Type` answer
   - Use a dynamic redirect page: `/redirect/pro-liab?type={{service_type}}` that maps:
     - Beauty/Salon → Carrier A link
     - Consulting → Carrier B link
     - Tech → Carrier C link
     - Other → fallback booking page with Sabrina
   - Query params: `utm_source=franklin-ins&contact_id={{contact.id}}`

6. **Wait 2 minutes**

7. **Send Confirmation Email**
   - `Email_ProLiab_01_Confirmation`
   - Explains what they just saw (carrier site is Sabrina's referral, she gets credit, she's their broker of record)

8. **Wait 10 minutes**

9. **Send SMS**
   - `SMS_ProLiab_01_Intro`

10. **Send Internal Notification to Sabrina**
    - `"Pro-Liab lead: {{contact.business_legal_name}}. Redirected to carrier. Watch for bind."`

11. **Webhook: Easy Links Sync** (basic fields only)

12. **Apply Tag** `seq:pro-liab-nurture` → triggers W04

## Branch: Did They Bind on Carrier Site?
- **Daily check (separate W04 step):** Sabrina gets a list of leads redirected in last 48 hours
- She can text back `BOUND {{contact.id}}` → Workflow W07 takes over (parsed by inbound SMS handler)
- If not bound in 48 hrs → nurture continues
