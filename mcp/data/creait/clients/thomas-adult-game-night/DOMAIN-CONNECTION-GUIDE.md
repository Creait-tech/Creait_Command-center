# Custom Domain Connection — `liquorstore.adultgamenights.com`

**Goal:** point a real branded URL at the cinematic landing page so:
- A2P 10DLC carrier reviewers see `adultgamenights.com` (not a `*.vercel.app` URL)
- The brand looks legit in shared links + ads
- All `<link rel="canonical">` tags resolve correctly

**Time:** 10 min hands-on + 5 min to a few hours DNS propagation
**Where:** Shopify admin (DNS owner) + Vercel dashboard (where the site lives)

---

## What we're doing

The landing is currently at:
- `https://agn-cinematic-landing.vercel.app` (Vercel auto-assigned)

We want it ALSO accessible at:
- `https://liquorstore.adultgamenights.com` ← the A2P-friendly URL

`adultgamenights.com` lives on Shopify, so we add a CNAME record there. The `liquorstore` subdomain gets pointed at Vercel, which serves our landing page.

---

## STEP 1 — Add the subdomain in Vercel (2 min)

1. Open https://vercel.com/creaits-projects/agn-cinematic-landing
2. **Settings** → **Domains** (left sidebar)
3. **Add** → enter: `liquorstore.adultgamenights.com`
4. Click **Add**
5. Vercel will show a "DNS configuration required" screen with the CNAME target:
   - **Type:** `CNAME`
   - **Name:** `liquorstore`
   - **Value:** `cname.vercel-dns.com`
   - Copy this — you'll need it for Step 2

⚠️ Leave this tab open. After DNS propagates Vercel will auto-detect and issue an SSL cert. The "Verified" checkmark appears within minutes once Shopify is configured.

---

## STEP 2 — Add the CNAME record in Shopify (3 min)

1. Open Shopify admin → https://admin.shopify.com
2. **Settings** → **Domains** (bottom of the sidebar)
3. Find `adultgamenights.com` in the domain list
4. Click the **`···`** menu → **DNS settings**
5. Scroll to **Custom records** → click **Add custom record**
6. Fill in:
   - **Type:** CNAME
   - **Name:** `liquorstore` *(just the subdomain, NOT the full liquorstore.adultgamenights.com)*
   - **Points to:** `cname.vercel-dns.com`
   - **TTL:** leave default (or set to 3600)
7. Click **Save**

That's it. Shopify owns the DNS, Vercel owns the routing.

---

## STEP 3 — Wait for DNS + SSL (5-60 min, often instant)

Back in Vercel → Settings → Domains:
- The `liquorstore.adultgamenights.com` entry will show "Invalid Configuration" for a few minutes
- Auto-rechecks every 30 seconds
- When DNS propagates → status flips to "Valid Configuration"
- ~30 seconds later → Vercel auto-provisions a Let's Encrypt SSL cert
- Final status: green "Configuration Valid" + 🔒 padlock indicator

You can also manually check propagation:
```bash
dig CNAME liquorstore.adultgamenights.com
# Expected: cname.vercel-dns.com.
```

If it's been more than 60 min and DNS hasn't propagated:
1. Double-check the CNAME value in Shopify is exactly `cname.vercel-dns.com` (no trailing slash, no extra text)
2. Check there's no conflicting A record for `liquorstore` (would override CNAME)
3. Some networks cache aggressively — try `dig +short` on a different network or use `https://dnschecker.org/#CNAME/liquorstore.adultgamenights.com`

---

## STEP 4 — Verify the landing loads (1 min)

Once Vercel shows "Valid Configuration":

```bash
# Should return 200 OK
curl -sIL https://liquorstore.adultgamenights.com | head -1

# Should serve the landing page HTML
curl -sL https://liquorstore.adultgamenights.com | grep -i "<title>"
# Expected: <title>Adult Game Nights — The Liquor Store Game</title>

# Legal pages should also resolve
curl -sIL https://liquorstore.adultgamenights.com/privacy | head -1
curl -sIL https://liquorstore.adultgamenights.com/terms | head -1
curl -sIL https://liquorstore.adultgamenights.com/sms | head -1
# All should return 200 OK
```

Or just open in a browser:
- https://liquorstore.adultgamenights.com → cinematic landing loads
- https://liquorstore.adultgamenights.com/privacy → privacy page
- https://liquorstore.adultgamenights.com/terms → terms page
- https://liquorstore.adultgamenights.com/sms → SMS policy

---

## STEP 5 — Set the primary domain in Vercel (optional, 1 min)

So that any visit to `agn-cinematic-landing.vercel.app` redirects to `liquorstore.adultgamenights.com` (good for SEO + tracking):

1. Vercel → Settings → Domains
2. Click the `···` next to `liquorstore.adultgamenights.com`
3. Toggle **Redirect to this domain** to ON
4. Save

Now the Vercel URL becomes a 308 redirect to your custom domain.

---

## STEP 6 — Update A2P submission (if already started)

If you already started the A2P 10DLC submission with `agn-cinematic-landing.vercel.app` as the Website URL:
1. Pause / cancel the in-flight submission (Settings → Trust Center → manage Brand)
2. Re-submit with `https://liquorstore.adultgamenights.com` as the Website URL
3. The legal pages move with the domain — `/privacy`, `/terms`, `/sms` all resolve at the new URL automatically

If you haven't submitted yet — just use `https://liquorstore.adultgamenights.com` from the start. See `A2P-SUBMISSION-GUIDE.md` for the full field-by-field walkthrough.

---

## Troubleshooting

**"Subdomain already in use" error in Shopify:**
- Some Shopify themes auto-create subdomains. Delete any existing CNAME for `liquorstore` before adding the Vercel one.

**SSL cert not issuing:**
- Vercel needs HTTP requests to succeed before issuing the cert (Let's Encrypt validation). If you have a Cloudflare proxy in the chain it can block this — temporarily disable the orange-cloud proxy, let Vercel issue the cert, then re-enable.

**Redirect loop:**
- Happens if Cloudflare is set to "Flexible SSL" while Vercel forces HTTPS. Switch Cloudflare to "Full (strict)" SSL.

**Pages load but legal subpages 404:**
- `vercel.json` must include `cleanUrls: true` and rewrites for `/privacy`, `/terms`, `/sms`. We already set this up — `cat vercel.json` from the landing folder to confirm.

---

## Alternative — use `www.adultgamenights.com`?

If the Shopify storefront is on the apex `adultgamenights.com` AND on `www.adultgamenights.com`, **don't** point `www` at Vercel (you'd kill the storefront).

Use a different subdomain like:
- `liquorstore.adultgamenights.com` ← **recommended** (matches the landing's purpose)
- `landing.adultgamenights.com`
- `crm.adultgamenights.com` (we may use this for the broader CRM-hosted site later)

---

**Author:** Maurice / CREAIT
**Date:** 2026-06-10
**Status:** Ready to execute by Thomas. Estimated time: 10 min hands-on + DNS wait.
