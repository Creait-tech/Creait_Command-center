# W10 — Business Card Drip (12-month)

**Trigger:** Tag `source:business-card` added to a contact

**Story from the call:** Maurice described this flow — take photo of 60 business cards at once, AI extracts to CRM, starts long drip. Sabrina said "stop, you're playing." She wants this.

## Sequence (spread over 12 months, frequency-capped)

| Month | Channel | Template |
|---|---|---|
| 0 (within 1 hr) | Email | `Email_Card_01_Nice_To_Meet` — references event via tag `event:<slug>` |
| 0 (next day) | SMS | `SMS_Card_01_Follow_Up` |
| 1 | Email | `Email_Card_02_Value_Drop` — educational: one insurance risk relevant to their industry |
| 2 | Email | `Email_Card_03_Case_Study` |
| 3 | SMS | `SMS_Card_02_Check_In` |
| 4 | Email | `Email_Card_04_New_Rules` — regulation or carrier market update |
| 5 | Email | `Email_Card_05_Referral_Ask` — "Know anyone who could use..." |
| 6 | SMS | `SMS_Card_03_Midpoint` |
| 8 | Email | `Email_Card_06_Tool_Share` — free checklist download |
| 10 | Email | `Email_Card_07_Year_Review` — "a year ago we met" |
| 12 | SMS | `SMS_Card_04_Anniversary` |
| 12 (next day) | Apply Tag | `stage:dormant` (exit this workflow, enter W19 cycle) |

## Frequency Cap
- No business card drip sends more than 1 message in 14 days (even if the schedule says otherwise — workflow has a "wait until 14 days since last send" guard before every step)

---

# W18 — Business Card Scan (AI Extract)

**Trigger:** Form submitted — `Business Card Scan Upload`

Form collects:
- Photo(s) — front of cards (multi-upload)
- Photo(s) — back of cards (multi-upload)
- Event / Source tag (dropdown: recent events + free-text "other")

## Steps

1. **AI Extraction Step** (GHL AI action or Make.com scenario)
   - For each card image: extract Name, Company, Title, Email, Phone, Website
   - If back-of-card photo has notes, extract as a note attached to the contact

2. **For Each Extracted Card**:
   - Check if contact already exists (match on email)
   - If new: create contact with fields + tag `source:business-card` + `event:<slug>` from form
   - If exists: add note + apply `source:business-card` if not present
   - Apply `consent:email-marketing` ONLY if the context supports it (networking = implicit consent under CAN-SPAM for B2B; still include unsubscribe in every email)

3. **Set Custom Field** `Business Card Scan Source = <event slug>`

4. **Enter W10 (Business Card Drip)** — tag triggers it

5. **Send Sabrina Summary SMS**
   - `"Scanned {{count}} cards from {{event}}. {{new_count}} new contacts created, {{dup_count}} were duplicates. Drip started."`

## Fallback
- If AI extraction confidence is low on any card, create a task for Sabrina to review that card in the "Cards Needing Review" list before the drip starts
