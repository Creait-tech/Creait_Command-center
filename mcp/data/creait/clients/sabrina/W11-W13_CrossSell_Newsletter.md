# W11 — Cross-Sell: Cyber → Pro-Liab

**Trigger:** `stage:client-active` AND `product:cyber` AND NOT `product:pro-liab` AND 30 days since bind date

## Sequence

| Day | Channel | Template |
|---|---|---|
| 0 | Email | `Email_XSell_C2P_01_Did_You_Know` — if you offer advice/services, cyber alone isn't enough |
| 7 | Email | `Email_XSell_C2P_02_Real_Story` |
| 14 | SMS | `SMS_XSell_C2P_01_Quick_Q` |
| 21 | Email | `Email_XSell_C2P_03_Quote_Offer` — include booking link |
| 22 | Apply | `stage:dormant` for cross-sell; remove `seq:cross-sell-cyber-to-proliab` |

## Branch: Client Engages
- Booking call → create new opportunity in Pro-Liab pipeline, stage Contacted
- Reply → W14 pauses

---

# W12 — Cross-Sell: Pro-Liab → Cyber

Mirror of W11 with cyber-focused copy.

---

# W13 — Weekly Newsletter

**Trigger:** Schedule — every Wednesday 9:00 AM CT

## Segments (each gets a tailored newsletter variant)

| Segment | Filter | Variant |
|---|---|---|
| Prospects — Cyber | `product:cyber` AND NOT `stage:client-active` AND `consent:email-marketing` | Cyber-heavy edition |
| Prospects — Pro-Liab | `product:pro-liab` AND NOT `stage:client-active` AND `consent:email-marketing` | Pro-liab-heavy |
| Prospects — Surety | `product:surety` AND NOT `stage:client-active` AND `consent:email-marketing` | Surety-heavy |
| Clients | `stage:client-active` AND `consent:email-marketing` | Retention edition (tips, renewal reminders, referral ask) |
| Networking | `source:business-card` OR `source:networking-event` AND `consent:email-marketing` AND NOT in any other segment | General insurance insights |

## Template
- Subject: varied weekly (A/B test)
- Body:
  - 1 insight (150 words)
  - 1 case study or news item (150 words)
  - 1 CTA (book a call / take this 2-min quiz / see this carrier update)
  - Footer: marketing disclosure + unsubscribe + business address (CAN-SPAM)

## Content Engine
- Claude used to draft each newsletter (Sabrina edits in CreAIt OS builder)
- Sabrina keeps a content backlog in Notion/Google Doc; weekly pull one insight from backlog
- Shayla mentioned Tuesday Claude sessions — Sabrina can come, ask AI to help build next week's content

## Suppression
- Anyone with `flag:reply-stop` OR `unsubscribed:email` excluded
- Rate limit: any contact receives at most 1 newsletter + 1 product nurture email per week (newsletter wins if conflict)
