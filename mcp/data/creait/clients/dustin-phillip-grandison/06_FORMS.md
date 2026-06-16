# Forms — 4 forms

**GHL Path:** Sites → Forms → + Create Form

All forms use the "Standard" style. Luxury typography (brand font), generous whitespace, no progress bars unless noted. Confirmation messages are personal, not transactional.

---

## Form 1 — Bespoke Inquiry (primary lead capture)

**Purpose:** Capture inbound leads from website, Instagram bio link, ad landing pages, referral form submissions.

**Form Name:** Bespoke Inquiry
**Submit Redirect:** Custom thank-you page with Dustin's personal intro video
**Submit Button Text:** "Begin the conversation"
**Notification:** Fire WF1 on submit

### Fields (in order)

| # | Field | Type | Required | Custom Field Mapping |
|---|---|---|---|---|
| 1 | First Name | Text | ✓ | `contact.first_name` |
| 2 | Last Name | Text | ✓ | `contact.last_name` |
| 3 | Email | Email | ✓ | `contact.email` |
| 4 | Phone | Phone | ✓ | `contact.phone` |
| 5 | What's the occasion? | Single Options | ✓ | `contact.occasion` (Wedding / Business / Black-tie Event / Lifestyle / Travel / Other) |
| 6 | Event or target date (optional) | Date | — | `contact.event_date` |
| 7 | What's your budget range? | Single Options | ✓ | `contact.budget_range` |
| 8 | Custom or bespoke? | Single Options | — | `contact.suit_type_interest` (default: "Not sure yet") |
| 9 | How should we reach you? | Single Options | ✓ | `contact.preferred_communication` (SMS / Email / Phone / IG DM / WhatsApp) |
| 10 | Have you commissioned bespoke before? | Single Options | — | `contact.experience_level` |
| 11 | Anything else you'd like to share? | Textarea | — | Stored in contact notes |

**Length:** ~45 seconds to complete. Deliberately short. Dustin qualifies deeper in conversation, not on a form.

### Confirmation message (on submit)

> Thank you — your inquiry is in my hands now.
>
> I'll reach out personally within a few hours (often much sooner) to learn more about what you're envisioning and see if we're the right fit for the commission.
>
> In the meantime, a glimpse of recent work is waiting for you: [LOOKBOOK LINK]
>
> — Dustin

---

## Form 2 — Post-Consultation Feedback

**Purpose:** Capture warm feedback immediately after the 90-min consultation so Dustin can refine his approach and clients feel heard.

**Form Name:** Post-Consultation Feedback
**Trigger:** Sent automatically 2 hours after appointment status = completed (inside WF4)
**Submit Redirect:** "Thank you" page, no sales CTA

### Fields (3-step survey, 1 question per screen)

| Step | Question | Type |
|---|---|---|
| 1 | On a scale of 1–10, how close to your vision did we get? | Scale (1–10) |
| 2 | What did you love most about the consultation? | Textarea |
| 3 | Is there anything we could have done better? | Textarea (optional) |

**Length:** ~45 seconds.

**Internal rule:** Scores 9–10 trigger testimonial request in WF10. Scores ≤ 6 trigger Dustin alert (personal call).

---

## Form 3 — Post-Delivery Satisfaction Survey

**Purpose:** Capture rating + testimonial + optional photo after final delivery. Feeds reputation engine (Phase 5) and Stage 12 VIP promotion criteria.

**Form Name:** Post-Delivery Satisfaction
**Trigger:** WF10 Day 4 automated send
**Submit Redirect:** Thank-you page with referral CTA

### Fields

| # | Field | Type | Required |
|---|---|---|---|
| 1 | How would you rate your experience? | Scale (1–5 stars) | ✓ |
| 2 | How does the finished garment compare to what you envisioned? | Textarea | ✓ |
| 3 | Would you be willing for us to share your words publicly? | Radio (Yes / Anonymized / No) | ✓ |
| 4 | Upload a photo (optional) | File Upload (image) | — |
| 5 | Your title / how you'd like to be credited | Text | — |

**Internal rule:** 5-star responses with "Yes, share publicly" trigger internal notification to Dustin: "Testimonial captured from {{name}} — ready for IG/website."

---

## Form 4 — Refer a Friend

**Purpose:** Close the referral loop. Lightweight — one friction point and we lose the referral.

**Form Name:** Refer a Friend
**URL Slug:** `/refer`
**Submit Action:** Create a NEW contact tagged "Source: Referral" and "New Lead", with custom field `referred_by` populated. Fire WF1.

### Fields

| # | Field | Type | Required |
|---|---|---|---|
| 1 | Your name | Text | ✓ (the referring client) |
| 2 | Your friend's first name | Text | ✓ |
| 3 | Your friend's phone or email | Text | ✓ |
| 4 | What's the occasion? | Single Options | — |
| 5 | Anything we should know about them? | Textarea | — |

**Length:** ~20 seconds.

### Confirmation message

> Consider it done. I'll reach out to [Friend's First Name] within a day with the same care I gave you.
>
> Your referral means more than you know — thank you.
>
> — Dustin

---

## Form design standards

1. **One column layout** — never two. Two-column forms feel like cheap opt-ins.
2. **Generous label spacing** — 24px minimum between fields.
3. **No placeholder-only labels** — always a visible label above the field.
4. **Single CTA per form** — no "or" branches, no downloads, no secondary buttons.
5. **Brand font on the form itself** — not GHL's default stack. Upload the font to the sub-account or use a close web-safe substitute.
