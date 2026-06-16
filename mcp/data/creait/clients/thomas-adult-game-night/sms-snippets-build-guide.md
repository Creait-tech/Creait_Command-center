# SMS Snippets — Manual Build Guide

**Why manual:** `POST /locations/{id}/templates` returns 401 with our PIT. Must be created in CreateOS UI.

**Build path:** **Settings → Snippets → + New Snippet** (or **Conversations → ⚙ → Snippets** depending on UI version)

For each snippet below:
1. Type: **SMS**
2. Name: use the `internal_name`
3. Body: paste verbatim from `/config/sms-templates.json`
4. Save and capture the snippet ID

After all 8 snippets exist, run:
```bash
node scripts/08-fetch-sms-snippet-ids.js  # built in Phase 4
```

---

## Quiet Hours
All SMS workflows must enforce quiet hours: **9am–9pm America/New_York**. Configure at the workflow level (Phase 4) — set "Send during business hours only" with these bounds.

## TCPA Compliance Checklist (CRITICAL for the 15K legacy phone list)
- [ ] Confirm prior business relationship for each number before any send
- [ ] First send to legacy list MUST be the `reactivation_sms` (re-permission)
- [ ] All marketing SMS must include "STOP to opt out" or rely on platform-level handling
- [ ] Capture opt-outs: keyword `STOP` → tag `unsubscribed`, suppress all future sends
- [ ] Capture opt-ins: keyword `YES` from `reactivation_sms` → tag `sms-opted-in`
- [ ] Any number without explicit opt-in goes into manual review queue, not automated drips

## Templates

### 1. `cart_abandonment_sms` (145 chars)
> Hey {{contact.first_name}} — left your game night essentials behind 👀 Code PLAY10 for 10% off if you finish up tonight: {{cart_url}}

**Workflow trigger:** Cart abandoned 24hr+ ago, contact has SMS opt-in tag

### 2. `order_confirmation_sms` (138 chars)
> Yo {{contact.first_name}}! Your Liquor Store game is locked in 🎲 Order #{{order_number}}. Tracking soon. Pull up the app: {{app_link}}

**Trigger:** Shopify order webhook → workflow

### 3. `service_booking_confirmation_sms` (121 chars)
> 🎉 You're booked for {{event_date}}! Confirmation email on the way. Hit Thomas at 478-654-9574 if you need anything.

**Trigger:** Form 1 submission

### 4. `service_reminder_1hr` (100 chars)
> {{contact.first_name}} — on my way! ETA 30 min. Hit me if y'all need anything: 478-654-9574 🚗

**Trigger:** 1hr before scheduled service start

### 5. `service_day_of_arrival` (27 chars)
> Outside! Pulling up now 🎲

**Trigger:** Manual — Thomas fires from app/dashboard on arrival

### 6. `event_reminder_1d_sms` (116 chars)
> {{contact.first_name}} — tomorrow's the day! {{event_name}} at {{event_location}}, {{event_time}}. Pull up 🔥

**Trigger:** 24hr before event start

### 7. `review_request_sms` (112 chars)
> Hope the game night was lit 🎲 Quick favor — drop a review? {{review_link}} 5% off your next order on us 🙏

**Trigger:** 7 days after purchase or event attendance

### 8. `reactivation_sms` (124 chars) — **TCPA-CRITICAL**
> Hey! It's Thomas from Adult Game Nights. Big things happening — wanna stay in the loop? Reply YES, or STOP to opt out.

**Trigger:** Manual one-time blast to legacy 15K list. Must process YES/STOP responses.
