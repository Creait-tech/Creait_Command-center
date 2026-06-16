# AI Workflow Builder — Paste-Ready Prompts (Batch)

**Use:** Workflows → Create Workflow → **Build Using AI** → paste prompt → Submit.

Each prompt is calibrated to:
- Stay under the AI Builder's ~4-node ceiling per build (so it doesn't truncate)
- Use real existing tags + templates only (no hallucinations to fix afterwards)
- Be the MVP version — Sprint 2 extensions can come later
- Have a clear stop condition

After each AI build, **verify**:
1. Subject lines match Thomas's voice (rewrite anything corporate)
2. Email template is set to "Quick compose" with the body shown, OR a linked template
3. SMS Internal Notification goes to **+14049542115** (Thomas) — NOT to the contact
4. Tags + statuses fire correctly

---

## 1. Repeat Buyer VIP Tier

**Workflow ID exists:** `442566a7-788e-4e39-8f1a-2e5599c07929` (already named, empty canvas — extend manually OR delete and rebuild via AI Builder prompt below).

```
Workflow name: Repeat Buyer VIP Tier. Trigger: contact gets the tag 'buyer' added, with a filter that the contact MUST already have the tag 'bought-liquor-store' (i.e., this is their second or later purchase). Step 1: Add the tags 'repeat-buyer' and 'vip' to the contact. Step 2: Send a quick compose email with subject "🎲 You're family now — VIP perks unlocked" and body: "Yo {{contact.first_name}} — that's two games. You officially family. We're flagging you for early access on the next drop (Smoking Section pre-order is coming), free shipping for life, and dibs on event tickets before they go public. We'll be in touch. Pull up. — Thomas / AGN. AND AS ALWAYS, DRINK RESPONSIBLY." Step 3: Send Internal SMS Notification to phone number +14049542115 with text: "🔥 VIP UPGRADE — {{contact.first_name}} {{contact.last_name}} ({{contact.email}}) just made their 2nd purchase. Hit them with a thank-you call." Step 4: End the workflow. Stop conditions: tag 'unsubscribed'. Do NOT include any if/else branches. Keep flat and linear.
```

---

## 2. Win-Back at 90 Days

**Why:** Existing buyer with no repeat purchase. Drives the biggest lift in repeat-buy rate.

**Prereqs (verify before firing):**
- `lapsed-90d` tag exists ✓ (confirmed in audit)

```
Workflow name: Win-Back at 90 Days. Trigger: contact gets the tag 'buyer' added. Filter: contact does NOT have the tag 'repeat-buyer' AND does NOT have the tag 'unsubscribed'. Step 1: Wait 90 days. Step 2: Send a quick compose email with subject "Yo — you good?" and body: "Hey {{contact.first_name}} — been a minute. Just checking in. The Liquor Store game treating you right? We got new drops cooking. If you ready for round 2, code WELCOME15 gets you 15% off through Friday: https://adultgamenights.com. If you not feeling us anymore, no hard feelings, just hit unsubscribe. — Thomas. AND AS ALWAYS, DRINK RESPONSIBLY." Step 3: Wait 14 days. Step 4: Add the tag 'lapsed-90d'. Step 5: End the workflow. Stop conditions: tag 'unsubscribed' OR tag 'repeat-buyer'. Do NOT include any if/else branches. Keep flat and linear.
```

⚠️ **Manual finishing if AI cuts off:** if AI only builds first 4 nodes (Wait → Email → Wait → END), manually insert "Add Tag 'lapsed-90d'" between the final Wait and END via the + button.

---

## 3. Birthday Reactivation

**Prereqs:**
1. Add a custom field `birth_date` (type: DATE) via Settings → Custom Fields. Required FIRST.
2. Once contacts have a populated birth_date, this fires annually.

```
Workflow name: Birthday Reactivation. Trigger: contact's custom field 'birth_date' matches today's date (month + day). Filter: contact does NOT have the tag 'unsubscribed'. Step 1: Send a quick compose email with subject "🎲 Happy birthday — game night's on us" and body: "Happy birthday {{contact.first_name}}! Throw a real one this year. Code BDAY20 gets you $20 off the Liquor Store game (or anything else) — expires in 7 days. https://adultgamenights.com. — AGN. AND AS ALWAYS, DRINK RESPONSIBLY." Step 2: Send SMS to contact with text: "Happy birthday {{contact.first_name}} 🎲 BDAY20 = $20 off this week. Pull up: https://adultgamenights.com." Step 3: Add the tag 'birthday-promo'. Step 4: End workflow. Do NOT include any if/else branches.
```

