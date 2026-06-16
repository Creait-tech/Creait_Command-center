# 03 — Configure GHL Webhook

Time: ~10 minutes. Connect CreaitOS to n8n so cyber form submissions trigger the quote bridge.

## Prerequisites

- The Cyber Initial Intake form exists in GHL (built in Phase 4 of the main playbook)
- n8n is running and the cyber-quote-bridge workflow is imported
- You have the n8n webhook URL handy (from previous doc)
- Sabrina's contact has been created in GHL with her phone number, and you've stored its ID as a Custom Value named `sabrina_contact_id`

## Step 1: Set up Sabrina's internal contact (one-time)

This is the contact that receives the success/failure SMS notifications.

In GHL:
1. **Contacts → Add Contact**
2. First name: Sabrina, Last name: Franklin
3. Email: her email, Phone: her cell
4. Tags: `internal-team`
5. Save

Click into her contact and copy the contact ID from the URL. It looks like:
```
https://app.creaitos.com/v2/location/.../contacts/detail/AbCd1234XyZ...
                                                       ^^^^^^^^^^^^^^^
```

That string after `/detail/` is her contact ID.

## Step 2: Create a Custom Value for her contact ID

In GHL:
1. **Settings → Custom Values → Add Custom Value**
2. Name: `Sabrina Contact ID` (key auto-generates as `sabrina_contact_id`)
3. Value: paste the ID you copied
4. Save

This lets every workflow reference `{{custom_values.sabrina_contact_id}}` to send her notifications.

## Step 3: Build the trigger workflow in GHL

This is the GHL workflow that fires the n8n webhook when someone submits the cyber form. It's separate from the cyber lead nurture (Workflow 2 in Phase 6.2) — both can fire from the same trigger.

In GHL:
1. **Automation → Workflows → Create Workflow → Start from Scratch**
2. Name: `Cyber Form → n8n ProWriters Bridge`
3. Add **Trigger**: Form Submitted
4. Configure the trigger:
   - Form: `Cyber - Initial Intake`
5. Save

## Step 4: Add the Custom Webhook action

1. Click the **+** below the trigger
2. Choose **Custom Webhook**
3. Configure:

   **URL**:
   ```
   https://n8n.creaitos.com/webhook/cyber-quote-request
   ```
   (use your actual n8n domain)

   **Method**: POST

   **Headers**:
   - `Content-Type`: `application/json`

   **Body** (JSON):
   ```json
   {
     "contact_id": "{{contact.id}}",
     "sabrina_internal_contact_id": "{{custom_values.sabrina_contact_id}}",
     "first_name": "{{contact.first_name}}",
     "last_name": "{{contact.last_name}}",
     "email": "{{contact.email}}",
     "phone": "{{contact.phone}}",
     "business_name": "{{contact.business_name}}",
     "business_website": "{{contact.business_website}}",
     "industry_type": "{{contact.industry_type}}",
     "annual_revenue": "{{contact.annual_revenue}}",
     "employee_count": "{{contact.employee_count}}",
     "cyber_records_handled": "{{contact.cyber_records_handled}}",
     "cyber_processes_payments": "{{contact.cyber_processes_payments}}",
     "cyber_has_mfa": "{{contact.cyber_has_mfa}}",
     "cyber_backup_frequency": "{{contact.cyber_backup_frequency}}",
     "cyber_prior_breach": "{{contact.cyber_prior_breach}}",
     "desired_coverage_amount": "{{contact.desired_coverage_amount}}",
     "current_carrier": "{{contact.current_carrier}}",
     "current_premium": "{{contact.current_premium}}",
     "policy_expiration_date": "{{contact.policy_expiration_date}}"
   }
   ```

4. Click **Save Action**

## Step 5: Add a stage transition action

After the webhook, advance the opportunity to "Quote Requested" so Sabrina can see in the pipeline that the automation is running.

1. Click **+** below the webhook action
2. Choose **Update Opportunity**
3. Configure:
   - Pipeline: Cyber Insurance
   - Stage: Quote Requested
4. Save

## Step 6: Activate the GHL workflow

Top-right of the workflow editor: toggle from **Draft** to **Published**.

## Step 7: Quick smoke test (no real lead needed)

Submit the Cyber Initial Intake form yourself with test data:
- Name: Test User
- Email: your own
- Business: Test Company
- Fill all required fields

Then immediately check:

**In GHL:**
- New contact created? ✓
- Tagged as `cyber-lead`? ✓
- Opportunity created in Cyber Insurance pipeline? ✓
- After webhook fires, opportunity in "Quote Requested" stage? ✓

**In n8n:**
- Click the workflow → **Executions** tab
- See a new execution within 5 seconds of form submission?
- Did it return 202 Accepted to GHL?

If both sides show activity, the connection works. The actual ProWriters automation may have failed (we haven't tested it yet) — that's the next doc.

## Common issues

### "Webhook URL not reachable"
Your n8n domain isn't resolving from the public internet, OR Caddy's HTTPS cert hasn't been issued yet. Check:
```bash
curl -I https://n8n.creaitos.com
# Should return HTTP/2 200 (or 401 from Caddy basic auth)
```

### "Empty body received in n8n"
The merge tags `{{contact.business_name}}` etc. only resolve if those custom fields exist on the contact. If you forgot to fill out a field on the test form, that field will be blank in the webhook payload. Check the n8n execution to see what arrived.

### "401 Unauthorized from n8n"
n8n's webhook endpoints don't use basic auth (they're meant to be hit by external services). If you're getting 401, the URL is probably wrong — verify in the n8n workflow's webhook node.

---

Next: `04-test-end-to-end.md`
