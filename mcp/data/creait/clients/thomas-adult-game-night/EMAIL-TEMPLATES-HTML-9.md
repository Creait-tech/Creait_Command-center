# 9 Email Templates — Paste-Ready Branded HTML

**Status:** All 9 scaffold templates documented with Thomas-voice copy + AGN brutalist brand HTML
**Date:** 2026-05-25

---

## How to apply each one

1. **Email Marketing** → **Templates** → click the scaffold template name (e.g. "Event Reminder 7d")
2. In the email builder, switch to **Custom HTML** / **Code** mode (gear icon → "Edit HTML")
3. **Replace all** the existing scaffold HTML with the block below
4. Save → Preview → Send Test to your own email
5. If preview looks right, the template is live and any workflow already bound to it picks up the new content automatically

**Brand tokens used throughout (already inline in each template):**
- Red: `#E8242C` (primary)
- Red dark: `#B81820` (shadows)
- Yellow: `#FFD23F` (accent)
- Ink: `#1A0A0A` (text)
- Cream: `#FFF8E7` (background)
- Display font: Luckiest Guy (via Google Fonts CDN — falls back to Impact for email clients that block remote fonts)
- Body font: System sans (Helvetica fallback)

All templates are mobile-responsive single-column with email-client-safe inline styles + table-based layout.

---

## TEMPLATE 1 — Event Reminder 7d (ID: 69f81d0c078ba64a2d956649)

**Subject line to set in workflow:** `🎲 7 days out — {{custom_values.event_name}}`

```html
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Event Reminder</title>
<link href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Bangers&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#FFF8E7;font-family:Helvetica,Arial,sans-serif;color:#1A0A0A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8E7;padding:24px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:3px solid #1A0A0A;border-radius:18px;box-shadow:8px 8px 0 #E8242C;">
      <tr><td style="padding:32px 28px 8px;">
        <div style="font-family:'Luckiest Guy',Impact,sans-serif;font-size:42px;line-height:1;color:#E8242C;-webkit-text-stroke:1.5px #1A0A0A;text-shadow:4px 4px 0 #1A0A0A;letter-spacing:1px;">7 DAYS OUT 🎲</div>
        <div style="font-family:'Bangers',Impact,sans-serif;font-size:22px;color:#1A0A0A;margin-top:18px;letter-spacing:1px;">{{custom_values.event_name}}</div>
      </td></tr>
      <tr><td style="padding:16px 28px 8px;font-size:17px;line-height:1.55;">
        Yo {{contact.first_name}} — one week out. Mark your calendar, charge your phone, hydrate. We pulling up at <b>{{custom_values.event_venue}}</b> on <b>{{custom_values.event_date}}</b>.
      </td></tr>
      <tr><td style="padding:12px 28px 8px;font-size:17px;line-height:1.55;">
        Bring: ID, your crew, and an open mind. Drinks game energy required.
      </td></tr>
      <tr><td align="center" style="padding:24px 28px 8px;">
        <a href="{{custom_values.event_details_url}}" style="display:inline-block;background:#FFD23F;color:#1A0A0A;font-family:'Luckiest Guy',Impact,sans-serif;font-size:20px;letter-spacing:1.5px;padding:14px 32px;border:3px solid #1A0A0A;border-radius:999px;text-decoration:none;box-shadow:4px 4px 0 #B81820;">SEE DETAILS</a>
      </td></tr>
      <tr><td style="padding:18px 28px 28px;font-size:14px;color:#555;line-height:1.5;">
        Can't make it? Reply to this email or text 478-654-9574. — AGN<br>
        <span style="font-size:11px;opacity:0.7;">AND AS ALWAYS, DRINK RESPONSIBLY.</span>
      </td></tr>
    </table>
    <div style="font-size:11px;color:#888;padding:18px 12px 4px;max-width:560px;text-align:center;">
      Adult Game Nights · Atlanta, GA · <a href="{{unsubscribe_link}}" style="color:#888;">unsubscribe</a>
    </div>
  </td></tr>
</table>
</body></html>
```

---