⚠️ **Heads up:** SMS step only fires if contact opted into SMS. Otherwise, just email fires.

---

## 4. Smoking Section Pre-Order Drip

**Why:** Pre-order buyers need to stay warm so they don't refund. The `smoking-section-pre-order` tag already exists ✓.

**MVP version — single welcome email. Multi-month nurture is a content-debt task for Sprint 2.**

```
Workflow name: Smoking Section Pre-Order Welcome. Trigger: contact gets the tag 'smoking-section-pre-order' added. Step 1: Send a quick compose email with subject "🚬 You're locked in for The Smoking Section" and body: "Bet, {{contact.first_name}} — pre-order confirmed. The Smoking Section is the smoke-themed expansion of Adult Game Nights. Same chaos energy, new cards, new minigames, new ways to roast your friends. Expected ship: Q3 2026. You're getting yours first — before public launch. We'll send monthly behind-the-scenes drops + the tracking number the day it ships. Stay locked. — AGN. AND AS ALWAYS, DRINK RESPONSIBLY." Step 2: End workflow. Stop conditions: tag 'unsubscribed' OR tag 'refunded'. Keep flat and linear.
```

---

## 5. Sponsor Pipeline B2B (Tier 2.3)

**Prereqs (build FIRST):**
1. "Sponsorship/B2B" pipeline (4 stages: Lead → Pitched → Negotiating → Signed). Build via Settings → Pipelines → Create Pipeline.
2. "Sponsorship Inquiry" form via Sites → Forms (fields: First Name, Last Name, Business Name, Email, Phone, Products to Sponsor, Budget Range dropdown, Timeline). Form on submit: add tag `sponsor-lead` + `source-sponsor-inquiry`, pipe to Sponsorship/B2B → Lead stage.
3. Sponsor Pitch email template (currently a scaffold — paste branded HTML before workflow goes live).

```
Workflow name: Sponsor Pipeline B2B. Trigger: form submitted, form is "Sponsorship Inquiry". Step 1: Send Internal Email Notification to adultgamenights@gmail.com with subject "🎯 New sponsor inquiry: {{contact.first_name}} {{contact.last_name}}" and body: "New sponsor inquiry from {{contact.first_name}} {{contact.last_name}} ({{contact.email}} / {{contact.phone}}). Business: {{custom_values.business_name}}. Products to sponsor: {{custom_values.products_to_sponsor}}. Reply within 24h." Step 2: Send the contact the email template named 'Sponsor Pitch'. Step 3: Wait 7 days. Step 4: End workflow. Stop conditions: tag 'sponsor-engaged' OR tag 'signed-sponsor' OR tag 'unsubscribed'. Do NOT include any if/else branches. Keep flat and linear.
```

⚠️ **Manual extension after this builds:** if Thomas wants the 7d/14d follow-up emails per the original spec, add them via + button after AI build.

---

## 6. Event Registration & Follow-Up — General (Tier 2.4)

**Prereqs:**
1. General "Event Registration" form (per spec in `config/forms.json`). Different from the Luma-specific one already built.
2. `event_reminder_7d`, `event_reminder_1d`, `post_event_thank_you` email templates need branded HTML (currently scaffolds).

**MVP version (skips date-relative reminders, which need event_date custom field consistently populated):**

```
Workflow name: Event Registration General. Trigger: form submitted, form is "Event Registration". Step 1: Add the tags 'source-event' and 'event-attendee'. Step 2: Move contact to pipeline 'Event Attendees', stage 'Registered'. Step 3: Send a quick compose email with subject "You're locked in 🎲" and body: "Bet {{contact.first_name}} — you're on the list for {{custom_values.event_name}}. We'll text you the day before with the time + address. Pull up. — AGN." Step 4: End workflow. Stop conditions: tag 'unsubscribed'. Do NOT include any if/else branches.
```

⚠️ **Sprint 2 extension:** Date-relative reminders (-7d / -1d / day-of) require `event_date` custom field to be reliably populated by every Event Registration form submission. Wire via form field mapping when full event flow is built.

---

## 7. Refer-a-Friend Engine (Tier 3.3)

**Why:** Lowest-cost acquisition channel. Referrals convert 4x cold ads. $10 credit per referral is wildly profitable on a $34 product. Original Sprint 1.5 plan called this out but it never got built.

**Prereqs (build first):**
1. Custom field `referral_code` (text) — auto-generated per buyer (e.g., last 6 chars of contact ID)
2. Custom field `referred_by` (text) — populated when a new contact comes in via `?ref=ABC123` URL param
3. Custom field `referral_credit_balance` (number) — increments by 10 each successful referral

