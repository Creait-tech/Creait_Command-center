# Compliance Rules

Insurance is heavily regulated. These are the non-negotiables.

---

## 1. Data Retention

### Standard insurance (most policies)
- **5-year retention** on all client communications
- GHL native retention is sufficient (emails, SMS, call transcripts, notes all archived by default)
- Verify in GHL settings: Contact/Conversation history retention = ≥5 years

### Medicare / Medicaid (surety bonds for DMEPOS, home health, durable medical supply contracts)
- **10-year retention** — longer than GHL default
- Tag: `compliance:medicare-medicaid`
- **Mitigation:** W21 weekly archive to Google Drive with 10-year retention label
- Document naming convention: `{contact_id}_{year}_{week}_{event_type}.pdf`

## 2. Marketing Label (CAN-SPAM + state insurance rules)

Every marketing-class email MUST include:
- Physical business address in footer (3314 Britt Moore Rd Suite 1000B, Houston TX 77043)
- Functional unsubscribe link, honored within 10 business days
- Clear "from" name (Sabrina Franklin or Franklin Insurance Solutions)
- Statement identifying message as advertising/marketing (at bottom of email)

Transactional emails (quote delivery, policy docs, bind confirmation, appointment reminders) are exempt but must be tagged `non-marketing` in GHL to stay out of unsubscribe suppression logic.

## 3. SMS Compliance (A2P 10DLC + TCPA)

- **A2P 10DLC registration** required for business SMS in the US
- Register Trulio/Twilio number under Franklin Insurance Solutions EIN with correct use case (mixed marketing/transactional)
- Expected approval: 2-3 weeks (matches Sabrina's phone number timeline noted at end of call)
- **Opt-in required** before any marketing SMS — captured via `consent:sms-marketing` tag
- **STOP handling** — automatic (W15) — any STOP/UNSUB/CANCEL keyword instantly opts out
- **First message** to any contact includes: *"Reply STOP to opt out"*

## 4. Consent Capture

- Forms require TWO separate consent checkboxes:
  - ☐ Email marketing consent
  - ☐ SMS marketing consent
- Unchecked boxes = no marketing for that channel
- Consent timestamp + IP saved on contact record

## 5. Reply-Stop Rule (Sabrina's personal standard)

When a contact replies via any channel:
- Apply `flag:reply-stop`
- Exit all `seq:*` workflows
- Sabrina handles personally

This is ABOVE the legal minimum — it's Sabrina's relationship standard. Don't weaken it.

## 6. Data Security

- GHL handles SOC 2 / encryption natively
- Never store SSN, DL, or full payment info as plain-text custom fields
  - EIN allowed (not as sensitive) — still mark field as encrypted
  - SSN / DL stays in Easy Links
  - Payment info processed by Stripe (PCI-compliant)
- Portal passwords: none (magic link only)
- Document sharing: GHL's built-in secure document module, not public URLs

## 7. Licensing Disclosure

Any marketing material that mentions policy availability must include:
*"Franklin Insurance Solutions is licensed in Texas [and other states if applicable]. Products and availability vary by state."*

Appears in:
- Email footer on marketing sends
- Website footer
- Social bio

## 8. Claim Handling

- AI agents CANNOT discuss claim details (legal liability)
- All claim-related inbound → immediate routing to Sabrina + auto-response with carrier claim line
- Claim-related comms tagged `compliance:claim` + retained per carrier requirements (often 7+ years)

## 9. Insurance Forms / ACORDs

Easy Links is source of truth for ACORD forms and carrier-required applications. We do NOT attempt to replicate those in GHL. If Sabrina wants access to ACORD forms outside Easy Links, she can subscribe separately ($99/month per seat) — noted in call.

## 10. Annual Compliance Review (calendar event)

- First Monday of April every year: Sabrina reviews compliance settings
- Checklist:
  - [ ] Retention settings verified
  - [ ] A2P 10DLC still registered / current
  - [ ] Consent records audited (sample of 20 contacts)
  - [ ] Unsubscribe processing confirmed
  - [ ] Google Drive archive folder structure intact
  - [ ] Newsletter footer and SMS footer current