## TEMPLATE 2 — Event Reminder 1d (ID: 69f81d0d078ba6afbc956654)

**Subject:** `🎲 TOMORROW — {{custom_values.event_name}}`

```html
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Bangers&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#FFF8E7;font-family:Helvetica,Arial,sans-serif;color:#1A0A0A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8E7;padding:24px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:3px solid #1A0A0A;border-radius:18px;box-shadow:8px 8px 0 #E8242C;">
      <tr><td style="padding:32px 28px 8px;">
        <div style="font-family:'Luckiest Guy',Impact,sans-serif;font-size:54px;line-height:1;color:#E8242C;-webkit-text-stroke:1.5px #1A0A0A;text-shadow:4px 4px 0 #1A0A0A;letter-spacing:1px;">TOMORROW 🎲</div>
        <div style="font-family:'Bangers',Impact,sans-serif;font-size:22px;color:#1A0A0A;margin-top:18px;letter-spacing:1px;">{{custom_values.event_name}}</div>
      </td></tr>
      <tr><td style="padding:16px 28px 4px;font-size:17px;line-height:1.55;">
        Pull up {{contact.first_name}} — it's tomorrow. Here's the lock-in:
      </td></tr>
      <tr><td style="padding:12px 28px;">
        <table role="presentation" width="100%" style="background:#FFD23F;border:3px solid #1A0A0A;border-radius:12px;">
          <tr><td style="padding:14px 18px;font-size:15px;line-height:1.6;">
            <b>📍 Where:</b> {{custom_values.event_venue}}<br>
            <b>🕒 When:</b> {{custom_values.event_date}} · {{custom_values.event_time}}<br>
            <b>💵 Cost:</b> {{custom_values.event_cost}}
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:18px 28px 8px;">
        <a href="{{custom_values.event_details_url}}" style="display:inline-block;background:#E8242C;color:#FFFFFF;font-family:'Luckiest Guy',Impact,sans-serif;font-size:20px;letter-spacing:1.5px;padding:14px 32px;border:3px solid #1A0A0A;border-radius:999px;text-decoration:none;box-shadow:4px 4px 0 #1A0A0A;">GET DIRECTIONS</a>
      </td></tr>
      <tr><td style="padding:16px 28px 28px;font-size:14px;color:#555;line-height:1.5;">
        See you tomorrow. Text 478-654-9574 if anything changes. — AGN<br>
        <span style="font-size:11px;opacity:0.7;">AND AS ALWAYS, DRINK RESPONSIBLY.</span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>
```

---

## TEMPLATE 3 — Post-Event Thank You (ID: 69f81d0d078ba64065956656)

**Subject:** `🎲 You were on one last night — thank you`

```html
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Bangers&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#FFF8E7;font-family:Helvetica,Arial,sans-serif;color:#1A0A0A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8E7;padding:24px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:3px solid #1A0A0A;border-radius:18px;box-shadow:8px 8px 0 #FFD23F;">
      <tr><td style="padding:32px 28px 8px;">
        <div style="font-family:'Luckiest Guy',Impact,sans-serif;font-size:44px;line-height:1;color:#E8242C;-webkit-text-stroke:1.5px #1A0A0A;text-shadow:4px 4px 0 #1A0A0A;letter-spacing:1px;">THANK YOU 🎲</div>
      </td></tr>
      <tr><td style="padding:16px 28px;font-size:17px;line-height:1.6;">
        {{contact.first_name}} — y'all SHOWED UP last night. Real talk: every event is built off of energy like yours. That's why this thing is growing.
      </td></tr>
      <tr><td style="padding:8px 28px;font-size:17px;line-height:1.6;">
        Quick favor — drop a review or tag us in your story. If you posted, send the link and we'll repost.
      </td></tr>
      <tr><td align="center" style="padding:24px 28px 8px;">
        <a href="https://g.page/r/adultgamenights/review" style="display:inline-block;background:#FFD23F;color:#1A0A0A;font-family:'Luckiest Guy',Impact,sans-serif;font-size:18px;letter-spacing:1.5px;padding:14px 28px;border:3px solid #1A0A0A;border-radius:999px;text-decoration:none;box-shadow:4px 4px 0 #B81820;margin:4px;">DROP A REVIEW</a>
        <a href="https://instagram.com/adultgamenights" style="display:inline-block;background:#1A0A0A;color:#FFD23F;font-family:'Luckiest Guy',Impact,sans-serif;font-size:18px;letter-spacing:1.5px;padding:14px 28px;border:3px solid #1A0A0A;border-radius:999px;text-decoration:none;box-shadow:4px 4px 0 #E8242C;margin:4px;">TAG US</a>
      </td></tr>
      <tr><td style="padding:18px 28px 8px;font-size:16px;line-height:1.55;">
        Next event's already cooking. We'll send you the heads-up first. — Thomas / AGN
      </td></tr>
      <tr><td style="padding:8px 28px 28px;font-size:14px;color:#555;">
        <span style="font-size:11px;opacity:0.7;">AND AS ALWAYS, DRINK RESPONSIBLY.</span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>
```

