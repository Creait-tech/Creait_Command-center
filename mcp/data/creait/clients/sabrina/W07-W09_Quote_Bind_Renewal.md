# W07 — Quote Sent Follow-Up

**Trigger:** Opportunity stage = `Quoted` (any pipeline)

**Why it exists:** Sabrina said quotes sit without response. This sequence drives decisions.

## Sequence

| Day (from stage change) | Channel | Template |
|---|---|---|
| 0 | Email | `Email_Quote_01_Here_Is_Your_Quote` — quote PDF attached, plain-English summary, Accept/Decline link buttons |
| 1 | SMS | `SMS_Quote_01_Did_You_Get_It` |
| 3 | Email | `Email_Quote_02_FAQ` — common questions about the quote |
| 5 | SMS | `SMS_Quote_02_Quick_Call` |
| 7 | Email | `Email_Quote_03_Expiring_Soon` — references `Quote Expires` field |
| 14 | Email | `Email_Quote_04_Last_Chance` |
| 21 | Move | Opportunity → Lost, Decline Reason = "No Response", tag `stage:dormant` |

## Branches
- **Accept link clicked** → move to Bound + trigger W08
- **Decline link clicked** → move to Lost + prompt decline reason via 1-field form
- **Inbound reply** → W14 takes over, paused
- **Sabrina SMS "BOUND {{contact.id}}"** → move to Bound + W08

---

# W08 — Bound Client Welcome

**Trigger:** Opportunity moved to `Bound` (any pipeline)

## Steps
1. Apply tag `stage:client-active`
2. Remove `stage:warm-lead` / `stage:contacted` / `stage:quoted` / `seq:*-nurture`
3. Send welcome email (`Email_Bound_01_Welcome`) with:
   - Policy summary
   - Client portal login link
   - What to do if a claim happens (phone + email)
   - Calendar link for renewal check-in
4. Wait 3 days → W17 (Google Review Ask) fires
5. Wait 7 days → email explaining cross-sell product (if they have cyber only → cyber→proliab email; if pro-liab only → proliab→cyber)
6. Set `Policy Expiration` field (drives W09)
7. Internal Slack/email to Sabrina: "🎉 {{contact.business_legal_name}} bound {{opportunity.product}} — ${{bound_premium}}. Commission: ${{quote_amount * commission_pct}}."

---

# W09 — Renewal 11-Month Reminder

**Trigger:** Date-based — `Policy Expiration` minus 30 days

## Sequence
- **T-30 days**: Email `Email_Renewal_01_Heads_Up`
- **T-14 days**: SMS `SMS_Renewal_01_Quick_Call`
- **T-7 days**: Email `Email_Renewal_02_Options` — compares current carrier vs alternatives Sabrina may have
- **T-1 day**: SMS `SMS_Renewal_02_Urgent`
- **T+1 day** (if not renewed): Move opportunity to Cross-Sell/Renewal pipeline, stage "Lapsed" — internal alert to Sabrina
