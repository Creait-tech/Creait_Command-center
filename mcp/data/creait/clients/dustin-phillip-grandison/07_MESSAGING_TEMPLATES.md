# Messaging Templates — SMS + Email library

**GHL Path:** Marketing → Templates → + New Template

Organize into 5 folders: **Welcome / Appointments / Payments / Follow-Up / Retention**. Each template is used inside one or more workflows — workflow file (09) references them by name.

**Tone law:** Polished, professional, personable. Luxury without stiffness. Never discount, never urgent, never exclamation-heavy. Read every message out loud before saving — if it doesn't sound like Dustin at a cocktail party, rewrite it.

---

## Folder 1 — WELCOME (4 templates)

### T1.1 — Welcome SMS (WF1, 2-min delay)

```
{{contact.first_name}}, this is Dustin from Dustin's Bespoke. I saw your inquiry come through and wanted to personally reach out. We specialize in crafting custom suits that make a statement before you say a word.

I'd love to learn what brought you to us. When's a good time to connect?
```

### T1.2 — Welcome Email (WF1)

**Subject:** A note from Dustin

```
{{contact.first_name}},

Thank you for reaching out. Your inquiry just came across my desk.

My work sits at the intersection of craftsmanship and intention — every commission I take on is built around the man who'll wear it, the moments he'll wear it for, and the impression he wants to leave behind.

A few things I'll want to understand as we move forward:

– The occasion or vision behind the commission
– Your timeline (especially if there's an event on the horizon)
– Any past experiences with bespoke or made-to-measure
– How you prefer to be in touch

You mentioned this is for {{contact.occasion}} — I'd love to hear more.

If you'd like to move directly into booking a private consultation, you can use this link: {{custom_values.booking_consultation_url}}

Otherwise, I'll be in touch personally within the next few hours.

A glimpse of recent work: {{custom_values.lookbook_url}}

— Dustin
{{custom_values.business_name}}
{{custom_values.business_phone}}
```

### T1.3 — No-Reply Check-In SMS (WF1, 48h if no reply)

```
{{contact.first_name}}, Dustin here — just circling back on your inquiry from a couple days ago. No pressure at all if the timing isn't right, but I wanted to make sure my message didn't get buried. 

Still happy to have a conversation whenever you are.
```

### T1.4 — AI Handoff SMS (when AI escalates to Dustin)

```
{{contact.first_name}}, Dustin here — stepping in personally on your conversation. Give me a moment to catch up on everything we've discussed and I'll be right back to you.
```

---

## Folder 2 — APPOINTMENTS (6 templates)

### T2.1 — Consult Confirmation SMS (WF2)

```
{{contact.first_name}}, your private consultation at Dustin's Bespoke is confirmed for {{appointment.start_time_formatted}}. We've reserved this time exclusively for you.

Studio: {{custom_values.studio_address}}

Looking forward to crafting something exceptional together.

— Dustin
```

### T2.2 — Consult Confirmation Email (WF2)

**Subject:** Your consultation is confirmed, {{contact.first_name}}

```
{{contact.first_name}},

Your private consultation is on the calendar:

📅 {{appointment.start_time_formatted}}
📍 {{custom_values.studio_address}}

Here's what to expect during our 90 minutes together:

1. We'll talk through your vision, the occasion, and the impression you want to make.
2. I'll walk you through the fabric library — mills, weaves, seasonal weights.
3. We'll take initial measurements.
4. You'll leave with a clear sense of design direction and investment.

A few things to bring if convenient:
– Reference photos or inspiration (Pinterest, press clippings, anything)
– A dress shirt you love the fit of (useful baseline)
– Your calendar — we often want to schedule the fitting before you leave

If anything changes on your end, you can reschedule directly here: {{appointment.reschedule_url}}

Until then.

— Dustin
{{custom_values.business_name}}
```

### T2.3 — 24-Hour Reminder SMS (WF2)

```
{{contact.first_name}}, a reminder that your consultation is tomorrow, {{appointment.start_time_formatted}}, at {{custom_values.studio_address}}. 

If anything has changed, the reschedule link is here: {{appointment.reschedule_url}}

— Dustin
```

### T2.4 — 2-Hour Reminder SMS (WF2)

```
See you in a couple of hours, {{contact.first_name}}. I'll have the fabric library set aside and measurements ready. 

Drive safe.

— Dustin
```

### T2.5 — No-Show SMS (WF3, 30-min delay after missed)

```
{{contact.first_name}}, I didn't see you at the studio today — I hope everything is alright. These things happen.

If you'd like to reschedule, here's the link: {{custom_values.booking_consultation_url}}

Or just reply to this text and we'll find a time that works.

— Dustin
```

### T2.6 — Fitting Confirmation SMS (Fitting calendar booking)

```
{{contact.first_name}}, your fitting is confirmed for {{appointment.start_time_formatted}}. We'll check the silhouette, refine anything that needs refining, and walk through the final touches. 

Studio: {{custom_values.studio_address}}

— Dustin
```

---

## Folder 3 — PAYMENTS (4 templates)

### T3.1 — Deposit Request SMS (WF4 Day 1 or WF6A)

```
{{contact.first_name}}, to officially reserve your commission and begin pattern work, the deposit of ${{contact.deposit_amount}} can be sent here: {{payment_link}}

Once received, we move into production — no interruptions, no delays.

— Dustin
```

### T3.2 — Deposit Received SMS (WF6B, instant)

```
{{contact.first_name}}, deposit received — thank you. Your pattern work begins this week and you'll hear from me at each milestone as the suit comes to life.

Receipt emailed to {{contact.email}}.

— Dustin
```

