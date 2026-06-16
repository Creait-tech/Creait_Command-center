# Task 14: Content Prep — Franklin Insurance Phase 1 MVP

**Overview:** This file contains all ready-to-paste content for Task 14 sub-steps. Navigate each section in order, paste content exactly as shown, and check off the acceptance criteria when complete. No content writing required — just copy/paste and verify.

---

## 14.1 — DNS & Email Authentication at Cloudflare

**What you're doing:** Configuring SPF, DKIM, and DMARC records in Cloudflare so CreaitOS email goes out from `mail@franklininsurancesolutions.com` without landing in spam.

### Navigation

1. Log into CreaitOS: `app.getcreait.com/v2/location/pIevOG07v2c9Ry6wKOol`
2. Go: **Settings** → **Email Services** → **Dedicated Domain** → **Add Domain**
3. Enter: `franklininsurancesolutions.com`
4. CreaitOS will generate 3 DNS records (SPF, DKIM, DMARC)

### What to expect

CreaitOS will display records like:

```text
SPF Record (TXT):
Name: @
Value: v=spf1 include:sendgrid.net ~all

DKIM Record (CNAME):
Name: selector1._domainkey
Value: selector1.sendgrid.net

DMARC Record (TXT):
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@franklininsurancesolutions.com; pct=100;
```

**⚠️ IMPORTANT:** The exact values above are examples only. Copy the actual values CreaitOS provides.

### Add records to Cloudflare

1. Log into Cloudflare: `cloudflare.com`
2. Select domain: `franklininsurancesolutions.com`
3. Go: **DNS** → **Records**
4. For each of the 3 records CreaitOS generated:
   - Click **Add record**
   - Type: TXT (for SPF/DMARC) or CNAME (for DKIM)
   - Name: (use CreaitOS value)
   - Content/Value: (paste CreaitOS value exactly)
   - TTL: Auto
   - Proxy: DNS only
   - Click **Save**

### ⚠️ SPF conflict check (IMPORTANT)

**If Sabrina's existing Wix site sends email:**
- Wix may already have an SPF record on `franklininsurancesolutions.com`
- Cloudflare will show an error or warning if two SPF records exist
- **Solution:** You cannot have two SPF records. You must MERGE them into one:
  - Copy Wix's existing SPF value
  - Copy CreaitOS's SPF value
  - Combine into a single record: `v=spf1 include:wix.com include:sendgrid.net ~all`
  - Replace the old SPF with the merged version

**If you see an error, contact Sabrina or Wix support to confirm the Wix SPF before merging.**

### DMARC policy recommendation

The DMARC record CreaitOS generates should include:
```text
v=DMARC1; p=none; rua=mailto:dmarc@franklininsurancesolutions.com; pct=100;
```

This is **monitoring mode** — emails that fail DKIM/SPF are NOT blocked, but monitoring reports are sent to the `rua` (reporting) address. This is safe for the first 1-2 weeks to verify all email is working. Once verified, you can upgrade to `p=quarantine` (spam folder) or `p=reject` (reject entirely).

### Verification

1. In CreaitOS: Go to **Conversations** → **New Conversation**
2. Send a test SMS to your own phone (or email test to your personal inbox)
3. Check the From line — it should show `Franklin Insurance Solutions <mail@franklininsurancesolutions.com>`
4. Check that it arrives in Inbox, NOT Spam
5. If in Spam, wait 24-48 hours for DNS to propagate, then try again

### Acceptance check

- [ ] All 3 DNS records added to Cloudflare
- [ ] No errors on Cloudflare DNS panel
- [ ] Test email from CreaitOS arrives in Inbox with correct From address
- [ ] SPF conflict resolved (if applicable)

---

## 14.2 — A2P 10DLC: Sacrificial Site + SMS Registration

**What you're doing:** Registering a separate domain for A2P compliance, deploying a minimal sacrificial site there, then registering the Houston phone number for SMS in CreaitOS (approval takes 1-3 weeks but doesn't block other work).

### DECISION: Choose a domain name

