# W17 — Google Review Ask

**Trigger:** Opportunity moved to Bound + 3 days

## Sequence

| Step | Channel | Template |
|---|---|---|
| 1 | Email | `Email_Review_01_Ask` — 2-question happiness gauge; if 4-5 stars, redirect to Google review; if 1-3 stars, redirect to feedback form (feedback goes to Sabrina only) |
| 2 (after 5 days if no review) | SMS | `SMS_Review_01_Nudge` |
| 3 (after 10 days) | stop | — |

## Google Review Setup
- Use GHL Reputation module
- Connect Franklin Insurance Solutions Google Business Profile
- Set Google review link destination in Reputation → Settings
- Monitor reviews from within GHL; auto-notify Sabrina on new reviews (positive or negative)

---

# W19 — Dormant Re-Engagement

**Trigger:** Tag `stage:dormant` applied + 120 days since that tag applied

**Why:** Don't abandon dormants forever. One annual check-in to see if their situation changed.

## Sequence

| Day | Channel | Template |
|---|---|---|
| 0 | Email | `Email_Dormant_01_Its_Been_A_While` — soft, no pressure, "has anything changed about your {{product_interest}} situation?" |
| 7 | Email | `Email_Dormant_02_New_Options` — if market shifted |
| 14 | stop | — |

If contact engages → remove `stage:dormant`, re-apply appropriate product `seq:*-nurture`.
If 12 months passed with no activity → apply `stage:archived`, excluded from all sends except newsletter.