### T3.3 — Final Balance SMS (WF6C, at Final Fitting stage)

```
{{contact.first_name}}, your garment is ready. The final balance of ${{contact.total_order_value_remaining}} can be sent here: {{payment_link}}

Once settled, we'll arrange delivery at your convenience.

— Dustin
```

### T3.4 — Final Balance Received SMS (WF6B, final balance path)

```
{{contact.first_name}}, balance received — consider your garment officially yours. I'll be in touch within the day to arrange delivery.

— Dustin
```

---

## Folder 4 — FOLLOW-UP (5 templates)

### T4.1 — Post-Consult Thank You SMS (WF4, 2-hour delay)

```
{{contact.first_name}}, thank you for making the time today. I genuinely enjoyed the conversation.

I'll follow up tomorrow with the fabric options we discussed and next steps. Take tonight to let it marinate.

— Dustin
```

### T4.2 — Post-Consult Next Steps Email (WF4 Day 1)

**Subject:** The fabrics we discussed + next steps

```
{{contact.first_name}},

A proper follow-up from yesterday's consultation.

Based on what you described — {{contact.occasion}}, the timeline, and the feel you're after — these are the fabric directions I'd recommend:

[This section gets populated manually by Dustin or his assistant based on the consult. Template placeholder — do NOT automate.]

To summarize what's next:

1. You review the fabric options and let me know your direction
2. Confirm design details (lapel, buttons, lining, pocket style, monogram)
3. Deposit to reserve your commission
4. Pattern work begins; you'll hear from me at Week 0, Week 2, Week 4
5. Fitting at approximately Week 3
6. Final fitting and delivery at Week 4

If you'd like me to walk you through any of the fabrics in more detail, just reply here.

— Dustin
{{custom_values.business_name}}
```

### T4.3 — Fabric Follow-Up SMS (WF4 Day 3)

```
{{contact.first_name}}, circling back on the fabric options. Any that jumped out at you? Happy to walk through any of them in more detail — or we can schedule a quick follow-up if that's easier.

— Dustin
```

### T4.4 — Objection-Nurture Email (WF7 Day 0)

**Subject:** What bespoke actually means

```
{{contact.first_name}},

I want to come back to something you mentioned.

Bespoke is often misunderstood as "expensive made-to-measure" — and if that's the only lens, the math doesn't work. But the truth is, a proper bespoke suit isn't a purchase. It's an asset.

Three things separate what I do from anything off-the-rack or even from most "custom" programs:

1. **The pattern is yours, permanently.** Every future commission starts from it — faster, better, cheaper than the first.
2. **The fit is engineered to your posture, not averaged to a size.** Your left shoulder isn't the same height as your right. Mine isn't either. An averaged suit pretends they are.
3. **The fabrics are mill-direct and rotationally available.** You're not buying whatever's in stock at a warehouse — you're selecting from what the best mills in Italy, England, and Scotland produce this season.

A $3,500 bespoke suit, amortized over 10 years of wear at the occasions that matter, is approximately $0.95 per wear. I've had clients wear the same commission to three weddings, two funerals, countless boardrooms, and their child's graduation.

That's the math.

If there's still a question I can answer, I'm here.

— Dustin
```

### T4.5 — Re-Engagement SMS (WF9 Day 0)

```
{{contact.first_name}}, Dustin here. It's been a stretch of quiet since we last spoke — I wanted to check in with zero expectation. Life moves, timelines shift, I understand that well.

If the commission is still on your horizon, I'm here. If it's not, no hard feelings at all.

— Dustin
```

---

## Folder 5 — RETENTION (4 templates)

### T5.1 — Post-Delivery Check-In SMS (WF10 Day 1)

```
{{contact.first_name}}, checking in — how does it feel? First wear is always a moment.

— Dustin
```

### T5.2 — Testimonial Request Email (WF10 Day 4)

**Subject:** A favor, if you're willing

```
{{contact.first_name}},

I hope you've had a chance to wear the garment and feel what it's like when something is built specifically for you.

If you'd be willing to share a few words about the experience — what it was like to go through the process, how the suit has been received, anything at all — it would mean a great deal.

A short survey here: {{survey_link}}

It takes about two minutes. And if you're open to sharing a photo of you in the piece, even better — but zero pressure.

With gratitude.

— Dustin
```

### T5.3 — Referral Invitation Email (WF10 Day 15)

**Subject:** One ask

```
{{contact.first_name}},

A brief ask, and then I'll leave you alone.

The men I most enjoy working with tend to travel in each other's circles. If you know someone who'd appreciate what I do — a colleague, a friend of a friend, a brother-in-law with a wedding coming up — I'd consider it a meaningful gesture for you to pass them my way.

For each successful referral, your next commission includes complimentary monogramming and priority scheduling. It's a small gesture on my end, but it stacks over time.

The easiest way to refer: {{custom_values.referral_form_url}}

Or simply forward this email. Either works.

— Dustin
```

### T5.4 — Birthday SMS (WF11)

```
{{contact.first_name}}, a happy birthday from Dustin's Bespoke. 

As a small gesture for the year ahead — your next commission is eligible for complimentary monogramming, redeemable anytime in the next 90 days. No code needed, just mention this message.

Wishing you a year of occasions worth dressing for.

— Dustin
```

---

## Template naming convention in GHL

Save every template with the format `[Folder] [Number] — [Short name]` so they sort alphabetically and workflows can reference them unambiguously.

Examples:
- `Welcome 1.1 — Welcome SMS`
- `Appointments 2.3 — 24hr Reminder SMS`
- `Payments 3.1 — Deposit Request SMS`
