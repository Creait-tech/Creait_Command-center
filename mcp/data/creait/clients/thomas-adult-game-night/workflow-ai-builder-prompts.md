# Workflow AI Builder Prompts

**For Track B (Claude in Chrome / Maurice's team).** Each section is one workflow. Paste the **AI Builder Prompt** verbatim into the GHL AI Workflow Builder, then verify the generated workflow against the **Verification Checklist**.

**Build path:** Automations → Workflows → + Create Workflow → "Start with AI" (or equivalent)

**Build order** (from `/config/workflows.json` `build_priority`):
1. Reactivation Campaign
2. Cart Abandonment Recovery
3. Post-Purchase Welcome Series
4. Event Registration & Follow-Up
5. Sponsor Pipeline (B2B)
6. Game Night Service Booking
7. Review Request Automation
8. App Lobby Capture (shell only — webhook URL TBD)

---

## Pre-build dependencies (must exist before any workflow build)

| Dependency | Status | Source |
|---|---|---|
| Pipelines (4) | 🟡 needs UI build | [`config/pipelines.json`](../config/pipelines.json) |
| Forms (6) | 🟡 needs UI build | [`docs/forms-manual-build-guide.md`](forms-manual-build-guide.md) |
| Email templates (20, named stubs exist) | 🟡 paste HTML bodies | [`config/email-templates.json`](../config/email-templates.json) + [`/email-templates/*.html`](../email-templates/) |
| SMS snippets (8) | 🟡 needs UI build | [`docs/sms-snippets-build-guide.md`](sms-snippets-build-guide.md) |
| Custom values (8) | ✅ created via API | [`logs/custom-values-created.json`](../logs/custom-values-created.json) |
| Custom fields (38) | ✅ created via API | (Phase 1 + 2) |
| Calendars (3) | ✅ created via API | (Phase 1) |

If pipelines and forms aren't built yet, the AI Builder will still generate workflows but the pipeline-move and form-trigger steps will be hollow. Build dependencies first.

---

## Workflow 1 — Reactivation Campaign (BUILD FIRST — simplest)

**Pre-build checklist:**
- [ ] Email `re_permission_email` has body content (paste from `/email-templates/re_permission_email.html`)
- [ ] Email `reactivation_offer` has body content
- [ ] Tag `source-import-klaviyo` exists (✅ created in Phase 1)
- [ ] Tag `engaged-30d`, `unsubscribed`, `lapsed-180d` exist (✅)

### AI Builder Prompt

```
Build a reactivation campaign workflow.

Trigger: when a contact gets the tag "source-import-klaviyo".

Step 1: Send the email template "Re-Permission (Klaviyo Migration)".

Step 2: Wait 3 days.

Step 3: If the contact opened or clicked the previous email, send the email template "Reactivation Offer". If they did not engage, skip this step.

Step 4: Wait 7 days.

Step 5: If the contact does not have the tag "engaged-30d" yet, send a final offer email (use Reactivation Offer again).

Step 6: Wait 14 days.

Step 7: If still no engagement, add the tag "lapsed-180d" and stop sending.

Stop conditions: exit immediately if the contact gets tagged "engaged-30d" or "unsubscribed".
```

### Expected Output
- 7-9 steps total
- 2-3 email sends (`re_permission_email`, `reactivation_offer` x1-2)
- 1 final tag add (`lapsed-180d`)
- 2 stop conditions wired

### Manual Tweaks After AI Generation
- Verify the AI used the **email title** ("Re-Permission (Klaviyo Migration)"), not a slug. If it created a new email, edit the step to point to the existing template.
- Check that "opened or clicked" condition uses GHL's email-engagement filter, not a tag. AI sometimes creates a tag-based equivalent.

### Verification Checklist
- [ ] Workflow named exactly: **Reactivation Campaign (Klaviyo Import)**
- [ ] Trigger fires on tag `source-import-klaviyo`
- [ ] First email is `Re-Permission (Klaviyo Migration)`
- [ ] Stop on `engaged-30d` and `unsubscribed`
- [ ] Final tag `lapsed-180d` applied at end

---

## Workflow 2 — Cart Abandonment Recovery

**Pre-build checklist:**
- [ ] Emails `cart_abandonment_1`, `cart_abandonment_2`, `cart_abandonment_3` have body content
- [ ] SMS snippet `cart_abandonment_sms` exists
- [ ] Tags `cart-abandoned`, `buyer`, `recovered-cart`, `lapsed-cart` exist (✅ except `recovered-cart` and `lapsed-cart` — add manually if not present)
- [ ] Custom value `cart_recovery_discount_code` = "PLAY10" (✅)

### AI Builder Prompt

```
Build a cart abandonment recovery workflow.

Trigger: when a contact gets the tag "cart-abandoned".

Step 1: Wait 1 hour, then send the email template "Cart Abandonment 1 (1hr)".

Step 2: Wait 23 hours, then send the email template "Cart Abandonment 2 (24hr)" AND the SMS snippet "cart_abandonment_sms" together.

Step 3: Wait 48 hours, then send the email template "Cart Abandonment 3 (72hr)".

Step 4: Wait 7 days, then remove the tag "cart-abandoned" and add the tag "lapsed-cart".

Stop conditions:
- If the contact gets tagged "buyer" at any point: remove the tag "cart-abandoned", add the tag "recovered-cart", and exit the workflow.
- If the contact gets tagged "unsubscribed": exit immediately.
```

### Expected Output
- 9-10 steps including 3 wait blocks, 3 emails, 1 SMS, 2 tag operations
- 2 stop conditions

### Manual Tweaks
- Confirm SMS snippet exists with name `cart_abandonment_sms` before testing
- Test fire by manually tagging a test contact with `cart-abandoned`

### Verification Checklist
- [ ] Workflow named: **Cart Abandonment Recovery**
- [ ] All 3 cart emails referenced by exact name
- [ ] SMS sends in step 2 (not 1 or 3)
- [ ] Stop on `buyer` includes the tag swap (remove cart-abandoned, add recovered-cart)

---

## Workflow 3 — Post-Purchase Welcome Series

**Pre-build checklist:**
- [ ] Email templates: `post_purchase_thank_you`, `app_download_email`, `hosting_tips_email`, `review_request_email`, `3d_kit_upsell` have HTML
- [ ] SMS snippet `review_request_sms` exists
- [ ] Pipeline "Game Sales (E-commerce)" exists with stage "Purchased"
- [ ] Custom field "Lifetime Order Value" exists (✅)
- [ ] Tags `buyer`, `bought-liquor-store`, `engaged-30d`, `complaint`, `unsubscribed` exist (most ✅, add `complaint` if missing)

### AI Builder Prompt

```
Build a post-purchase welcome series workflow.

Trigger: when a contact gets the tag "buyer".

First, do these immediately:
- Add the tag "bought-liquor-store"
- Move the contact to the "Purchased" stage of the "Game Sales (E-commerce)" pipeline
- Send the email template "Post-Purchase Thank You"

Then on a schedule:
- Day 1 (24 hours after trigger): Send the email "App Download (Day 1)"
- Day 3: Send the email "Hosting Tips (Day 3)"
- Day 7: Send the email "Review Request (Day 7)" AND the SMS snippet "review_request_sms" together
- Day 14: Send the email "3D Kit Upsell (Day 14)"
- Day 30: Add the tag "engaged-30d"

Stop conditions:
- If the contact gets tagged "unsubscribed": exit
- If the contact gets tagged "complaint": send an internal alert email to thomas@adultgamenights.com with the contact name, then exit
```

### Expected Output
- 14-16 steps
- 5 email sends spaced over 30 days
- 1 SMS send
- 1 pipeline move
- 1 tag operation at end

### Manual Tweaks
- AI may try to update "Lifetime Order Value" field — only works if order webhook passes total. For now, leave that step out and add it later when Shopify integration is wired.
- Verify pipeline stage name is exactly "Purchased" (case-sensitive in some UIs).

### Verification Checklist
- [ ] Workflow named: **Post-Purchase Welcome Series**
- [ ] Pipeline move to "Purchased" in step 3
- [ ] All 5 emails referenced
- [ ] Day 7 sends both email + SMS together
- [ ] `engaged-30d` tag at Day 30

---

## Workflow 4 — Event Registration & Follow-Up

**Pre-build checklist:**
- [ ] Form "Event Registration" exists in CreateOS
- [ ] Pipeline "Event Attendees" exists with stages "Registered", "Followed Up"
- [ ] Email templates `event_reminder_7d`, `event_reminder_1d`, `post_event_thank_you` have HTML
- [ ] SMS snippet `event_reminder_1d_sms` exists
- [ ] Custom field "Event Selection" exists (✅)
- [ ] Tags `source-event`, `event-attendee` exist (✅)

### AI Builder Prompt

```
Build an event registration follow-up workflow.

Trigger: when the form "Event Registration" is submitted.

Immediately:
- Read the contact's "Event Selection" custom field. Convert it to a kebab-case tag formatted "event-{slugified-event-name}". For example, if Event Selection is "Russell Center July 3", add the tag "event-russell-center-july-3".
- Add the tag "source-event"
- Move the contact to the "Registered" stage of the "Event Attendees" pipeline
- Send a confirmation email (use the "Event Reminder 7d" template as a placeholder)

Then on a schedule (relative to the event date — note: event date is currently inferred from Event Selection; if no specific date is in a custom field, schedule based on the dropdown choice — Russell Center July 3 = July 3, 2026):
- 7 days before event: send email "Event Reminder 7d"
- 1 day before event: send email "Event Reminder 1d" AND SMS snippet "event_reminder_1d_sms" together
- Morning of event: send an SMS reminder ("Tonight! See you there 🎲")
- 1 day after event: send email "Post-Event Thank You"

Then 7 days after event:
- Move the contact to the "Followed Up" stage
- Add the tag "event-attendee"

Stop conditions: exit if the contact gets tagged "unsubscribed".
```

### Expected Output
- 13-16 steps
- 3 email sends + 2 SMS sends
- 1 dynamic tag (event-{slug})
- 2 pipeline moves

### Manual Tweaks
- **Event date scheduling is tricky** — GHL's AI Builder may struggle with "schedule relative to a custom field date that needs parsing from a dropdown." If it doesn't generate scheduling correctly, hard-code the date for the inaugural event (July 3, 2026) and template the workflow per-event going forward.
- Dynamic tag generation: if the AI can't slugify, manually set 1 tag per event option (event-russell-center-july-3, event-other-tbd).

### Verification Checklist
- [ ] Workflow named: **Event Registration & Follow-Up**
- [ ] Triggers from form submission, not tag
- [ ] Day-7 reminder fires before day-1 reminder
- [ ] Final pipeline stage is "Followed Up"

---

## Workflow 5 — Sponsor Pipeline (B2B)

**Pre-build checklist:**
- [ ] Form "Sponsorship Inquiry" exists
- [ ] Pipeline "Sponsorship/B2B" exists with stages "Lead", "Signed"
- [ ] Email template `sponsor_pitch` has HTML
- [ ] Tags `sponsor-lead`, `source-sponsor-inquiry`, `sponsor-engaged`, `signed-sponsor`, `lapsed-sponsor` exist (mostly ✅, add `sponsor-engaged` and `signed-sponsor` if not in Phase 1 list)

### AI Builder Prompt

```
Build a sponsor pipeline workflow.

Trigger: when the form "Sponsorship Inquiry" is submitted.

Immediately:
- Add the tag "sponsor-lead"
- Add the tag "source-sponsor-inquiry"
- Move the contact to the "Lead" stage of the "Sponsorship/B2B" pipeline
- Send an internal notification email to adultgamenights@gmail.com with subject "🎯 New sponsor inquiry: {{custom_field.business_name}}" and body summarizing the contact name, products to sponsor, website, and Instagram handle from the form
- Send the email template "Sponsor Pitch" to the contact

Then:
- 7 days after start: If the contact does NOT have the tag "sponsor-engaged" yet, send a follow-up email (paste content: "Hey {{contact.first_name}} — circling back on the sponsor pitch. Did the tier breakdown make sense? Happy to jump on a quick call. — Thomas")
- 14 days after start: If still no tag "sponsor-engaged", send a final follow-up email
- 28 days after start: Add the tag "lapsed-sponsor"

Stop conditions:
- Exit immediately if the contact gets tagged "sponsor-engaged"
- If the contact gets tagged "signed-sponsor": move them to the "Signed" stage and exit
```

### Expected Output
- 8-10 steps
- 2-3 email sends (1 internal, 1-2 to contact)
- 1 pipeline move + 1 conditional pipeline move on `signed-sponsor`

### Manual Tweaks
- The two follow-up emails (7d and 14d) don't have pre-built templates. AI Builder will likely create new ones inline. That's fine — copy the body suggested above into the new templates so they're cohesive.
- Internal notification email should land in Maurice/Thomas's inbox — verify the "to" field is correct.

### Verification Checklist
- [ ] Workflow named: **Sponsor Pipeline (B2B)**
- [ ] Internal email on submission to adultgamenights@gmail.com
- [ ] `sponsor_pitch` email referenced
- [ ] Stop conditions wired for `sponsor-engaged` and `signed-sponsor` (latter triggers pipeline move)

---

## Workflow 6 — Game Night Service Booking (MOST COMPLEX)

**Pre-build checklist:**
- [ ] Form "Game Night Service Booking" exists
- [ ] Pipeline "Game Night Service" exists with all 8 stages
- [ ] Email templates: `service_booking_confirmation`, `event_reminder_7d`, `service_reminder_1d`, `post_event_thank_you` have HTML
- [ ] SMS snippets `service_reminder_1hr`, `service_day_of_arrival`, `review_request_sms` exist
- [ ] Custom fields "Event Date", "Event Address", "Package Selection" exist (✅)
- [ ] Tags `service-booker`, `source-game-night-booking`, `deposit-paid`, `booking-canceled`, `service-completed` exist (some ✅, add `deposit-paid`, `booking-canceled`, `service-completed` if missing)

### AI Builder Prompt

```
Build a game night service booking workflow. This is the most complex workflow — multiple wait points and conditional branches.

Trigger: when the form "Game Night Service Booking" is submitted.

Phase A — Confirmation (immediately):
1. Add tags "service-booker" and "source-game-night-booking"
2. Move the contact to the "Inquiry" stage of the "Game Night Service" pipeline
3. Send the email template "Service Booking Confirmation"
4. Send an SMS to my business number 478-654-9574 (Thomas's phone) with the body: "🎲 New game night booking from {{contact.first_name}} {{contact.last_name}} for {{custom_field.event_date}}. Check the CRM."

Phase B — Wait for deposit (up to 30 days):
5. Wait until the contact gets the tag "deposit-paid". If 30 days pass with no deposit, exit the workflow.
6. Move the contact to the "Deposit Paid" stage of the same pipeline
7. Send a contract/details email (placeholder — use Service Booking Confirmation as the template, body to be customized later)

Phase C — Pre-event reminders (relative to custom field "Event Date"):
8. 7 days before Event Date: send email "Event Reminder 7d"
9. 1 day before Event Date: send email "Service Reminder 1d" AND SMS snippet "service_reminder_1hr" together
10. 1 hour before the booked time on Event Date: send SMS snippet "service_day_of_arrival"

Phase D — Post-event:
11. 1 day after Event Date: move to "Completed" stage, send email "Post-Event Thank You" AND SMS snippet "review_request_sms"
12. 30 days after Event Date: send a rebook offer email (placeholder — reuse "3D Kit Upsell" template for now)

Stop conditions: exit immediately if the contact gets tagged "booking-canceled" at any point.
```

### Expected Output
- 18-22 steps
- 5 email sends
- 3-4 SMS sends
- 4 pipeline moves
- 1 internal SMS
- "Wait for tag" with timeout
- Multiple "wait until date offset" steps

### Manual Tweaks
- **The internal SMS to Thomas (step 4)**: GHL's "Send SMS" action sends to the contact by default. Use "Send Internal SMS" or "Custom Webhook → Twilio" depending on what the AI Builder generates. Verify the recipient is +14049542115, not the contact.
- **"Wait until date" steps**: AI Builder may generate "Wait" duration. Replace with "Wait Until Custom Date" and reference the "Event Date" field.
- **30-day rebook offer**: pure placeholder for now. Build a real rebook email template in Phase 5 if Thomas wants it.

### Verification Checklist
- [ ] Workflow named: **Game Night Service Booking**
- [ ] All 4 pipeline moves: Inquiry → Deposit Paid → (Confirmed implicit) → Completed
- [ ] Internal SMS goes to +14049542115 (NOT the contact)
- [ ] Day-of SMS sends 1 hour before, not 1 day
- [ ] `booking-canceled` stop condition wired

---

## Workflow 7 — Review Request Automation

**Pre-build checklist:**
- [ ] Email templates `review_request_email` and `negative_review_alert` have HTML
- [ ] SMS snippet `review_request_sms` exists
- [ ] Custom field for "review_rating" exists (TBD — may need to add as numerical custom field)
- [ ] Tags `buyer`, `service-completed`, `reviewed`, `unsubscribed` exist (mostly ✅)

### AI Builder Prompt

```
Build a review request workflow.

Trigger: this workflow has TWO entry points — pick whichever GHL allows, or create two separate triggers in one workflow:
- Entry A: 7 days after a contact is tagged "buyer"
- Entry B: 1 day after a contact is tagged "service-completed"

Step 1: Send the email template "Review Request (Day 7)" AND the SMS snippet "review_request_sms" together.

Step 2: Wait 3 days.

Step 3: Branch based on whether the contact has the tag "reviewed":

Branch 3a — IF tagged "reviewed": Look at the custom field "review_rating". 
  - If rating is 4 or 5: Send a thank-you email with a link to leave the same review on Google.
  - If rating is 1, 2, or 3: Send the email template "Negative Review Alert (Internal)" to thomas@adultgamenights.com (NOT to the contact). Do not auto-respond to the contact — Thomas will handle personally.

Branch 3b — IF NOT tagged "reviewed": exit the workflow (no further nudges).

Stop conditions:
- Exit immediately if the contact gets tagged "reviewed" before step 1 fires
- Exit if the contact gets tagged "unsubscribed"
```

### Expected Output
- 4-6 steps with one branching condition
- 2 email sends (review_request_email + either Google review thank-you OR negative_review_alert)
- 1 SMS send

### Manual Tweaks
- **Two trigger entry points**: GHL workflows usually allow only one trigger. If forced to pick one, build the workflow twice (or use "OR" trigger logic). Easier alternative: have two parallel workflows that share the same body.
- **`review_rating` custom field**: not yet created. Add a NUMERICAL custom field "Review Rating" before testing this workflow.
- **Google review link**: hardcode the actual Google review URL once Adult Game Nights has a Google Business Profile.

### Verification Checklist
- [ ] Workflow named: **Review Request Automation**
- [ ] Triggers from `buyer` (7d delay) and `service-completed` (1d delay)
- [ ] Branching on `review_rating` value works
- [ ] Negative reviews route to Thomas internally, not auto-replied

---

## Workflow 8 — App Lobby Capture (SHELL ONLY)

**Status:** Build the shell now so the structure is in place. The webhook URL is filled in once Thomas's app developer is ready to connect.

**Pre-build checklist:**
- [ ] Pipeline "Event Attendees" exists with stage "Played Game (App Lobby)"
- [ ] Custom fields "Game Host Name", "Last Event Attended", "Games Played in App" exist (✅)
- [ ] Tags `source-app-lobby`, `app-player`, `buyer` exist (✅)

### AI Builder Prompt

```
Build an app lobby capture workflow.

Trigger: Inbound Webhook. (After saving the workflow, copy the webhook URL it generates and send it to the app developer to wire up.)

The webhook will receive a JSON payload with these fields:
- email (the player's email)
- host_name (who hosted the game session)
- event_id (which event session — e.g., a UUID)
- recap_video_url (URL to the post-game recap video)

Steps:
1. Find or create a contact by matching the "email" field from the webhook
2. Add tags "source-app-lobby" and "app-player"
3. Update the contact's "Game Host Name" custom field with the webhook's "host_name" value
4. Update the contact's "Last Event Attended" custom field with the webhook's "event_id" value
5. Increment the contact's "Games Played in App" custom field by 1
6. Move the contact to the "Played Game (App Lobby)" stage of the "Event Attendees" pipeline
7. Wait 1 day
8. Send an email with the recap video — body should include "Hey {{contact.first_name}}, your recap is ready: {{webhook.recap_video_url}}"
9. Wait 3 days
10. Conditional: If the contact has the tag "buyer", do nothing (skip). If the contact does NOT have the tag "buyer", send an email with a buy-the-game CTA.

No stop conditions needed for now.
```

### Expected Output
- 10-12 steps
- Webhook trigger
- Find-or-create contact action
- 2 conditional email sends

### Manual Tweaks
- **Webhook URL**: copy from GHL's UI after save. Place in `/logs/workflow-5-webhook-url.txt` for the app developer.
- The "increment by 1" custom field action may not exist natively — workaround: read current value, set to value+1. AI Builder will likely struggle here. If so, leave step 5 as a TODO and add it via custom code action later.
- The recap video email and buy-the-game CTA email are **inline copy** for now. Convert to reusable templates in Phase 5.

### Verification Checklist
- [ ] Workflow named: **App Lobby Capture**
- [ ] Webhook trigger active (not disabled)
- [ ] Webhook URL captured in `/logs/workflow-5-webhook-url.txt` (manual paste)
- [ ] Contact upsert by email works
- [ ] Conditional buy-the-game CTA respects `buyer` tag

---

## After all 8 workflows built

1. Run from the project root:
   ```bash
   node scripts/09-verify-workflows.js
   ```
   This pulls `GET /workflows/`, matches by `display_name` from `/config/workflows.json`, and saves IDs to `/logs/workflows-created.json`. Reports any missing or misnamed workflows.

2. Run:
   ```bash
   node scripts/10-wire-form-submissions.js
   ```
   Attempts to wire form submission triggers to workflow IDs. If the API doesn't support form-submission webhooks via PIT, the script writes a manual UI checklist instead.

3. Test each workflow:
   - Create a fresh test contact (e.g., test+wf1@example.com)
   - Manually trigger via tag add or form submit
   - Confirm at least the first 2 steps fire as expected
   - Document any issues in `/logs/workflow-test-results.json`