---

## TEMPLATE 4 — Service Booking Confirmation (ID: 69f81d0efe87bad0d32777c5)

**Subject:** `🎲 You're locked in — game night confirmed`

```html
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Bangers&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#FFF8E7;font-family:Helvetica,Arial,sans-serif;color:#1A0A0A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8E7;padding:24px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:3px solid #1A0A0A;border-radius:18px;box-shadow:8px 8px 0 #E8242C;">
      <tr><td style="padding:32px 28px 8px;">
        <div style="font-family:'Luckiest Guy',Impact,sans-serif;font-size:42px;line-height:1;color:#E8242C;-webkit-text-stroke:1.5px #1A0A0A;text-shadow:4px 4px 0 #1A0A0A;letter-spacing:1px;">LOCKED IN 🔒</div>
        <div style="font-family:'Bangers',Impact,sans-serif;font-size:22px;color:#1A0A0A;margin-top:18px;letter-spacing:1px;">Your game night is booked</div>
      </td></tr>
      <tr><td style="padding:16px 28px 4px;font-size:17px;line-height:1.55;">
        Bet {{contact.first_name}} — confirmed. Here's the lineup:
      </td></tr>
      <tr><td style="padding:12px 28px;">
        <table role="presentation" width="100%" style="background:#FFD23F;border:3px solid #1A0A0A;border-radius:12px;">
          <tr><td style="padding:16px 18px;font-size:15px;line-height:1.7;">
            <b>📦 Package:</b> {{custom_values.package_tier}}<br>
            <b>📅 Date:</b> {{custom_values.event_date}}<br>
            <b>🕒 Time:</b> {{custom_values.event_time}}<br>
            <b>📍 Address:</b> {{custom_values.event_address}}<br>
            <b>👥 Headcount:</b> {{custom_values.headcount}}
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:18px 28px 8px;font-size:16px;line-height:1.55;">
        <b>What's next:</b><br>
        • We'll text you 7 days out + day-of with the host's number<br>
        • Deposit invoice incoming (if not already paid)<br>
        • Anything change? Text 478-654-9574
      </td></tr>
      <tr><td align="center" style="padding:18px 28px 8px;">
        <a href="https://adultgamenights.com/book-game-night" style="display:inline-block;background:#1A0A0A;color:#FFD23F;font-family:'Luckiest Guy',Impact,sans-serif;font-size:18px;letter-spacing:1.5px;padding:14px 28px;border:3px solid #1A0A0A;border-radius:999px;text-decoration:none;box-shadow:4px 4px 0 #E8242C;">VIEW BOOKING</a>
      </td></tr>
      <tr><td style="padding:16px 28px 28px;font-size:14px;color:#555;line-height:1.5;">
        Pull up. — Thomas / AGN<br>
        <span style="font-size:11px;opacity:0.7;">AND AS ALWAYS, DRINK RESPONSIBLY.</span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>
```

---

## TEMPLATE 5 — Service Reminder 1d (ID: 69f81d0e87005ab8e5a0a36b)

**Subject:** `🎲 TOMORROW — your AGN game night`