You don't have a sacrificial A2P domain yet. **Choose one of these:**

| Option | Why |
|--------|-----|
| `franklin-insurance-compliance.com` | **[RECOMMENDED]** Clearest for regulators, compliance-focused signals legitimacy |
| `franklininsurancehq.com` | Shorter, HQ angle |
| `getfranklininsurance.com` | Call-to-action friendly |
| `franklinpolicyhub.com` | "hub" signals resource center |

**Recommendation:** `franklin-insurance-compliance.com` — the word "compliance" explicitly signals to A2P reviewers that this is a legitimate compliance landing page, not a marketing funnel. Cost is ~$12-15/yr.

### Step 1: Register the domain

Choose a registrar (speed matters):

**Option A: Cloudflare Registrar (fastest — integrated)**
1. Go to Cloudflare → Your dashboard
2. Search for domain in search bar
3. Register `franklin-insurance-compliance.com`
4. Add Cloudflare nameservers
5. Takes ~5-10 minutes

**Option B: Namecheap (very fast, cheap)**
1. Go to `namecheap.com`
2. Search `franklin-insurance-compliance.com`
3. Add to cart, checkout
4. Update nameservers to Cloudflare (or keep at Namecheap)
5. Takes ~5-15 minutes

Once registered, you'll point it to your hosting (Step 2).

### Step 2: Deploy the sacrificial site

Choose a hosting option:

**Option A: Vercel (fastest, 5 minutes)**
1. Copy the HTML below
2. Save as `index.html` on your desktop
3. Go to `vercel.com/new`
4. Drag `index.html` into the upload area
5. Vercel generates a URL like `index-xxxxxx.vercel.app`
6. In Cloudflare DNS (or your registrar), add a CNAME:
   - Name: `@`
   - Target: `index-xxxxxx.vercel.app`
7. Wait 2 minutes for DNS to propagate

**Option B: Netlify (also 5 minutes)**
1. Copy the HTML below
2. Save as `index.html`
3. Go to `app.netlify.com/drop`
4. Drag `index.html` into the drop zone
5. Netlify generates a URL
6. Same DNS CNAME setup as Vercel

**Option C: GitHub Pages (5 minutes if you know git)**
1. Create a GitHub repo: `franklin-insurance-compliance`
2. Create file `index.html` with the HTML below
3. Enable Pages: Settings → Pages → Branch: main → Save
4. GitHub gives you a URL
5. CNAME setup same as above

---

### HTML content to deploy

