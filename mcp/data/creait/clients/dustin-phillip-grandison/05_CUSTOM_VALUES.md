# Custom Values — Business-wide merge fields

**GHL Path:** Settings → Custom Values → + Add Custom Value

Custom values are site-wide variables. Change once, they update in every template. Critical for maintainability.

---

## The 12 custom values

| Key | Example Value | Used In |
|---|---|---|
| `business_name` | Dustin's Bespoke | Every template header/signoff |
| `business_phone` | (555) 555-0100 | SMS signoffs, email footer |
| `studio_address` | 123 Example Ave, Suite 4, City, ST | Consult + fitting confirmations |
| `studio_hours` | Tue–Sat, 10 AM – 6 PM | Out-of-office AI replies |
| `booking_consultation_url` | https://link.creait.com/…/private-consultation | WF1 welcome, social bios |
| `booking_fitting_url` | https://link.creait.com/…/fitting | WF5 fitting ready message |
| `lookbook_url` | https://dustinsbespoke.com/lookbook | WF1 welcome email, WF8 emails |
| `testimonial_page_url` | https://dustinsbespoke.com/testimonials | WF7, WF8 |
| `referral_form_url` | https://link.creait.com/…/refer | WF10 Day 15 referral |
| `review_link_google` | https://g.page/…/review | Deferred to Phase 5 |
| `dustin_signature_block` | "— Dustin / Dustin's Bespoke / (phone)" | Email signoff |
| `assistant_name` | [Assistant's first name] | Internal notification CC |

---

## API payload reference

POST `https://services.leadconnectorhq.com/locations/{locationId}/customValues`

```json
{
  "name": "business_phone",
  "value": "(555) 555-0100"
}
```

---

## Day 1 checklist

Before building any workflows or templates, fill in ALL 12 custom values with real data. Every template in the package references them. Missing values = broken messages.

**Ask Dustin on Day 1:**
1. Exact business phone number (the one connected to GHL)
2. Studio full address
3. Current studio hours (Tue–Sat 10–6 is the assumption — confirm)
4. Do you have a public lookbook URL? Testimonial page? If not, we skip those merge fields in Phase 1 and add in Phase 4 once the website pieces exist.
5. Assistant's first name (for internal notifications)
