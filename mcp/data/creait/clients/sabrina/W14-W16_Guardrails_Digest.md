# W14 — Reply-Stop Guardrail (THE most important workflow)

**Trigger:** Inbound message received (email, SMS, IG DM, FB Messenger, WhatsApp, web chat)

**Sabrina's exact words:** *"Or they say, I replied to that. Why do you keep sending me?"*

## Steps

1. **Check if sender is in a contact record** (match by channel identifier)
2. If yes:
   - Apply tag `flag:reply-stop`
   - Remove ALL tags matching `seq:*` (exits every sequence they're in)
   - Create internal task for Sabrina: "Reply received from {{contact.name}} — check conversation"
   - Send Sabrina SMS alert (during business hours only: 8 AM–8 PM CT)
3. If no (unknown sender):
   - Create contact with `source:inbound-cold`
   - Route to AI chat agent for qualification (W23)

## Manual Resume
- Sabrina can click "Resume nurture" in contact card → removes `flag:reply-stop` + re-applies appropriate `seq:*` tag

## Edge Cases
- **Auto-replies** ("Out of office" etc.) — regex filter detects common OOO patterns and DOES NOT apply reply-stop
- **"STOP" or "UNSUBSCRIBE" keyword on SMS** — W15 handles (hard unsubscribe, stronger than reply-stop)

---

# W15 — Unsubscribe Handler

**Triggers:**
- SMS keyword: `STOP`, `UNSUB`, `UNSUBSCRIBE`, `END`, `QUIT`, `CANCEL`
- Email: unsubscribe link click

## Steps
1. If SMS trigger: apply tag `unsubscribed:sms`, remove `consent:sms-marketing`
2. If Email trigger: apply tag `unsubscribed:email`, remove `consent:email-marketing`
3. Remove all `seq:*` tags
4. Send confirmation message on the same channel:
   - SMS: `"You're unsubscribed from Franklin Insurance Solutions SMS. Reply START to rejoin."`
   - Email: standard GHL unsubscribe confirmation page
5. Log unsubscribe event + timestamp + reason (if captured)
6. **Do not** notify Sabrina in real time (she asked not to get nuisance alerts); include in daily digest (W16)

---

# W16 — Daily Digest to Sabrina

**Trigger:** Schedule — 7:00 AM CT every day (weekdays only; weekend sends a Saturday morning lighter version)

**Why:** Sabrina said she's afraid of automations running silently. This is her daily proof that the machine is working *and* where she needs to jump in.

## Digest Email Contents

```
Good morning Sabrina,

Here's what the system did for you in the last 24 hours.

🆕 NEW LEADS ({{count}})
- {{name}} — {{product}} — {{source}} — [view in GHL]
- ...

💬 REPLIES NEEDING YOU ({{count}})
- {{name}}: "{{message_preview}}" — [reply]
- ...

💰 QUOTES AGING ({{count}})
- {{name}} — quoted {{days_ago}} days ago, no reply yet — [nudge]
- ...

📆 TODAY'S CALENDAR
- {{time}} — {{event}} — {{contact}}
- ...

🔔 COMMISSION WATCH
- Bound yesterday: {{count}} policies, ${{total_premium}} premium, est ${{total_commission}}

📉 UNSUBSCRIBES ({{count}})
- {{name}} — {{channel}} — {{reason_if_captured}}

🤖 AI AGENT HANDLED
- {{count}} calls answered, {{count}} DMs replied, {{count}} qualified leads created for you
```

## Sabrina-Adjustable Settings
- Quiet mode: skip digest on weekends she's off
- Alert mode: urgent-only (ignore routine, only email on aging quotes or high-value leads)
