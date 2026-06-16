# 10 Missing SMS Snippets — Paste-Ready

**Why:** SMS conversion is 5-10x email. Each missing snippet = a leak. The API scope blocks programmatic creation, so paste these into CreateOS → Settings → Templates → SMS.

**Date:** 2026-05-25
**Existing:** 6 snippets (cart_abandonment, order_confirmation, reactivation, review_request, service_day_of_arrival, service_reminder_1hr)
**Adding:** 10 → total **16**

---

## How to add each one

1. CreateOS → **Settings** → **Custom Values & Templates** → **Templates** tab
2. Click **+ New Template** → Type: **SMS** → paste name + body below
3. Save

---

## 1. `birthday_sms`

```
Happy birthday {{contact.first_name}} 🎲 BDAY20 = $20 off this week. Pull up: https://adultgamenights.com
```

---

## 2. `vip_welcome_sms`

```
Yo {{contact.first_name}} — that's your 2nd game. You officially VIP 🔥 Free shipping for life unlocked. Smoking Section pre-order early access. We'll DM next drop first. — Thomas
```

---

## 3. `sponsor_internal_alert_sms`

(For Thomas's phone — fires on sponsor form submission)

```
🎯 SPONSOR LEAD: {{contact.first_name}} {{contact.last_name}} from {{custom_values.business_name}}. Budget: {{custom_values.budget_range}}. Email them within 24h.
```

---

## 4. `wholesale_internal_alert_sms`

(For Thomas's phone)

```
📦 WHOLESALE: {{contact.first_name}} from {{custom_values.business_name}} ({{custom_values.business_type}}) wants {{custom_values.qty_target}} units. Quote due in 24h.
```

---

## 5. `service_booking_internal_sms`

(For Thomas's phone — fires on service booking)

```
🎲 SERVICE BOOKING: {{contact.first_name}} {{contact.last_name}} booked {{custom_values.package_tier}} for {{custom_values.event_date}}. {{custom_values.headcount}} ppl. Address: {{custom_values.event_address}}. Confirm.
```

---

## 6. `service_reminder_7d_sms`

(7 days before service event)

```
{{contact.first_name}} — your AGN game night is 7 days out 🎲 {{custom_values.event_date}}. We'll text reminders at -1d and -1h. Anything change? Text us.
```

---

## 7. `post_service_review_sms`

(1 day after service event — review request)

```
Yo {{contact.first_name}} — hope your AGN game night was 🔥. Quick favor: drop a review? https://g.page/r/adultgamenights/review. 5% off next booking when you do. — Thomas
```

---

## 8. `referral_credit_earned_sms`

(When referrer's friend buys)

```
💰 Yo {{contact.first_name}} — your friend just pulled up off your referral link. $10 credit's in your pocket. Cash it next time: https://adultgamenights.com — AGN
```

---

## 9. `event_day_of_sms`

(Day-of event reminder, 4 hours before doors)

```
🎲 TONIGHT — {{custom_values.event_name}} at {{custom_values.event_venue}}. Doors at {{custom_values.event_time}}. Bring ID + your crew. See you at the door.
```

---

## 10. `win_back_sms`

(Used in Win-Back workflow alongside the email)

```
Yo {{contact.first_name}} — it's Thomas. Been a minute. New drops cooking. Code WELCOME15 = 15% off through Friday: https://adultgamenights.com
```

---

## After all 10 are pasted

1. Update workflows that should use these snippets:
   - Birthday Promo Campaign → swap inline SMS for `birthday_sms`
   - Repeat Buyer VIP → swap inline → `vip_welcome_sms`
   - Sponsor B2B workflow → use `sponsor_internal_alert_sms` instead of inline
   - Wholesale workflow → use `wholesale_internal_alert_sms`
   - Game Night Service Booking → already uses `service_reminder_1hr` + `service_day_of_arrival` ✅
   - Add `service_reminder_7d_sms` as new step in Service Booking flow
   - Add `post_service_review_sms` to Service Booking 1-day-post step
   - Refer-a-Friend Awarded workflow → use `referral_credit_earned_sms`
   - Event Reg General → use `event_day_of_sms`
   - Win-Back at 90 Days → add `win_back_sms` parallel to email

2. Total SMS infrastructure after: **16 snippets** covering every customer-touchpoint scenario

---

## TCPA compliance reminders

- All SMS must go to contacts who **explicitly opted in** (checked SMS Opt-In on form OR replied YES to a confirmation)
- Klaviyo-imported contacts (~15K from Trap Museum era) **CANNOT** receive marketing SMS — only opted-in customers from CreateOS or new form submissions
- Each marketing SMS must include "Reply STOP to unsubscribe" — CreateOS adds this automatically for `type: sms` templates
- Keep marketing SMS frequency to **≤4 per month per contact** to avoid carrier filtering

Internal SMS to Thomas (`+14049542115`) is NOT subject to TCPA — it's a business notification to himself, not a marketing message to a contact.

---

**Author:** Maurice / CREAIT
**Date:** 2026-05-25
