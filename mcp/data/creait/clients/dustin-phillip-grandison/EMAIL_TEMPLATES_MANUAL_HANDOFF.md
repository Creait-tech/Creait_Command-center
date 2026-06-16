# Email Templates — Manual Completion Required

**Location:** app.getcreait.com → Marketing → Emails → Templates
**Sub-account:** Dustin's Bespoke (Location ID: pisXuG0XOHoNDquxzSKG)

> These 5 templates could not be completed via automation due to GHL's email builder
> using a cross-origin iframe with no public writable API. Complete them manually in
> the GHL browser interface.

---

## 1. FIX — Nurture A6 "Testimonials & Recent Work" (already exists)

**Template name:** Nurture A6 — Testimonials & Recent Work  
**Subject line to set:** `What clients have said`

**Problem:** The first two lines of the body are corrupted. Fix them:

| Current (wrong) | Replace with |
|---|---|
| `Hi There!` | `{{contact.first_name}},` |
| `Start from scratch— Dustin populates with 3 testimonials...` | `Rather than tell you what the experience is like, I'll let others speak.` |

The rest of the body (testimonial placeholders, booking URLs, `— Dustin`) is already correct.

**Full correct body:**
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

---

## 2. CREATE — Nurture A7 "Behind the Craft"

**Create new template named:** `Nurture A7 — Behind the Craft`  
**Subject line:** `A day in the studio`  
**Type:** Plain text

**Body:**
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

## 3. CREATE — Nurture B2 "Fabric Follow-Up"

**Create new template named:** `Nurture B2 — Fabric Follow-Up Email`  
**Subject line:** `The fabric decision, whenever you're ready`  
**Type:** Plain text

**Body:**
```
{{contact.first_name}},

No urgency here. I know a bespoke decision isn't one that should be rushed.

If there are fabric questions that have come up since we spoke — texture, seasonality, how a specific mill drapes versus another — reply and I'll walk you through it.

If you've landed on a direction, even tentatively, let me know and I'll have a formal digital confirmation ready for your sign-off.

— Dustin
```

---

## 4. CREATE — Nurture B3 "Gentle Close"

**Create new template named:** `Nurture B3 — Gentle Close Email`  
**Subject line:** `One more thought`  
**Type:** Plain text

**Body:**
```
{{contact.first_name}},

A week out from our consultation — wanted to check in one more time before the fabric I was holding for you goes back into general availability.

If you're moving forward, this is the moment to lock it in. If something has shifted on your side — timing, occasion, priorities — tell me and we'll adjust. I'd rather know than assume.

The decision is yours. I'm here either way.

— Dustin
```

---

## 5. CREATE — Retention 5.6 "Wardrobe Continuation"

**Create new template named:** `Retention 5.6 — Wardrobe Continuation`  
**Subject line:** `What comes next for your wardrobe`  
**Type:** Plain text

**Body:**
```
{{contact.first_name}},

Your first bespoke commission establishes the foundation. What comes next is the real fun.

Based on the pattern we now have on file, a few natural next steps:

– A second suit in a complementary weight. If your first was a 10-oz year-rounder, the second should be a summer fresco or a winter flannel. Different occasions, same pattern.

– Shirting. Bespoke shirts built off your shoulder pattern. Shirts wear out faster than suits — a rotation of 4–6 bespoke shirts pays for itself.

– A tuxedo on file. Every man should have one. The pattern is already drafted; we'd just need the fabric selection and a fitting.

No urgency, no hard sell. Just letting you know the door is open and the pattern is ready whenever you are.

— Dustin
{{custom_values.business_name}}
```

---

## Notes

- All templates are **plain text** style — no images, no columns, no blocks
- After creating each template, copy the template ID from the URL and add it to the workflow that sends it (WF8 for A6/A7, WF4 for B2/B3, WF10 for Retention 5.6)
- The A6/A7 templates feed Sequence A (Welcome Nurture, WF8)
- The B2/B3 templates feed Sequence B (Post-Consultation Conversion, WF4)
- Retention 5.6 feeds Sequence C (Post-Delivery Retention, WF10)