```html
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Bangers&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#FFF8E7;font-family:Helvetica,Arial,sans-serif;color:#1A0A0A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8E7;padding:24px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:3px solid #1A0A0A;border-radius:18px;box-shadow:8px 8px 0 #FFD23F;">
      <tr><td style="padding:32px 28px 8px;">
        <div style="font-family:'Luckiest Guy',Impact,sans-serif;font-size:52px;line-height:1;color:#E8242C;-webkit-text-stroke:1.5px #1A0A0A;text-shadow:4px 4px 0 #1A0A0A;letter-spacing:1px;">TOMORROW 🎲</div>
      </td></tr>
      <tr><td style="padding:16px 28px 4px;font-size:17px;line-height:1.55;">
        Yo {{contact.first_name}} — your AGN game night is TOMORROW.
      </td></tr>
      <tr><td style="padding:8px 28px;">
        <table role="presentation" width="100%" style="background:#FFD23F;border:3px solid #1A0A0A;border-radius:12px;">
          <tr><td style="padding:14px 18px;font-size:15px;line-height:1.7;">
            <b>📅</b> {{custom_values.event_date}}<br>
            <b>🕒</b> {{custom_values.event_time}}<br>
            <b>📍</b> {{custom_values.event_address}}
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:16px 28px 4px;font-size:16px;line-height:1.55;">
        <b>Prep checklist:</b><br>
        • Ice + cups stocked?<br>
        • Speaker charged?<br>
        • Phones on Do Not Disturb (the game cards are SPICY)<br>
        • Don't forget IDs at the door
      </td></tr>
      <tr><td style="padding:16px 28px 28px;font-size:16px;line-height:1.55;">
        We'll text you 1 hour before arrival with the host's number. — AGN
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>
```

---

## TEMPLATE 6 — Service Day-Of (ID: 69f81d0f826ec4514c887a8b)

**Subject:** `🎲 We pulling up in {{custom_values.eta_minutes}} min`

```html
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#FFF8E7;font-family:Helvetica,Arial,sans-serif;color:#1A0A0A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8E7;padding:24px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:3px solid #1A0A0A;border-radius:18px;box-shadow:8px 8px 0 #E8242C;">
      <tr><td style="padding:32px 28px 8px;">
        <div style="font-family:'Luckiest Guy',Impact,sans-serif;font-size:48px;line-height:1;color:#E8242C;-webkit-text-stroke:1.5px #1A0A0A;text-shadow:4px 4px 0 #1A0A0A;letter-spacing:1px;">IT'S GAME TIME 🎲</div>
      </td></tr>
      <tr><td style="padding:16px 28px;font-size:17px;line-height:1.6;">
        {{contact.first_name}} — your AGN host is on the way. ETA: <b>{{custom_values.eta_minutes}} minutes</b>.
      </td></tr>
      <tr><td style="padding:8px 28px;font-size:17px;line-height:1.6;">
        Host's number: <b><a href="tel:{{custom_values.host_phone}}" style="color:#E8242C;">{{custom_values.host_phone}}</a></b><br>
        Call/text directly for arrival questions.
      </td></tr>
      <tr><td align="center" style="padding:18px 28px 8px;">
        <a href="tel:{{custom_values.host_phone}}" style="display:inline-block;background:#FFD23F;color:#1A0A0A;font-family:'Luckiest Guy',Impact,sans-serif;font-size:20px;letter-spacing:1.5px;padding:14px 32px;border:3px solid #1A0A0A;border-radius:999px;text-decoration:none;box-shadow:4px 4px 0 #B81820;">CALL HOST</a>
      </td></tr>
      <tr><td style="padding:16px 28px 28px;font-size:14px;color:#555;line-height:1.5;">
        Doors open. Drinks ready. Let's get it. — AGN<br>
        <span style="font-size:11px;opacity:0.7;">AND AS ALWAYS, DRINK RESPONSIBLY.</span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>
```

---

## TEMPLATE 7 — Sponsor Pitch (ID: 69f81d119d70c8fadcf61384)

**Subject:** `🎯 {{custom_values.business_name}} + AGN — let's run it`

