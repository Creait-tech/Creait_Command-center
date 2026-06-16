# Workflow Index

All workflows live in **Automation → Workflows** in GHL.

| # | Workflow Name | Trigger | Purpose |
|---|---|---|---|
| W01 | Cyber — Lead Intake | Form: Cyber Insurance Intake | Capture, confirm, sync, notify, start nurture |
| W02 | Cyber — Nurture (7-touch) | Tag `seq:cyber-nurture` applied | Educate + move toward booked call |
| W03 | Pro-Liab — Lead Intake | Form: Pro-Liab Intake | Capture, redirect to carrier, start nurture |
| W04 | Pro-Liab — Nurture (7-touch) | Tag `seq:pro-liab-nurture` | Educate, check bind status |
| W05 | Surety — Lead Intake | Form: Surety Bond Intake | Capture, redirect to quoting link, start nurture |
| W06 | Surety — Nurture (5-touch) | Tag `seq:surety-nurture` | Education + urgency |
| W07 | Quote Sent — Follow-Up | Opportunity moved to Quoted | 3-touch over 7 days, then weekly |
| W08 | Bound — Client Welcome | Opportunity moved to Bound | Welcome, review ask, cross-sell seed |
| W09 | Renewal — 11 Month | Policy Expiration – 30 days | Renewal reminder + upsell |
| W10 | Business Card — Drip | Tag `source:business-card` | 12-touch over 12 months |
| W11 | Cross-Sell — Cyber → Pro-Liab | `stage:client-active` + cyber-only, 30d after bind | Education sequence |
| W12 | Cross-Sell — Pro-Liab → Cyber | `stage:client-active` + pro-liab-only, 30d after bind | Education sequence |
| W13 | Newsletter — Weekly | Schedule every Wednesday 9am CT | To all opted-in segments |
| W14 | Reply-Stop Guardrail | ANY inbound reply on email/SMS/DM | Apply `flag:reply-stop`, exit all sequences, notify Sabrina |
| W15 | Unsubscribe Handler | STOP keyword on SMS / unsub click on email | Tag unsubscribed, remove from all sequences |
| W16 | Daily Digest to Sabrina | 7:00 AM CT daily | Summary of new leads, pending replies, quotes aging |
| W17 | Reputation — Google Review Ask | Opportunity to Bound + 3 days | Review request SMS + email |
| W18 | Business Card Scan — AI Extract | Trigger: photo uploaded to Business Card form | Extract, create contact, apply drip |
| W19 | Dormant Re-Engage | `stage:dormant` + 120 days | One gentle re-engagement |
| W20 | Easy Links Sync (webhook) | Contact created/updated with basic fields | Push to Easy Links via API |
| W21 | Compliance Archive — Weekly | Sunday 11 PM CT | Export Medicare/Medicaid records to Drive folder |
| W22 | AI Voice Call — Post-Call | Inbound call handled by AI agent | Update contact, apply tags, notify Sabrina |
| W23 | AI Chat/DM — Post-Convo | Chat agent qualifies + hands off | Tag + assign to Sabrina if qualified |

Each workflow has its own spec file (W01.md, W02.md, etc.) with step-by-step build.
