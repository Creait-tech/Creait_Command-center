# Adult Game Nights — Operations Manual

**Audience:** Thomas Gray (and Maurice for power-user functions). Read this when you need to do something with the CRM and forgot how.

**Format:** Task-based. Find your task in the index, follow the steps.

**Skill assumed:** You can navigate CreateOS, add a contact, send an email. Everything beyond that is documented here.

---

## Index

### Daily ops
- [Check who needs your attention right now](#check-who-needs-your-attention-right-now)
- [Respond to an escalated conversation](#respond-to-an-escalated-conversation)
- [Respond to a negative review](#respond-to-a-negative-review)

### Game night service flow
- [Confirm a service booking](#confirm-a-service-booking)
- [Mark a deposit as paid](#mark-a-deposit-as-paid)
- [Cancel a booking](#cancel-a-booking)
- [Day-of arrival ping](#day-of-arrival-ping)

### Sponsor flow
- [Triage a new sponsor inquiry](#triage-a-new-sponsor-inquiry)
- [Move a sponsor to "engaged" status](#move-a-sponsor-to-engaged-status)
- [Sign a sponsor](#sign-a-sponsor)

### Content / marketing
- [Schedule a social post](#schedule-a-social-post)
- [Send a one-off email blast](#send-a-one-off-email-blast)
- [Update an email template](#update-an-email-template)
- [Add a new event landing page](#add-a-new-event-landing-page)

### Customer / contact ops
- [Add a contact manually](#add-a-contact-manually)
- [Tag a contact](#tag-a-contact)
- [Move a contact through a pipeline](#move-a-contact-through-a-pipeline)
- [Look up a contact's full history](#look-up-a-contacts-full-history)

### AI agent management
- [Pause AI on a single conversation](#pause-ai-on-a-single-conversation)
- [Refresh AI personality after voice samples](#refresh-ai-personality-after-voice-samples)
- [Update an FAQ in the knowledge base](#update-an-faq-in-the-knowledge-base)

### Maintenance
- [Re-auth a social account](#re-auth-a-social-account)
- [Update the discount code](#update-the-discount-code)
- [Run the build scripts](#run-the-build-scripts)

---

## Daily ops

### Check who needs your attention right now

1. Open CreateOS → Dashboard → "Thomas's Daily View"
2. Look at the top row:
   - **Escalations needing response** > 0 → respond first
   - **Today's services** → check addresses + times
   - **Negative reviews unanswered** > 0 → respond within 4 hours

If the dashboard isn't built yet, here are the manual paths:
- Conversations → filter tag `escalate-to-thomas`, status open
- Calendars → today
- Reputation → Reviews → filter < 4 stars, status "no response"

---

### Respond to an escalated conversation

The Conversation AI escalated for one of these reasons:
- Customer mentioned: manager, owner, complaint, refund, lawyer, media, press
- Sentiment dropped (frustration detected)
- Conversation went 8+ exchanges without resolution

**Steps:**
1. Conversations → click the escalated thread
2. Read the AI's last message (it should say "Aight, looping in Thomas now")
3. Read the conversation history to understand what they want
4. Respond directly — AI is paused on this thread
5. After resolved, **remove the tag `escalate-to-thomas`** to mark it closed
6. If AI should resume on this contact: also re-enable AI on the conversation

**Don't** respond as if you're the AI — be yourself. The customer asked for a human.

---

### Respond to a negative review

Reviews 1-3 stars trigger an internal alert (SMS + email to you). NO public response was auto-posted.

**Steps:**
1. Open the SMS or email alert (subject starts with `⚠️` or `🚨`)
2. Click the review link → opens Reputation tab on that review
3. Draft a public response. Best practice:
   - Acknowledge the specific issue, don't deflect
   - Apologize for the experience (not for the review)
   - Offer a concrete fix: refund, replacement, free service
   - Move it private: "DM us at @adultgamenights or text 478-654-9574"
4. Submit the response
5. Then: tag the contact `complaint` and follow up directly

**Speed matters.** Respond within 4 hours for 2-3 star reviews, within 1 hour for 1 star.

---

## Game night service flow

### Confirm a service booking

A contact submitted Form 1 (Game Night Service Booking). Workflow 6 fired automatically:
- Contact tagged `service-booker` + `source-game-night-booking`
- Moved to pipeline `Game Night Service` → stage `Inquiry`
- Sent the confirmation email
- Sent you an SMS with the booking details

**Your job:**
1. Open the contact in CRM → check custom fields:
   - Event Date, Event Address, Event Zip, Package Selection, Headcount, Special Requests
2. If anything is unclear, text or call the customer
3. Once confirmed, send the deposit invoice (use the `Sponsor Pitch` email template as a starting point if no service-specific template exists yet)
4. **Don't move the pipeline stage** until they pay — Workflow 6 handles that automatically when the `deposit-paid` tag is added

---

### Mark a deposit as paid

When the customer pays the 50% deposit:

1. Contact → Tags → add `deposit-paid`
2. Workflow 6 detects this and moves them to `Deposit Paid` stage automatically + sends contract email

If you need to manually move them faster:
- Contact → Opportunities → Game Night Service → drag to `Deposit Paid`

---

### Cancel a booking

Customer wants to cancel:

1. Contact → Tags → add `booking-canceled`
2. Workflow 6 stops sending automated reminders
3. Manually:
   - Move opportunity to `Lost` (or remove from pipeline)
   - If within 14 days: process refund per policy (full refund if 14+ days out, partial 7-14, none < 7)

---

### Day-of arrival ping

Workflow 6 already fired the 1-hour-before SMS automatically. When you actually arrive:

1. Open Conversations → contact thread
2. Use SMS snippet `service_day_of_arrival` ("Outside! Pulling up now 🎲")
3. Send

(If snippets aren't set up yet, just type the message manually.)

---

## Sponsor flow

### Triage a new sponsor inquiry

Form 2 (Sponsorship Inquiry) submitted. Workflow 5 fired:
- Tagged `sponsor-lead` + `source-sponsor-inquiry`
- Moved to `Sponsorship/B2B` → `Lead`
- Sent you an internal email with the details
- Sent the sponsor `sponsor_pitch` email

**Your job (within 24h):**
1. Read the internal email — what business, what products, what budget signals
2. Personal reply (NOT through automation): hit them on email or SMS direct, offer a call
3. Send Calendar 2 booking link: `https://crm.adultgamenights.com/sponsor-call`

The 7-day, 14-day, 28-day automated follow-ups will happen if they ghost.

---

### Move a sponsor to "engaged" status

When a sponsor responds, books a call, or shows clear interest:

1. Contact → Tags → add `sponsor-engaged`
2. Workflow 5 stops the auto follow-ups (you take over)

---

### Sign a sponsor

When a sponsor signs:

1. Contact → Tags → add `signed-sponsor`
2. Workflow 5 moves them to `Signed` pipeline stage automatically + exits the workflow
3. Manually:
   - Send contract via email (PDF attachment in CRM)
   - Schedule kick-off call
   - Add to a future "Active Sponsors" list / dashboard

---

## Content / marketing

### Schedule a social post

7 launch posts are pre-loaded as drafts (from Phase 6 build).

**To post one:**
1. Marketing → Social Planner → Drafts
2. Click the draft
3. Attach a media file (recommendations are in [`config/social-launch-posts.json`](../config/social-launch-posts.json) under `media_recommendation`)
4. Pick the platforms (FB / IG / TT / YT)
5. Schedule date/time OR post now
6. Save

**To create a new post from scratch:**
1. Social Planner → + New Post
2. Select platforms
3. Compose — keep it short, hype, on-brand. Use the voice guide in `config/conversation-ai.json` if you forget.
4. Attach media
5. Schedule

**Voice reminders:**
- Direct, hype, casual
- Drop "vibe" / "pull up" / "fam" once
- Emojis sparingly
- Always offer a CTA (link in bio, link in caption, comment a keyword for auto-DM)
- Never sound corporate

---

### Send a one-off email blast

For announcements outside the automated workflows.

1. Marketing → Emails → + New Campaign
2. Select template OR start from scratch
3. **Audience:** filter contacts (e.g., tagged `buyer`, or all contacts)
4. **From:** verify it's `adultgamenights@gmail.com` (or `@adultgamenights.com` if Mailgun is connected)
5. **Subject:** keep under 50 chars, emoji optional
6. **Body:** use one of the 20 templates as a starting point — copy + customize
7. Schedule send time (avoid 9pm-9am ET — even though email isn't quiet-hours-restricted like SMS, recipients respect the timing)
8. Send

**Anti-pattern:** don't email everyone every week. The KB FAQ "How should the AI assistant respond?" applies to humans too — be hype but not pushy.

---

### Update an email template

The 20 email templates live in CreateOS. Their HTML source files live at `/email-templates/*.html` in this repo.

**To update one:**
1. CreateOS → Marketing → Emails → Templates → click the template
2. Builder → either edit visually OR import HTML
3. **If editing visually:** also update the matching `/email-templates/<name>.html` file in this repo so source-of-truth stays aligned
4. Save

**To create a new template:**
1. Don't do it in the UI first. Add to `/config/email-templates.json` here, write the HTML scaffold using the existing template style (`/scripts/utils/email-template.js`), then run `node scripts/07-create-email-templates.js` — it'll add the stub. Then UI-paste the HTML.

---

### Add a new event landing page

For each new event (after Russell Center July 3):

1. Sites → Funnels → duplicate the existing event funnel template (or build per [`landing-pages/05-events-template.md`](../landing-pages/05-events-template.md))
2. Update merge variables: `event_name`, `event_date`, `event_location`, `event_time`, `event_description`
3. Embed Form 3 (Event Registration), pre-select the new event in the dropdown via URL param
4. Add the event option to custom field "Event Selection" (Custom Fields → Event Selection → add option)
5. Add a tag for the event: `event-{slug}` (e.g., `event-may-22-cookout`)
6. Update Workflow 4 (Event Registration & Follow-Up) if dynamic tag generation isn't auto-handling new options

---

## Customer / contact ops

### Add a contact manually

For walk-ins, phone leads, or referrals:

1. Contacts → + Add Contact
2. Required: First name, last name, email OR phone
3. Source: tag with the right `source-*` tag (`source-event` if from a live event, `source-shopify` if Shopify import, etc.)
4. Save

If you want them in a workflow, add the trigger tag (e.g., `buyer` to fire Post-Purchase Welcome).

---

### Tag a contact

Tags are how everything works in this CRM. The full taxonomy is in [`config/tags.json`](../config/tags.json).

**To tag:**
1. Contact detail → Tags section → start typing → select existing tag
2. Or click "Add tag" → type a new one (only if it doesn't exist; check the taxonomy first)

**Common tags to apply:**
- After a sale: `buyer`, `bought-liquor-store`
- After an event: `event-attendee`, `event-{slug}`
- For VIPs: `vip` (manual judgment call)
- For complaints: `complaint`

---

### Move a contact through a pipeline

Most pipeline movement is automated (workflows handle it). When you need to move someone manually:

1. Contact → Opportunities tab → find the open opportunity
2. Drag the card to the new stage
3. Or click the stage dropdown on the card

**Don't** create a duplicate opportunity — check existing first.

---

### Look up a contact's full history

For "what does this person know about us / what have they bought / etc."

1. Contacts → search → click contact
2. Tabs across the top:
   - **Activity** — every email, SMS, call, conversation
   - **Opportunities** — pipeline history
   - **Tags** — all source/behavior/product/engagement tags
   - **Custom Fields** — Event Date, Headcount, Lifetime Order Value, etc.
   - **Notes** — manually-added notes from you or team

Use this before any high-stakes call (sponsor follow-up, refund discussion, VIP service).

---

## AI agent management

### Pause AI on a single conversation

When you're handling a conversation directly and don't want the AI to interject:

1. Conversation thread → toggle "AI replies" off (top of thread, varies by UI version)
2. The AI stops responding on this thread only — other conversations continue

**Auto-pause:** any conversation tagged `escalate-to-thomas` is auto-paused.

---

### Refresh AI personality after voice samples

When Thomas delivers voice samples + FAQ list, run Pass 2.

Full process: [`docs/pass-2-refresh-instructions.md`](pass-2-refresh-instructions.md)

Quick version:
```bash
cd /Users/reecebyob/adult-game-nights-build
# Drop voice samples in inputs/voice-samples/
# Save FAQ list to inputs/faqs.md
node scripts/16-refresh-agent-personality.js
# Then paste the generated prompts into Voice AI + Conversation AI in UI
```

---

### Update an FAQ in the knowledge base

If you find the AI giving a bad answer to a question, fix the KB.

**Option A — UI:**
1. CreateOS → AI / Knowledge Bases → Adult Game Nights Master KB → FAQs
2. Find the question, edit the answer, save
3. Both Voice AI and Conversation AI pick up the update on their next response — no rebuild needed

**Option B — Code (better for tracked changes):**
1. Edit `config/knowledge-base.json` — find the FAQ, update the answer
2. Delete the existing FAQ via UI (script doesn't auto-update answers, only inserts)
3. Re-run `node scripts/13-create-knowledge-base.js` — idempotent insert

For bulk updates, the Pass 2 refresh script handles `frequently_asked` and `tone_brand` topics.

---

## Maintenance

### Re-auth a social account

OAuth tokens expire. Schedule:
- Facebook + Instagram: every 60 days
- TikTok: every ~365 days
- YouTube: every ~30 days (the short one)

**To re-auth:**
1. Settings → Integrations → Social Planner
2. Find the platform with a warning indicator
3. Click **Reconnect** → walk through the OAuth flow
4. Done

**Set calendar reminders:** the day before each token expires, you'll get a CreateOS notification, but a manual calendar reminder ~5 days out is safer.

---

### Update the discount code

Two codes live in the system: `PLAY10` (cart recovery, 10% off) and `WELCOMEBACK` (reactivation, 15% off).

**To rotate:**
1. Edit `config/custom-values.json` — change `value` for the right entry
2. Run `node scripts/11-create-custom-values.js` (idempotent — won't duplicate, won't update existing)

**Limitation discovered:** the create-custom-values script doesn't UPDATE existing values, only creates. To actually update:
- UI: Settings → Custom Values → click the value → edit → save
- All emails using `{{ custom_values.cart_recovery_discount_code }}` automatically use the new code on next send

Make sure to also update the actual checkout-side discount on Shopify so codes match.

---

### Run the build scripts

If you ever need to re-run a build script (after a CreateOS change, or to verify nothing drifted):

```bash
cd /Users/reecebyob/adult-game-nights-build

# Verify credentials still work
node scripts/00-verify-credentials.js

# Re-create custom fields (idempotent — skips existing)
node scripts/01-create-custom-fields.js
node scripts/05-create-form-custom-fields.js

# Re-create tags
node scripts/02-create-tags.js

# Re-create calendars + blockouts
node scripts/04-create-calendars.js

# Refresh email template stubs
node scripts/07-create-email-templates.js

# Refresh custom values
node scripts/11-create-custom-values.js

# Refresh KB FAQs
node scripts/13-create-knowledge-base.js
node scripts/14-test-knowledge-base.js   # sanity check

# Re-seed social launch posts (only if drafts deleted)
node scripts/18-seed-social-posts.js

# Endpoint probe (run after any OAuth flow completes — flips 403→200)
node scripts/12-probe-ai-endpoints.js
node scripts/17-probe-phase6-endpoints.js
```

All scripts are idempotent and safe to re-run.

---

## Emergency contacts

| Issue | Contact |
|---|---|
| AI agent saying something wrong | Update the relevant KB FAQ (Update an FAQ section above) |
| Workflow stuck / not firing | Maurice — `info@byobseries.com` |
| OAuth expired in CreateOS | Re-auth in Settings → Integrations |
| Critical 1-star review | Drop everything, respond within 1 hour |
| Lost product price decision needed | Read [`docs/product-pricing-flag.md`](product-pricing-flag.md) |
| GHL platform down / API errors | Status page: `status.gohighlevel.com` |

---

## Where to find everything

| What | Where |
|---|---|
| This manual | `/docs/operations-manual.md` |
| Build state | `/README.md` |
| Phase reports | `/docs/phase-N-completion-report.md` |
| API quirks (when something breaks) | `/docs/api-reference.md` |
| Tags taxonomy | `/config/tags.json` |
| Custom fields | `/config/custom-fields.json` + `/config/custom-fields-forms.json` |
| Email subject + preview text | `/config/email-templates.json` |
| Email HTML bodies | `/email-templates/*.html` |
| AI agent specs | `/config/voice-ai-agent.json`, `/config/conversation-ai.json`, `/config/reviews-ai.json` |
| Knowledge base content | `/config/knowledge-base.json` |
| Workflow specs | `/config/workflows.json` |
| Build logs | `/logs/build-log.json` |
| Error logs | `/logs/errors.json` |
