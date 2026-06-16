# Forms

Built in **Sites → Forms** in GHL. Embedded on Wix via iframe or GHL-hosted landing pages.

---

## Form 1: Cyber Insurance Intake

**URL slug:** `/quote/cyber`
**Redirect after submit:** `/thank-you/cyber` (hosted in GHL) + workflow W01 fires

### Fields
- First Name *
- Last Name *
- Business Email *
- Mobile Phone *
- Business Legal Name *
- Business Website
- Industry (dropdown) *
- Number of Employees *
- Annual Revenue (dropdown — ranges) *
- **Cyber-specific:**
  - Do you take credit card payments? (Yes/No) *
  - Do you store customer personal info (names, emails, SSNs, health records)? (Multi-select) *
  - Have you had a cyber incident in the last 5 years? (Yes/No) *
  - What's your website built on? (WordPress/Shopify/Wix/Squarespace/Custom/Other)
  - Do all employees use 2-factor auth on email? (Yes/No/Partial)
- **Consent:**
  - ☐ I agree to receive emails from Franklin Insurance Solutions. *
  - ☐ I agree to receive text messages from Franklin Insurance Solutions.
  - ☐ I understand this is a request for a quote, not a binding policy.

---

## Form 2: Professional Liability Intake

**URL slug:** `/quote/pro-liab`
**Redirect after submit:** Dynamic — carrier link based on Service Type

### Fields
- First Name *
- Last Name *
- Business Email *
- Mobile Phone *
- Business Legal Name *
- Business Website
- **Service Type (dropdown) ***
  - Consulting
  - Coaching
  - Tech / Software
  - Beauty / Salon
  - Medical / Healthcare
  - Legal
  - Accounting / Bookkeeping
  - Design / Creative
  - Other
- Number of Employees *
- Annual Revenue (range) *
- Have you had a professional liability claim in the last 5 years? (Yes/No) *
- Do you require retroactive coverage? (Yes/No/Unsure)
- Consent checkboxes (same as above)

### Redirect logic (built in W03)
- Service Type = Beauty/Salon → beautician carrier link
- Service Type = Tech → tech E&O carrier link
- Service Type = Consulting → consultant carrier link
- Other → booking page with Sabrina

---

## Form 3: Surety Bond Intake

**URL slug:** `/quote/surety-bond`
**Redirect after submit:** Direct quoting platform link with UTM

### Fields
- First Name, Last Name, Email, Phone *
- Business Legal Name *
- EIN (optional)
- **Bond Type (dropdown) ***
  - Medicare DMEPOS ($50K)
  - Medicaid
  - Contract Performance Bond
  - License / Permit Bond
  - Other
- Bond Amount Required *
- Obligee (who is requiring the bond)
- Deadline (date)
- Credit Score Range (self-reported) *
- Consent checkboxes

If Bond Type = Medicare DMEPOS or Medicaid → auto-apply `compliance:medicare-medicaid`.

---

## Form 4: Business Card Scan Upload

**URL slug:** `/internal/card-scan` (password-protected, Sabrina only)

### Fields
- Event / Source (dropdown: recent events + free-text "Other")
- Date of Event
- Front photos (multi-image upload)
- Back photos (multi-image upload)
- Notes (free text)

Triggers W18 (AI Extract).

---

## Form 5: General Contact / "Not Sure What I Need"

**URL slug:** `/contact`

### Fields
- First Name, Last Name, Email, Phone
- Business Name
- What brings you here? (dropdown: quote, claim, existing client question, general)
- Message (free text)
- Consent

Routes to AI chat agent (W23) or creates a contact tagged `source:general` for Sabrina to personally triage.

---

## Form 6: Client Document Upload (for existing clients)

**URL slug:** `/client/upload` (links delivered per-client via portal)

### Fields
- Name, Email (pre-filled from portal session)
- Document Type (dropdown: Declarations Page, Certificate of Insurance, Claim Docs, Business License, Other)
- Upload (multi-file)
- Notes

Attaches files to correct contact record + applies tag `docs:received`.

---

## Wix Integration
- Use GHL embed code for each form
- Ensure Wix page URLs are SEO-friendly: `/quote-cyber-insurance-houston` etc.
- Keep form submit domain within Franklin Insurance's domain (use GHL custom domain setup)
