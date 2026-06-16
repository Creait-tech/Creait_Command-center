# Brand Voice + Merge Fields

## Voice Guidelines (for every email, SMS, AI agent reply)

From the call: Sabrina wants to be **educational, relationship-first, modern, approachable, professional but not stiff**. NOT salesy. NOT sci-fi. She builds on relationships — every message must feel like it's from a real person.

### Do
- Use the prospect's first name naturally
- Lead with a specific insight or observation about their business
- Be concrete (use numbers, real examples) — the $3M Georgia Aquarium story is a favorite
- Keep SMS under 160 chars when possible
- End most emails with a soft one-question CTA, not "BUY NOW"
- Use "Franklin Insurance Solutions" (full) on first mention; "Franklin Insurance" after
- Sign as "Sabrina" personally for early touches; "The Franklin Insurance team" only for newsletter

### Don't
- No all-caps lines (feels like yelling)
- No emoji overload (one emoji per email max, none in SMS by default)
- No generic insurance jargon ("coverage limits", "ACORD 125" etc.) in prospect-facing copy — explain, don't jargon
- No "breaking news" urgency unless actually time-sensitive (carrier pullout, rate change)
- No "make money while you sleep" type promises (even though that's the goal internally)

## Merge Fields (use these exactly)

| Field | Token |
|---|---|
| First Name | `{{contact.first_name}}` |
| Last Name | `{{contact.last_name}}` |
| Business Name | `{{contact.business_legal_name}}` |
| Email | `{{contact.email}}` |
| Phone | `{{contact.phone}}` |
| Product Interest | `{{contact.primary_product_interest}}` |
| Sabrina's Booking Link | `{{user.booking_link}}` or fixed URL stored as snippet |
| Unsubscribe Link | `{{unsubscribe_link}}` |
| Business Address footer | auto-inserted via GHL compliance footer |

## Standard Email Footer (auto-applied to every marketing email)

```
---
Sabrina Franklin
Franklin Insurance Solutions
3314 Britt Moore Rd, Suite 1000B, Houston, TX 77043
info@franklininsurancesolutions.com  ·  281-819-2505

You're receiving this because you opted in via our website or at an event.
This is a marketing email. Unsubscribe: {{unsubscribe_link}}
```

## Standard Email Footer (transactional — e.g., booking confirmation, welcome after bind)

```
---
Sabrina Franklin  ·  Franklin Insurance Solutions
info@franklininsurancesolutions.com  ·  281-819-2505
```

(No unsubscribe — transactional only. Marked `non-marketing` in GHL.)

## Standard SMS Footer

First SMS to any contact must include:
> `— Sabrina @ Franklin Ins. Reply STOP to opt out.`

After first, brief footer: `— Sabrina` (STOP still works because of carrier-level compliance).