```
Workflow name: Refer-a-Friend Engine. Trigger: contact gets the tag 'bought-liquor-store' added. Filter: contact does NOT have tag 'referrer-active' AND does NOT have tag 'unsubscribed'. Step 1: Wait 14 days. Step 2: Send a quick compose email with subject "🎲 Pull up — your $10 referral move" and body: "Yo {{contact.first_name}} — quick one. Send the game to one friend. When they buy, you get $10 store credit, they get 15% off. Easy. Your link: https://adultgamenights.com/?ref={{contact.id}} Share that anywhere — IG, text, group chat, wherever. We track it. — AGN. AND AS ALWAYS, DRINK RESPONSIBLY." Step 3: Add the tag 'referrer-active'. Step 4: End the workflow. Stop conditions: tag 'unsubscribed'. Do NOT include any if/else branches. Keep flat and linear.
```

**Companion workflow** — fires when a NEW buyer with a referrer comes in (build separately):

```
Workflow name: Referral Credit Awarded. Trigger: tag 'buyer' added. Filter: custom field 'referred_by' is not empty. Step 1: Find the referrer contact by ID from custom field 'referred_by' (use Find Contact action). Step 2: Increment that referrer's 'referral_credit_balance' custom field by 10. Step 3: Send the referrer an email with subject "💰 Your $10 just dropped" and body: "Yo {{referrer.first_name}} — your friend just pulled up off your link. $10 credit's in your pocket. Cash it on the next drop. — AGN." Step 4: Add tag 'referrer-cash-earned' to the referrer. Step 5: End. Stop conditions: tag 'unsubscribed'.
```

⚠️ **Manual extension needed:** The "Find Contact by Custom Field" action may not exist in the AI Builder. If the AI Builder can't wire the referrer lookup, build that step manually via the + node → Find Contact → Search by Custom Field.

⚠️ **Url referral capture:** the homepage / Shopify needs JavaScript that reads `?ref=` from URL → passes it into the form submission as the `referred_by` field. That's a Shopify dev task — document it in `docs/SHOPIFY-REF-CAPTURE-SNIPPET.md` (not in this batch).

---

## 8. Event Registration General (Tier 2.4)

**Why:** Thomas runs recurring events (Russell Center July 3, Luma May 15 already done, more coming). Reusable workflow for any future event form submission.

**Prereqs:**
1. Build "Event Registration" form via Sites → Forms (per `config/forms.json`). General form, not Luma-specific.
2. Email scaffolds for `event_reminder_7d`, `event_reminder_1d`, `post_event_thank_you` — ✅ NOW LIVE with branded HTML (pushed via API 2026-05-25)

```
Workflow name: Event Registration General. Trigger: form submitted, form is "Event Registration". Step 1: Add the tags 'source-event' and 'event-attendee'. Step 2: Move contact to pipeline 'Event Attendees', stage 'Registered'. Step 3: Send the contact the email template named 'Event Reminder 7d'. Step 4: Send a quick compose email with subject "You're locked in 🎲" and body: "Bet {{contact.first_name}} — you're on the list for {{custom_values.event_name}}. We'll text you the day before with the time + address. Pull up. — AGN." Step 5: End workflow. Stop conditions: tag 'unsubscribed'. Do NOT include any if/else branches.
```

⚠️ **Sprint 2 extension:** Date-relative reminders (-7d / -1d / day-of) require `event_date` custom field to be reliably populated by every Event Registration form submission. Wire via form field mapping when full event flow is built.

---

## Order to fire these

1. **Repeat Buyer VIP** (no prereqs — fire today)
2. **Smoking Section Pre-Order Welcome** (no prereqs — fire today)
3. **Win-Back at 90 Days** (no prereqs — fire today)
4. **Birthday Reactivation** (add `birth_date` custom field FIRST)
5. **Sponsor Pipeline B2B** (build Sponsorship/B2B pipeline + form FIRST — see `docs/SPONSOR-B2B-BUILD-SPEC.md`)
6. **Event Registration General** (build form FIRST)
7. **Refer-a-Friend Engine** (add `referral_code` + `referred_by` + `referral_credit_balance` custom fields FIRST)
8. **Referral Credit Awarded** (build after #7)

Workflows 1, 2, 3 = batch-fire in ~10 min total. 4-8 each have prereqs.

---

## After firing each workflow

1. Click each action node, verify config (template binding, custom number for SMS, etc.)
2. Replace any generic AI-written subjects with Thomas's voice
3. Set Internal Notification "To User Type" → "Custom Number" → `+14049542115`
4. Save → flip Draft to Publish toggle at top right

---

**Date:** 2026-05-25
**Author:** Maurice / CREAIT
