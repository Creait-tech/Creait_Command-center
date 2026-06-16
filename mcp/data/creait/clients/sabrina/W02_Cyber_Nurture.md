# W02 — Cyber Insurance Nurture (7-touch)

**Goal:** Educate lead + drive to booked call; hard exit on reply.

## Trigger
- Tag added: `seq:cyber-nurture`

## Global Exit Conditions (check before every step)
- `flag:reply-stop` present → EXIT
- `unsubscribed:email` AND `unsubscribed:sms` → EXIT
- `stage:quoted` or `stage:bound` → EXIT (different workflow takes over)

## Sequence

| Day | Channel | Template | Notes |
|---|---|---|---|
| 0 | Email | `Email_Cyber_02_Why_It_Matters` | Real example: Georgia Aquarium $3M incident (Shayla's story) |
| 2 | SMS | `SMS_Cyber_02_Quick_Check` | "Quick Q about your business..." |
| 4 | Email | `Email_Cyber_03_Cost_Breakdown` | What cyber actually costs vs a claim |
| 7 | Email | `Email_Cyber_04_Case_Study` | SMB case study, ~300 words |
| 10 | SMS | `SMS_Cyber_03_Calendar_Nudge` | Soft booking ask |
| 14 | Email | `Email_Cyber_05_Misconceptions` | "You think you're too small for cyber? Here's why you're the target." |
| 21 | Email | `Email_Cyber_06_Last_Call` | "If now's not the right time, no worries — here's what to watch for." Includes unsubscribe front-and-center. |
| 22 | Apply Tag | `stage:dormant` | Auto-move if no reply by end of sequence |

## Branch: Client Books a Call
- If they book via calendar → apply `stage:contacted`, tag `booked:discovery-cyber` → exit this workflow, enter Quote Sent follow-up after call

## Branch: Client Replies
- Reply detection = inbound email/SMS → W14 (Reply-Stop Guardrail) takes over

## Frequency Cap
- No two SMS within 72 hours (global rule enforced at account level)