**Save this as `index.html` and deploy to your chosen host above:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Franklin Insurance Solutions — Compliance & Information</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f9f9f9;
        }
        header {
            background-color: #1a3a52;
            color: white;
            padding: 2rem;
            text-align: center;
        }
        header h1 {
            margin-bottom: 0.5rem;
        }
        main {
            max-width: 800px;
            margin: 2rem auto;
            padding: 0 1rem;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 2rem;
        }
        section {
            margin-bottom: 2rem;
        }
        h2 {
            color: #1a3a52;
            margin-bottom: 1rem;
            border-bottom: 2px solid #1a3a52;
            padding-bottom: 0.5rem;
        }
        p {
            margin-bottom: 1rem;
        }
        .business-info {
            background-color: #f0f0f0;
            padding: 1rem;
            border-left: 4px solid #1a3a52;
            margin-bottom: 1rem;
        }
        footer {
            text-align: center;
            padding: 1rem;
            color: #666;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <header>
        <h1>Franklin Insurance Solutions</h1>
        <p>Commercial Insurance Brokerage — Houston, Texas</p>
    </header>

    <main>
        <section class="business-info">
            <h2>Business Information</h2>
            <p><strong>Business Name:</strong> Franklin Insurance Solutions LLC</p>
            <p><strong>EIN:</strong> [MAURICE: INSERT EIN HERE]</p>
            <p><strong>Address:</strong> 3314 Britt Moore Rd, Suite 1000B, Houston, TX 77043</p>
            <p><strong>Phone:</strong> 281-819-2505</p>
            <p><strong>Email:</strong> info@franklininsurancesolutions.com</p>
        </section>

        <section>
            <h2>About Us</h2>
            <p>Franklin Insurance Solutions is a licensed commercial insurance brokerage based in Houston, Texas. We specialize in cyber insurance, professional liability, surety bonds, and comprehensive commercial coverage products. We serve small and mid-size businesses across the United States.</p>
            <p>Our lines of coverage include:</p>
            <ul style="margin-left: 1.5rem;">
                <li>Cyber Insurance</li>
                <li>Professional Liability</li>
                <li>Surety Bonds</li>
                <li>General Liability</li>
                <li>Commercial Auto</li>
                <li>Group Benefits</li>
                <li>Liquor Liability</li>
                <li>Additional specialized lines</li>
            </ul>
        </section>

        <section>
            <h2>Communications</h2>
            <p>By submitting a form on our website or providing us your phone number, you consent to receive SMS messages and emails from Franklin Insurance Solutions about insurance coverage options, quotes, and related services.</p>
            <p><strong>Message and data rates may apply.</strong> Reply <strong>STOP</strong> to any message to opt out at any time. Reply <strong>HELP</strong> for assistance.</p>
        </section>

        <section>
            <h2>Privacy Policy</h2>
            <p>Franklin Insurance Solutions collects contact information including name, phone number, email address, and business details when you submit a form or contact us directly. We use this information solely to respond to your inquiry and provide insurance quotes and services.</p>
            <p>We do not sell or share your information with third parties except as required by law or to facilitate insurance placement. All information is stored securely and retained only as long as necessary.</p>
        </section>

        <section>
            <h2>Terms of Service</h2>
            <p>Franklin Insurance Solutions provides information and insurance brokerage services. All information on this site is provided for informational purposes only and does not constitute legal or financial advice. Insurance coverage, terms, and conditions are subject to underwriter approval.</p>
            <p>By using this site and submitting inquiries, you agree that Franklin Insurance Solutions may contact you about insurance coverage. You are responsible for verifying all information provided and ensuring accuracy of your contact details.</p>
        </section>
    </main>

    <footer>
        <p>&copy; 2026 Franklin Insurance Solutions LLC. All rights reserved.</p>
    </footer>
</body>
</html>
```

### Step 3: Point domain to hosting

Once you've deployed the HTML:

1. Log into your domain registrar (Cloudflare, Namecheap, etc.)
2. Go to DNS records
3. Add a CNAME record:
   - **Name:** `@` (or leave blank — means root domain)
   - **Target:** (your Vercel/Netlify/GitHub URL)
   - **TTL:** Auto
4. Save and wait 5-10 minutes for propagation
5. Test: go to `franklin-insurance-compliance.com` — should see the page above

### Step 4: Register for A2P 10DLC in CreaitOS

Now register the Houston phone number for SMS sending:

**Navigation:**
1. CreaitOS → **Settings** → **Phone Numbers**
2. Click on the Houston number (purchased May 1)
3. Click **Configure for SMS** or **Set up 10DLC**
4. A form will appear asking for registration details

**Fill in these fields exactly:**

```text
Business Legal Name:
Franklin Insurance Solutions LLC

EIN:
[MAURICE: INSERT YOUR EIN]

Business Address:
3314 Britt Moore Rd, Suite 1000B, Houston, TX 77043

Business Website:
franklin-insurance-compliance.com

Business Vertical/Industry:
Insurance / Financial Services

Sample Message 1 (copy exactly):
Hey Sarah, this is Sabrina at Franklin Insurance Solutions. I got your inquiry about cyber coverage — want to grab 15 min this week to walk through your options? — Sabrina

Sample Message 2 (copy exactly):
Quick check: did the cyber quote I sent come through okay? Let me know if you have questions. — Sabrina

Sample Message 3 (copy exactly):
Reply STOP to stop receiving messages. Reply HELP for help.

Opt-In Mechanism Description:
Customers opt in by checking a TCPA consent checkbox when submitting any form on franklininsurancesolutions.com or franklin-insurance-compliance.com. The exact opt-in language customers see is: "I agree to receive emails and text messages from Franklin Insurance Solutions about insurance coverage. Message and data rates may apply. Reply STOP to opt out at any time."

How customers can opt out:
Reply STOP to any message.

How customers can get help:
Reply HELP to any message, or call 281-819-2505.
```

**Submit the form.** You'll get a confirmation and a reference number. Keep it.

### ⏱️ Timeline & next steps

- **Registration pending:** 1-3 weeks (Twilio/carriers review)
- **SMS won't send yet** — wait for approval email
- **You can proceed with all other Phase 1 work in parallel** — approval doesn't block anything else
- Once approved, SMS will auto-send from the Houston number in CreaitOS Conversations, Flows, and Forms

### Acceptance check

- [ ] Domain `franklin-insurance-compliance.com` registered
- [ ] Sacrificial site deployed and accessible at domain
- [ ] A2P 10DLC registration form submitted in CreaitOS
- [ ] Confirmation reference number saved
- [ ] Awaiting approval (1-3 weeks)

---

## 14.3 — Calendar Configuration

**What you're doing:** Setting up Sabrina's discovery call calendar with hours, buffer time, notifications, and booking URL.

### Navigation

1. CreaitOS → **Calendars** (left sidebar)
2. Click on **Sabrina — Discovery Call** (or similar name if different)
3. Click **Edit** or **Settings**

### Fill in these fields

**Availability Hours:**
```text
Monday–Friday: 9:00 AM – 5:00 PM CT
Lunch break: 12:00 PM – 1:00 PM (block this time)
Saturday–Sunday: Closed
```

**Buffer Time:**
```text
Before appointment: 15 minutes
After appointment: 15 minutes
(Gives Sabrina time to prepare and debrief)
```

**Maximum Bookings Per Day:**
```text
4 calls per day
(Reasonable for discovery calls; prevents overbooking)
```

**Notifications:**
```text
Email Sabrina: Yes, when appointment is booked
SMS Sabrina: Yes, when appointment is booked
Zoom link: Auto-include in email/SMS confirmation
```

**Default Appointment Duration:**
```text
30 minutes
```

**Confirmation Page Text (what customer sees after booking):**
```text
You're booked! Looking forward to chatting. — Sabrina
```

**Reminder: Email (24 hours before appointment)**
```text
Reminder: we're connecting tomorrow at {{appointment_time}} CT. Looking forward to it! — Sabrina
```
*(CreaitOS will auto-replace `{{appointment_time}}` with actual time)*

**Reminder: SMS (1 hour before appointment)**
```text
Hey {{first_name}}, just a quick reminder we're chatting in an hour. Talk soon! — Sabrina
```

**Calendar URL / Booking Link:**
- CreaitOS will provide a default URL like `calendar.getcreait.com/sabrina-discovery`
- **Recommendation:** If you've set up the DNS subdomain CNAME in Cloudflare, use: `book.franklininsurancesolutions.com/sabrina`
  - To set this up: Cloudflare DNS → Add CNAME `book` → Points to CreaitOS calendar URL
  - Takes ~5 minutes, but not required for Phase 1 — you can use default URL and upgrade later
- **For Phase 1:** Use whatever default URL CreaitOS generates; note it for docs

### Save and test

1. Click **Save** in CreaitOS
2. Open incognito/private browser (so you're not logged in)
3. Go to the booking calendar URL
4. Book a test appointment (use a different email, not Sabrina's)
5. Verify:
   - Confirmation email arrives at the test email
   - SMS arrives at Sabrina's phone (or test phone if you set one)
   - Zoom link is included
   - 15-min buffer is visible (e.g., if you book at 10am, next slot shows 10:45am)

### Acceptance check

- [ ] Hours set: Mon-Fri 9am-5pm CT with 12-1pm lunch block
- [ ] Buffer: 15min before/after
- [ ] Max 4 bookings/day
- [ ] Notifications enabled (email + SMS)
- [ ] Test booking completed, confirmations received
- [ ] Calendar URL noted for documentation

---

## 14.4 — Branding Upload (Logo & Colors)

**What you're doing:** Uploading Sabrina's brand identity (logo, brand colors) into CreaitOS so all funnels, emails, and forms match her brand.

### Navigation

1. CreaitOS → **Settings** (top-right gear icon or left sidebar)
2. Go: **Business Profile** or **Branding**

### What you need from Sabrina's PowerPoint

Before you start, extract:
1. **Logo** — export as PNG with transparent background (if not already). If only JPG available, save it; CreaitOS accepts both.
2. **Primary color** — the main brand color (e.g., navy blue). Note the hex code (e.g., `#1a3a52`). If PowerPoint only shows RGB or CMYK:
   - Open `coolors.co` in a new tab
   - Click "Input" and paste RGB values
   - Coolors shows you the hex code
3. **Accent color** — secondary brand color (e.g., gold, teal). Same process.

### Fill in these fields

```text
Business Name:
Franklin Insurance Solutions

Logo:
[Upload PNG file extracted from PowerPoint]

Primary Color (Hex):
[Maurice: extract from PowerPoint or use coolors.co]
Example format: #1a3a52

Accent Color (Hex):
[Maurice: extract from PowerPoint]
Example format: #d4af37

Address:
3314 Britt Moore Rd, Suite 1000B, Houston, TX 77043

Phone:
281-819-2505
(Use the Houston number purchased May 1, or ask Sabrina if this is different)

Email:
info@franklininsurancesolutions.com

Industry:
Insurance

Time Zone:
America/Chicago
```

### Save

1. Click **Save** in CreaitOS
2. Go to **Dashboard** or **Funnel Preview** — you should see:
   - Logo in top-left
   - Brand colors reflected in buttons, links, headers
   - Address displayed in footer or contact section

### Acceptance check

- [ ] Logo uploaded and visible on dashboard
- [ ] Primary and accent colors set
- [ ] Address displays correctly
- [ ] Phone and email populated
- [ ] Time zone: America/Chicago
- [ ] Colors reflected in funnel/form preview

---

## 14.5 — Set Houston Number as Default Outbound SMS

**What you're doing:** Configuring CreaitOS to use the Houston phone number (not a generic Twilio number) when sending SMS from conversations, flows, or forms.

### Navigation

1. CreaitOS → **Settings** (gear icon)
2. Go: **Phone Numbers**
3. Click on the **Houston number** (purchased May 1)
4. Look for: **Set as Default Outbound** or **Default SMS Number**
5. Click the toggle or button to enable it

### What this does

- When Sabrina sends an SMS from **Conversations**, it will say "From: [Houston #]"
- When a Flow or Form triggers an SMS, it will use this number
- Customers see a recognizable, local Houston number — higher engagement than generic Twilio

### ⚠️ Note: SMS won't actually send yet

**SMS sending is blocked until A2P 10DLC approval (Section 14.2)** completes. This step just sets the routing preference. Once approval comes through (1-3 weeks), SMS will auto-send from this number.

### Test

1. Go: **Conversations** → **New Conversation**
2. Start an SMS (not email)
3. Look at the **From** dropdown — Houston number should be selected/default
4. (Don't actually send a test yet — will fail until A2P approval)

### Acceptance check

- [ ] Houston number set as default outbound
- [ ] From dropdown in Conversations shows Houston number
- [ ] SMS sending disabled until A2P approval (expected state)

---

## Summary

When all 5 sections are complete:

✅ **14.1 — DNS** Email authentication (SPF/DKIM/DMARC) live  
✅ **14.2 — A2P** Sacrificial site deployed, SMS registration pending (1-3 weeks)  
✅ **14.3 — Calendar** Discovery call booking live  
✅ **14.4 — Branding** Logo and colors applied across CreaitOS  
✅ **14.5 — Phone** Houston number set as default (ready once A2P approved)  

**Next steps (not in Task 14):**
- Task 15: Forms (lead capture, Veracity forms)
- Task 16: Flows (email/SMS automation)
- Task 17: Go-live & monitoring

**Questions?** Check original brief or contact Sabrina directly.
