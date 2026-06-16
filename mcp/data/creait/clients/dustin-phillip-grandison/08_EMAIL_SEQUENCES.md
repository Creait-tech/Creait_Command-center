# Email Sequences — Full content

Three sequences, 14 emails total. Each lives inside a workflow; this document holds the copy.

---

## Sequence A — Welcome Nurture (WF8)

**Enrollment:** Tag added = `Nurture Sequence` (applied by WF1 branch when lead doesn't book within 48h)
**Duration:** 22 days, 7 emails
**Exit condition:** Consultation booked OR `Deposit Paid` tag

### A1 — Day 0, The Brand Story

**Subject:** Why I do this

```
{{contact.first_name}},

Before anything else — a bit of context on who I am and why the work matters to me.

I started Dustin's Bespoke because I was tired of watching good men settle for suits that almost fit. Off-the-rack is an averaging exercise — your shoulders, your posture, your proportions averaged down to a size label that mostly ignores you.

Bespoke isn't about luxury for luxury's sake. It's about precision. It's about a garment that moves with you, not against you. It's about walking into the room already dressed and not thinking about the suit again for the rest of the night.

When you're ready to have a conversation, the studio is here.

— Dustin
```

### A2 — Day 3, The Process

**Subject:** What actually happens when you commission a suit

```
{{contact.first_name}},

People often ask what the process looks like. Here's the short version.

**Consultation (90 minutes)** — We talk. About the occasion, the vision, your wardrobe, what you love to wear, what you hate. I walk you through fabric options — Italian mills, English weaves, seasonal weights, solids, patterns. We take initial measurements. No commitment yet.

**Design confirmation** — You pick fabric and design details: lapel width, button stance, lining, pockets, vents, monogram. I send a digital confirmation for your sign-off.

**Pattern creation** — Your pattern is drafted from scratch and stored permanently. Every future commission is faster because of this.

**Production (3–4 weeks)** — Cutting, stitching, hand-finishing. You'll hear from me at Week 0, Week 2, and Week 4.

**Fitting** — We check the silhouette, make adjustments, refine.

**Delivery** — You walk out wearing something built specifically for you.

Start to finish, roughly four weeks.

When you're ready: {{custom_values.booking_consultation_url}}

— Dustin
```

### A3 — Day 6, Fabric Education

**Subject:** A short guide to fabric

```
{{contact.first_name}},

Fabric is where most bespoke conversations either come alive or get lost. Here's a primer.

**Super numbers (110s, 130s, 150s, etc.)** — Refer to fineness of the yarn. Higher numbers = finer yarn = softer hand. But also more delicate. A Super 150s suit is magnificent for black-tie; it's the wrong choice for daily wear.

**The great mills** — Loro Piana, Dormeuil, Scabal, Holland & Sherry, Zegna. Each has a signature. Loro Piana: soft, drapey, Italian. Scabal: architectural, British, structured. I'll walk you through what fits your wardrobe goals in consultation.

**Seasonal weights** — Summer suits should breathe (fresco weaves, 8–9 oz). Winter suits should hold shape (flannel, worsted, 11–13 oz). Year-round wools sit in the 9–10 oz range.

**Natural fibers always win** — Wool, cashmere, linen, silk blends. Synthetic content above a trace amount is a red flag in any price point.

I have the full fabric library at the studio. When you're ready to see it: {{custom_values.booking_consultation_url}}

— Dustin
```

### A4 — Day 10, The Comparison

**Subject:** Off-the-rack, made-to-measure, bespoke — clarified

```
{{contact.first_name}},

There's a lot of confusion in the market. Here's the clarity.

**Off-the-rack** — Factory-cut to a standardized size, altered to fit you after purchase. The pattern was never yours.

**Made-to-measure** — Factory pattern adjusted to your measurements. Better than off-the-rack, but still built from a template.

**Bespoke** — Pattern drafted from scratch, to your body, to your posture, to your proportions. Stored permanently. Every subsequent commission gets faster and more refined.

Most "custom" programs in the U.S. market are made-to-measure. That's not bad — it's just not bespoke. The pricing reflects the difference.

When you're ready for something built from the ground up, I'm here.

— Dustin
```

### A5 — Day 14, Style Rules That Matter

**Subject:** Five style rules I stand behind

```
{{contact.first_name}},

A short list. These are the rules I apply without exception.

1. **The jacket should end where your thumbs naturally meet your fingers.** Not at the wrist bone — that's dated. Not mid-hip — that's dated in the other direction.

2. **Trouser break is personal, but no break is better than too much.** A shallow break or no break at all photographs better, ages better, moves better.

3. **Your shirt cuff should show half an inch beyond the jacket.** Always. This is the detail people can't name but always notice.

4. **Shoulder is everything.** You can always let out a waist; you cannot fix a bad shoulder. This is why fit matters more than fabric.

5. **Solids outlive patterns.** Your first bespoke suit should be a solid — navy or charcoal. Patterns come once the foundation is set.

Apply these and 90% of dressing well is solved.

— Dustin
```

### A6 — Day 18, Testimonials & Recent Work

**Subject:** What clients have said

```
{{contact.first_name}},

Rather than tell you what the experience is like, I'll let others speak.

[DYNAMIC CONTENT BLOCK — Dustin populates with 3 testimonials + photos from recent commissions. Rotate quarterly.]

"[Testimonial 1]" — [Client first name + occasion]

"[Testimonial 2]" — [Client first name + occasion]

"[Testimonial 3]" — [Client first name + occasion]

More here: {{custom_values.testimonial_page_url}}

When you're ready to begin: {{custom_values.booking_consultation_url}}

— Dustin
```

### A7 — Day 22, Behind the Craft

**Subject:** A day in the studio

```
{{contact.first_name}},

A closing note, and then I'll let you go.

A normal day in the studio involves seven to nine hours of hand-work. Cutting a pattern. Basting. Stitching a lapel roll by hand because machine roll is flat and lifeless. Pressing seams with a mushroom and a damp cloth. Fitting a canvas chest piece — the internal skeleton of the jacket that gives it life for 20+ years.

None of this is fast. None of it is easy. But all of it is why a bespoke suit feels different the moment you put it on.

If this is the kind of work you've been looking for, I'd be honored to have the conversation.

{{custom_values.booking_consultation_url}}

— Dustin
{{custom_values.business_name}}
{{custom_values.business_phone}}
```

---

## Sequence B — Post-Consultation Conversion (inside WF4)

**Enrollment:** Appointment status = completed on Consultation calendar
**Duration:** 10 days, 3 emails
**Exit condition:** Deposit Paid tag

### B1 — Day 1, The Next Steps Email

Copy is in `07_MESSAGING_TEMPLATES.md` as T4.2. Sent by WF4 Day 1.

### B2 — Day 3, The Fabric Follow-Up

**Subject:** The fabric decision, whenever you're ready

```
{{contact.first_name}},

No urgency here. I know a bespoke decision isn't one that should be rushed.

If there are fabric questions that have come up since we spoke — texture, seasonality, how a specific mill drapes versus another — reply and I'll walk you through it.

If you've landed on a direction, even tentatively, let me know and I'll have a formal digital confirmation ready for your sign-off.

— Dustin
```

### B3 — Day 7, The Gentle Close

**Subject:** One more thought

```
{{contact.first_name}},

A week out from our consultation — wanted to check in one more time before the fabric I was holding for you goes back into general availability.

If you're moving forward, this is the moment to lock it in. If something has shifted on your side — timing, occasion, priorities — tell me and we'll adjust. I'd rather know than assume.

The decision is yours. I'm here either way.

— Dustin
```

---

## Sequence C — Post-Delivery Retention (inside WF10)

**Enrollment:** Pipeline stage = Delivered
**Duration:** 30 days, 4 emails (+ 2 SMS interspersed)
**Exit condition:** None — they graduate to WF11/12/13

### C1 — Day 1, The Check-In (SMS — see T5.1)

### C2 — Day 4, Testimonial Request (email — see T5.2)

### C3 — Day 8, Photo Request SMS

**SMS only, no email:**

```
{{contact.first_name}}, if the opportunity arises to snap a photo of you in the suit — at the event, in natural light, or even just a mirror shot — I'd love to see it. No pressure. It just helps me see the work in the wild.

— Dustin
```

### C4 — Day 15, Referral Invitation (email — see T5.3)

### C5 — Day 30, The Wardrobe Continuation

**Subject:** What comes next for your wardrobe

```
{{contact.first_name}},

Your first bespoke commission establishes the foundation. What comes next is the real fun.

Based on the pattern we now have on file, a few natural next steps:

– **A second suit in a complementary weight.** If your first was a 10-oz year-rounder, the second should be a summer fresco or a winter flannel. Different occasions, same pattern.

– **Shirting.** Bespoke shirts built off your shoulder pattern. Shirts wear out faster than suits — a rotation of 4–6 bespoke shirts pays for itself.

– **A tuxedo on file.** Every man should have one. The pattern is already drafted; we'd just need the fabric selection and a fitting.

No urgency, no hard sell. Just letting you know the door is open and the pattern is ready whenever you are.

— Dustin
{{custom_values.business_name}}
```

---

## Email design standards

1. **Plain text > HTML** for most of these. Dustin's brand is restraint.
2. **One photo per email maximum** — usually embedded in the "Behind the Craft" or "Testimonials" emails only.
3. **No "unsubscribe" badge on transactional emails** — only on Sequence A/C (nurture/retention). Transactional (WF2, WF6, etc.) go out under GHL's transactional designation.
4. **Font: brand serif for headlines, system sans for body** — or if a brand font isn't defined, Georgia/Helvetica pairing.
5. **Every email closes with "— Dustin"** and the business name/phone in the signature block.
