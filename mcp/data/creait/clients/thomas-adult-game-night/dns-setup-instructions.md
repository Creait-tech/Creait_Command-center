# DNS Setup — `crm.adultgamenights.com`

**Owner:** Maurice (action in GoDaddy)
**Goal:** Point a CRM subdomain at CreateOS so all funnel pages, forms, and tracking links live on the brand domain.

---

## What you'll do
1. Log into GoDaddy → Domains → `adultgamenights.com` → DNS
2. Add the records below
3. Confirm propagation (5–30 min typically)
4. Add the domain inside CreateOS → Settings → Domains
5. Issue SSL inside CreateOS (auto)

---

## Records to add

### Option A — `crm.adultgamenights.com` (recommended)
Use this if you want the CRM/funnels at a subdomain and keep `www.adultgamenights.com` on Shopify.

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `crm` | `funnels.leadconnectorhq.com` | 600 |

After adding, in CreateOS:
- **Settings → Domains → Add domain** → `crm.adultgamenights.com`
- Click **Verify** → CreateOS will auto-issue SSL
- All funnel pages will then resolve at `https://crm.adultgamenights.com/<page-slug>`

### Option B — `*.go.adultgamenights.com` for short tracking links (optional)
If we want short tracking redirects (for SMS campaigns):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `go` | `link.msgsndr.com` | 600 |

---

## SPF/DKIM (email deliverability)

CreateOS sends transactional email through their SMTP. To improve deliverability and prevent your emails from landing in spam:

### SPF — add or merge
```
v=spf1 include:mailgun.org include:_spf.leadconnectorhq.com ~all
```
(GoDaddy → DNS → if SPF record exists, merge `include:_spf.leadconnectorhq.com` into the existing record. Don't create two SPF records — Gmail will reject.)

### DKIM — add the records CreateOS gives you
1. In CreateOS: **Settings → Email Services → Dedicated Domain → Add Domain → adultgamenights.com**
2. Copy the 2 CNAME records it generates (`mailo._domainkey` and `s1._domainkey` or similar)
3. Add both to GoDaddy DNS as CNAMEs
4. Click **Verify** in CreateOS

### DMARC — recommended
| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:adultgamenights@gmail.com` | 600 |

Start with `p=none` so we observe results. Tighten to `p=quarantine` after 30 days of clean reports.

---

## After DNS is live

Run from `/Users/reecebyob/adult-game-nights-build`:
```bash
node scripts/07-verify-domain.js
```
(Script will be created in Phase 4 — for now confirm in CreateOS UI.)

---

## Open question for Maurice
- Do you want `www.adultgamenights.com` to stay on Shopify (current setup) and CRM at a subdomain (`crm.…`)? Or migrate the entire root domain to CreateOS later?
- **Recommendation:** Keep Shopify on root (proven e-comm) and use `crm.…` for funnels/landing pages. Use Shopify's redirect rules for any deprecated funnel URLs.