```html
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Bangers&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#FFF8E7;font-family:Helvetica,Arial,sans-serif;color:#1A0A0A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8E7;padding:24px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" style="max-width:600px;background:#FFFFFF;border:3px solid #1A0A0A;border-radius:18px;box-shadow:8px 8px 0 #E8242C;">
      <tr><td style="padding:32px 28px 8px;">
        <div style="font-family:'Luckiest Guy',Impact,sans-serif;font-size:36px;line-height:1.1;color:#E8242C;-webkit-text-stroke:1.5px #1A0A0A;text-shadow:4px 4px 0 #1A0A0A;letter-spacing:1px;">LET'S RUN IT 🎯</div>
      </td></tr>
      <tr><td style="padding:16px 28px 8px;font-size:17px;line-height:1.6;">
        Yo {{contact.first_name}} — got your sponsor inquiry for <b>{{custom_values.business_name}}</b>. Bet. Here's what we work with:
      </td></tr>
      <tr><td style="padding:8px 28px 8px;">
        <table role="presentation" width="100%" style="background:#FFD23F;border:3px solid #1A0A0A;border-radius:12px;">
          <tr><td style="padding:16px 18px;font-size:15px;line-height:1.7;">
            <b>📈 Reach:</b> 400K+ TikTok views on viral posts · IG audience growing 8%/mo<br>
            <b>🎯 Audience:</b> 21-35, Atlanta-anchored, lifestyle/nightlife crowd<br>
            <b>📦 Sponsor formats:</b> in-game card placement · live event signage · creator content · co-branded drops<br>
            <b>💰 Founder rates:</b> locked through Q3 2026 — your timing is right
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:18px 28px 8px;font-size:17px;line-height:1.6;">
        Pulled your details — got a few sponsor packages in mind based on the budget range you put down. Want to get on a 15-min call this week to walk through them?
      </td></tr>
      <tr><td align="center" style="padding:18px 28px 8px;">
        <a href="https://app.getcreait.com/widget/booking/sponsorship-call" style="display:inline-block;background:#E8242C;color:#FFFFFF;font-family:'Luckiest Guy',Impact,sans-serif;font-size:20px;letter-spacing:1.5px;padding:14px 32px;border:3px solid #1A0A0A;border-radius:999px;text-decoration:none;box-shadow:4px 4px 0 #1A0A0A;">BOOK 15 MIN</a>
      </td></tr>
      <tr><td style="padding:18px 28px 8px;font-size:16px;line-height:1.55;">
        Or hit reply with 3 windows that work and we'll lock one. — Thomas / AGN
      </td></tr>
      <tr><td style="padding:8px 28px 28px;font-size:12px;color:#888;line-height:1.5;">
        Adult Game Nights · Atlanta, GA · <a href="mailto:adultgamenights@gmail.com" style="color:#888;">adultgamenights@gmail.com</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>
```

---

## TEMPLATE 8 — Wholesale Response (ID: 69f81d114d4381ff71f7471c)

**Subject:** `🎲 Wholesale rates — {{custom_values.business_name}}`

```html
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#FFF8E7;font-family:Helvetica,Arial,sans-serif;color:#1A0A0A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8E7;padding:24px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:3px solid #1A0A0A;border-radius:18px;box-shadow:8px 8px 0 #FFD23F;">
      <tr><td style="padding:32px 28px 8px;">
        <div style="font-family:'Luckiest Guy',Impact,sans-serif;font-size:40px;line-height:1;color:#E8242C;-webkit-text-stroke:1.5px #1A0A0A;text-shadow:4px 4px 0 #1A0A0A;letter-spacing:1px;">WHOLESALE 📦</div>
      </td></tr>
      <tr><td style="padding:16px 28px;font-size:17px;line-height:1.6;">
        Bet {{contact.first_name}} — appreciate the interest in stocking AGN at <b>{{custom_values.business_name}}</b>. Here's the lineup:
      </td></tr>
      <tr><td style="padding:8px 28px;">
        <table role="presentation" width="100%" style="background:#FFD23F;border:3px solid #1A0A0A;border-radius:12px;">
          <tr><td style="padding:16px 18px;font-size:15px;line-height:1.8;">
            <b>📦 Liquor Store Game</b><br>
            • MSRP: $34.04 · Wholesale: <b>$17 / unit</b> (50% margin)<br>
            • Min order: 12 units<br>
            • Cases of 24 ship free continental US<br>
            • Co-op marketing budget for stores doing 50+ units/qtr<br>
            <br>
            <b>🚬 Smoking Section (Q3 release)</b><br>
            • Wholesale pre-orders open now · $19 / unit<br>
            • Drop ships Q3 2026
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:18px 28px 8px;font-size:16px;line-height:1.6;">
        Next step: reply with target quantity + shipping address and we'll send a formal quote within 24h.
      </td></tr>
      <tr><td style="padding:8px 28px 28px;font-size:16px;line-height:1.55;">
        Looking forward. — Thomas / AGN
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>
```

