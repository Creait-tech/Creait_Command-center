# Internal Notifications — 11 triggers

**GHL Path:** Settings → Notifications (for configuration) + inside each workflow (for triggers)

Every notification goes to **Dustin (SMS + in-app)** and **Assistant (in-app only)** unless noted. The goal is to keep Dustin informed in real time without fragmenting his attention.

---

## The 11 triggers

### Notification #1 — New Lead Received

**Fires in:** WF1 (after opportunity created)
**Channel:** SMS to Dustin + in-app to both
**Copy:**
```
New lead: {{contact.full_name}}. Source: {{source}}. Occasion: {{contact.occasion}}. Budget: {{contact.budget_range}}.
```

---

### Notification #2 — Consultation Booked

**Fires in:** WF2 (after appointment confirmation)
**Channel:** SMS to Dustin + in-app to both + **Google Calendar invite auto-added**
**Copy:**
```
Consult booked: {{contact.first_name}} {{contact.last_name}} — {{appointment.start_time_formatted}}. Budget: {{contact.budget_range}}. Occasion: {{contact.occasion}}.
```

---

### Notification #3 — No-Show

**Fires in:** WF3 (immediate on no-show)
**Channel:** SMS to Dustin
**Copy:**
```
No-show: {{contact.first_name}} {{contact.last_name}} missed their consult. Personal outreach recommended within 24h.
```

---

### Notification #4 — Fabric Approval Required

**Fires in:** Triggered by custom field `fabric_selected` populated but `fabric_approved` still false after 48h
**Channel:** In-app to Dustin + assistant
**Copy:**
```
{{contact.first_name}} selected fabric but hasn't confirmed digitally. Follow-up needed.
```

---

### Notification #5 — Payment Received

**Fires in:** WF6B
**Channel:** SMS to Dustin + in-app to both
**Copy:**
```
Payment received: ${{payment.amount}} from {{contact.first_name}} {{contact.last_name}}. Stage: {{opportunity.stage}}. Receipt auto-sent.
```

---

### Notification #6 — Delivery Complete

**Fires in:** WF10 (Day 1 of post-delivery)
**Channel:** In-app to both
**Copy:**
```
Delivered: {{contact.first_name}} {{contact.last_name}}. Post-delivery sequence now active. Review for VIP eligibility at Day 30.
```

---

### Notification #7 — Production Started

**Fires in:** WF5 (on pipeline stage = In Production)
**Channel:** In-app to assistant + Dustin
**Copy:**
```
Production started: {{contact.first_name}}. Expected delivery: {{custom_fields.expected_delivery_date}}. Fabric: {{custom_fields.fabric_selected}}.
```

---

### Notification #8 — Stale Deposit

**Fires in:** WF6A Day 7
**Channel:** SMS to Dustin
**Copy:**
```
Deposit stale: {{contact.first_name}} has not paid deposit 7 days after request. Personal call recommended.
```

---

### Notification #9 — Stale Final Balance

**Fires in:** WF6C Day 5
**Channel:** SMS to Dustin
**Copy:**
```
Final balance stale: {{contact.first_name}}. Garment held 5 days past final fitting without payment.
```

---

### Notification #10 — Lead Went Cold

**Fires in:** WF1 or WF9 (on adding `Went Cold` tag)
**Channel:** In-app to Dustin only
**Copy:**
```
{{contact.first_name}} {{contact.last_name}} marked Went Cold after no reply through re-engagement. Source: {{source}}.
```

---

### Notification #11 — Birthday / Referral / AI Handoff (grouped)

**Fires in:** WF11 (birthday), WF10 Day 15 referral form submit, AI Handoff Requested tag
**Channel:** SMS to Dustin (handoff), in-app (birthday, referral)

**Handoff copy:**
```
AI handoff: {{contact.first_name}} requested direct conversation. Jump into inbox thread {{conversation_url}}.
```

**Referral copy:**
```
Referral submitted by {{referrer.name}}: {{new_contact.first_name}} — {{occasion}}. WF1 triggered.
```

**Birthday copy:**
```
Birthday today: {{contact.first_name}} {{contact.last_name}} (VIP: {{is_vip}}). Handwritten note recommended.
```

---

## Notification hygiene rules

1. **SMS is for action-required notifications only.** #1, #2, #3, #5, #8, #9, #11 (handoff). Everything else is in-app.
2. **Mute notifications during consultations.** GHL supports DND windows — configure Tue–Sat, any blocks when Dustin is in a booked consult.
3. **Assistant gets in-app for everything, SMS for none.** Assistant doesn't need to be woken up; she checks the app.
4. **Daily digest email** (separate, lightweight workflow): Every morning at 8 AM, email Dustin a one-paragraph summary of: new leads yesterday, bookings today, outstanding deposits, and any Went Cold flags. This replaces half the need for real-time notifications.

---

## Assistant vs. Dustin routing matrix

| Task | Assistant | Dustin |
|---|---|---|
| First reply to new lead (within 4h) | Primary | Fallback if assistant unavailable |
| Consult confirmation / reschedule coordination | Primary | — |
| Fabric approval chase | Primary | — |
| Personal "handwritten" follow-up | — | Primary |
| No-show recovery call | — | Primary |
| VIP/Delivered client contact | — | Always Dustin |
| Complaint or issue | — | Always Dustin |
| Birthday note | — | Dustin writes, assistant mails |

Codify this in Dustin's internal SOP. The AI Concierge and notifications only route signal — the humans have to execute consistently.
