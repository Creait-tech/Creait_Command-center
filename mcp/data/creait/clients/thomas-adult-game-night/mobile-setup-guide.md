# Mobile Setup Guide

**Audience:** Thomas (and any team member who runs the business from mobile).
**Goal:** Get the GHL/CreateOS mobile experience running so push notifications hit immediately.

Thomas runs the business on his phone. This is non-optional infrastructure.

---

## Step 1 — Install the LeadConnector app

CreateOS is a white-label of GoHighLevel. The mobile app is called **LeadConnector**.

**iOS:** App Store → search "LeadConnector" → install
**Android:** Google Play → search "LeadConnector" → install

Some white-label deployments rebrand the mobile app. If LeadConnector doesn't show your data after login, ask Maurice — there may be a CREAIT-branded version.

---

## Step 2 — Log in

Same credentials as the web CRM (`crm.adultgamenights.com`). If 2FA is enabled, the code goes to your authenticator app or SMS.

---

## Step 3 — Configure push notifications

Settings (within the mobile app) → Notifications. Enable for:

| Notification type | Recommended |
|---|---|
| New conversation message | ✅ ON |
| Escalation tagged `escalate-to-thomas` | ✅ ON (critical) |
| New service booking inquiry | ✅ ON |
| New sponsor inquiry | ✅ ON |
| Negative review (≤3 stars) | ✅ ON (critical) |
| New Shopify order | ✅ ON |
| Cart abandonment recovered | 🟡 OPTIONAL (high volume) |
| Daily snapshot report | 🟡 OPTIONAL (the email is enough) |
| Workflow errors | ✅ ON |

Critical-priority notifications should bypass Do Not Disturb. iOS: Settings → Focus → exempt LeadConnector. Android: Notification channel → set as Priority.

---

## Step 4 — Pin the dashboard tile shortcut

The dashboard's mobile view shows 5 tiles (per [`docs/phase-7-dashboard-spec.md`](phase-7-dashboard-spec.md)):
1. Escalations
2. Today's services
3. Negative reviews
4. Cart recovery rate
5. Revenue MoM

In LeadConnector → Dashboard → set "Thomas's Daily View" as the default landing screen.

---

## Step 5 — Quick-actions widgets

Most-used mobile actions (one-tap from the home tab):

| Action | Why |
|---|---|
| Send SMS to a contact | When you're between gigs and need to confirm details fast |
| Move a contact in pipeline | Mark `deposit-paid` after a transfer hits, mark `service-completed` after the event |
| Add a quick note | Capture details from a phone call without losing them |
| Pause AI on a thread | When a conversation needs you personally, kill the bot for that thread |
| Reply to an escalation | Respond from anywhere |

Pin these as quick-access shortcuts if the app supports it.

---

## Step 6 — Test it

1. From a different phone, text the AGN number with "How much is the game?"
2. Voice/Conversation AI responds (you should NOT get a notification — AI is handling it)
3. From the same phone, reply: "Speak to Thomas"
4. AI escalates → tag `escalate-to-thomas` applied
5. Your phone should buzz within 30s with a critical-priority push
6. Open notification → opens directly to that conversation thread

If steps 5-6 don't fire, check notification permissions and Conversation AI escalation settings.

---

## Step 7 — Field play tips

When Thomas is at an event hosting:
- LeadConnector running in background
- Phone in pocket on vibrate, but critical alerts override
- Between rounds: pull up the daily dashboard, glance, pocket
- After the event: post-event recap email + photo upload to Media Library all done from mobile

When Thomas is between gigs (driving, in stores, errands):
- Voice AI handles every inbound call
- Conversation AI handles every inbound DM/SMS
- Push notifications only for things that need YOU
- Reply via SMS shortcut without opening the app fully

---

## Backup plan: SMS-only

If the mobile app misbehaves (bad cell, app crash), the system also sends critical alerts as plain SMS to 478-654-9574:

| Event | SMS template |
|---|---|
| Escalation needed | `🚨 Conversation needs your attention: {name} ({phone}) — '{excerpt}' — channel: {channel}` |
| Negative review | `⚠️ {rating}-star review from {name}: '{excerpt}' — Thomas, take a look: {review_url}` |
| New service booking | `🎲 New game night booking from {name} for {event_date}. Check the CRM.` |
| New sponsor lead | `🎯 Sponsor lead — {business_name} interested in {products}` |
| Critical 1-star review | `🚨🚨 1-STAR review from {name} — RESPOND TODAY: {review_url}` |

If you only have SMS access (no data), reply directly to the SMS to keep moving. CRM auto-logs your reply against the contact.

---

## Web fallback

If the mobile app is broken, web works. `crm.adultgamenights.com` on mobile Safari/Chrome is functional — not as fast, but you can do everything.

---

## Charging routine for events

Phone hosting + Restream + photos + lots of notifications = battery drain. Setup:
- Power bank in the gear bag (10K mAh+)
- Cable for fast charging (USB-C PD or Lightning)
- Set the phone to Low Power Mode after the event ends if traveling long distances
- For on-stage hosting: keep phone on a stand near the QR code wall, plugged in

---

## Maurice's note

> "Most clients we set up never install the mobile app and wonder why they miss things. Don't be that. Get the app, turn on the right notifications, test it once. Takes 10 minutes. Saves you customers."