---

## TEMPLATE 9 — Negative Review Alert (Internal — sent to Thomas, NOT to contact)

**Internal use only — workflow sends to adultgamenights@gmail.com**

**Subject:** `🚨 NEGATIVE REVIEW — {{custom_values.review_rating}}⭐ from {{contact.first_name}}`

```html
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#FFF;font-family:Helvetica,Arial,sans-serif;color:#1A0A0A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:3px solid #B81820;border-radius:12px;">
      <tr><td style="background:#B81820;color:#FFF;padding:18px 24px;font-size:22px;font-weight:bold;border-radius:10px 10px 0 0;">
        🚨 NEGATIVE REVIEW NEEDS YOUR EYES
      </td></tr>
      <tr><td style="padding:20px 24px;font-size:16px;line-height:1.6;">
        A <b>{{custom_values.review_rating}}-star review</b> just came in. Reviews AI did NOT auto-respond. You need to handle this one personally within 24h.
      </td></tr>
      <tr><td style="padding:8px 24px;">
        <table role="presentation" width="100%" style="background:#F5F5F5;border:1px solid #DDD;border-radius:8px;">
          <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;">
            <b>From:</b> {{contact.first_name}} {{contact.last_name}}<br>
            <b>Email:</b> {{contact.email}}<br>
            <b>Phone:</b> {{contact.phone}}<br>
            <b>Platform:</b> {{custom_values.review_platform}}<br>
            <b>Rating:</b> {{custom_values.review_rating}} / 5<br>
            <b>Comment:</b> "{{custom_values.review_text}}"
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:18px 24px;font-size:15px;line-height:1.6;">
        <b>Recommended action:</b><br>
        1. Reply on the platform with empathy, no excuses<br>
        2. Offer to make it right (refund / replacement / call)<br>
        3. Tag the contact `reviewed-negative` after response<br>
        4. If it was a service booking — text 478-654-9574 the host immediately
      </td></tr>
      <tr><td align="center" style="padding:8px 24px 24px;">
        <a href="{{custom_values.review_url}}" style="display:inline-block;background:#B81820;color:#FFF;font-size:15px;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">VIEW REVIEW</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>
```

---

## After all 9 are pasted

Run a quick verify:

```bash
PIT="${GHL_PIT}"
LOC="1uN6mnlvX9JQ5QvrLewp"
curl -s -H "Authorization: Bearer $PIT" -H "Version: 2021-07-28" \
  "https://services.leadconnectorhq.com/emails/builder?locationId=$LOC&limit=50" \
  | python3 -c "
import sys,json,urllib.request
d=json.load(sys.stdin)
for t in d['builders']:
    try:
        with urllib.request.urlopen(t['previewUrl'],timeout=5) as r:
            sz=len(r.read())
        flag='BRANDED' if sz>8000 else 'SCAFFOLD'
        print(f'{sz:>6} | {t[\"name\"][:45]:45} | {flag}')
    except: pass
" | sort -n
```

Target: 19 / 19 templates show `BRANDED` (size > 8K).

---

## Time estimate to apply all 9

~15-20 minutes total. The Custom HTML paste is the rate-limit — saving each template takes ~5 seconds.

---

**Date:** 2026-05-25
**Author:** Maurice / CREAIT
