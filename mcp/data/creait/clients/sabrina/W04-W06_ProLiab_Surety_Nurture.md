# W04 — Pro-Liab Nurture (7-touch)

Trigger: Tag `seq:pro-liab-nurture`
Global exits: same as W02.

| Day | Channel | Template |
|---|---|---|
| 0 | Email | `Email_ProLiab_02_Why_You_Need_It` |
| 2 | SMS | `SMS_ProLiab_02_Check_In` |
| 4 | Email | `Email_ProLiab_03_Claim_Scenarios` |
| 7 | Email | `Email_ProLiab_04_Service_Specific` (dynamic based on Service Type custom field) |
| 10 | SMS | `SMS_ProLiab_03_Calendar_Nudge` |
| 14 | Email | `Email_ProLiab_05_Cost_vs_Risk` |
| 21 | Email | `Email_ProLiab_06_Last_Call` |
| 22 | Apply | `stage:dormant` |

---

# W05 — Surety Bond Lead Intake

Trigger: Form `Surety Bond Intake`

## Steps
1. Create/update contact, map fields
2. Apply tags: `product:surety`, `stage:warm-lead`, source, compliance
3. If Bond Type = Medicare DMEPOS OR Medicaid → apply `compliance:medicare-medicaid` (10-yr retention)
4. Create Opportunity in Surety pipeline, Stage: New Lead
5. Redirect form submitter to direct quoting link (with UTM)
6. Wait 2 min → `Email_Surety_01_Confirmation`
7. Wait 10 min → `SMS_Surety_01_Intro`
8. Internal notification to Sabrina with bond type + amount
9. Easy Links sync (basic fields + compliance class)
10. Apply `seq:surety-nurture` → triggers W06

---

# W06 — Surety Bond Nurture (5-touch, faster cadence)

Trigger: Tag `seq:surety-nurture`

**Why shorter:** surety deadlines are often 7–14 days (Medicare enrollment, contract awards). Urgency wins.

| Day | Channel | Template |
|---|---|---|
| 0 | Email | `Email_Surety_02_What_You_Need` (docs checklist) |
| 1 | SMS | `SMS_Surety_02_Deadline_Check` |
| 3 | Email | `Email_Surety_03_Credit_Explained` |
| 5 | SMS | `SMS_Surety_03_Calendar_Nudge` |
| 10 | Email | `Email_Surety_04_Last_Call` |
| 11 | Apply | `stage:dormant` |
