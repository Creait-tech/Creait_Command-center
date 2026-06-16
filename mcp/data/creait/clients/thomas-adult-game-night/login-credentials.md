# Login Credentials — Where Everything Lives

**Security reminder:** Never store real passwords in plain text. This document is a *map* — it tells you where to find credentials, not what they are.

---

## Master vault

All shared credentials are in **1Password**, vault: **"Adult Game Nights — CRM"**.
Owner: Maurice Grant. Access: Maurice + Thomas.

---

## The credentials map

| Service | Where the credential lives | Who owns access |
|---|---|---|
| CreateOS / GHL CRM login | 1Password — "AGN CreateOS Login" | Thomas + Maurice |
| GHL Private Integration Token (PIT) | `.env` file in `/Users/reecebyob/adult-game-nights-build/` | Maurice (gitignored, never committed) |
| Shopify admin | 1Password — "AGN Shopify Admin" | Thomas |
| Klaviyo (legacy, source for migration) | Thomas's personal pass manager | Thomas |
| Google Workspace (info@adultgamenights.com or similar) | Thomas's Google account | Thomas |
| Google My Business | Same as Google Workspace | Thomas |
| Stripe | Thomas's Stripe account (TBD — not yet created) | Thomas |
| ShipStation | TBD — not yet integrated | Thomas |
| QuickBooks | TBD — not yet integrated | Thomas |
| Mailgun (custom email domain) | Set up by CreateOS once DNS is live | Maurice |
| Twilio (custom SMS, optional) | TBD if needed | — |
| Linktree | Thomas's personal pass manager | Thomas |
| Restream | Thomas's personal pass manager | Thomas |
| Buffer (legacy social, retiring) | Thomas's personal pass manager | Thomas |
| GoDaddy (domain registrar) | Thomas's GoDaddy account | Thomas |
| Anthropic API (Claude usage) | Maurice's API account | Maurice |
| ElevenLabs (Voice AI cloning, Pass 2) | Maurice's account | Maurice |

---

## Social media accounts (already connected to CreateOS)

| Platform | Handle | Connected? | OAuth expires |
|---|---|---|---|
| Facebook | "Adult Game Nights" page | ✅ | 2026-06-27 |
| Instagram | @adultgamenights | ✅ | 2026-06-27 |
| TikTok | @adultgamenights | ✅ | 2027-04-28 |
| YouTube | @adultgamenights (verified) | ⚠️ | 2026-05-04 — needs re-auth NOW |

---

## Critical phone numbers

- **Thomas:** 478-654-9574
- **CREAIT business line:** 404-800-1192 (Maurice's team)
- **Adult Game Nights LLC (CreateOS sub-account phone, when provisioned):** TBD

---

## Token rotation schedule

| Credential | Rotate every | Last rotated |
|---|---|---|
| GHL PIT | 90 days | 2026-04-27 (initial issue) |
| Stripe API key | 90 days | (after first connection) |
| Social OAuth tokens | per platform expiry | track via health check |
| Anthropic API key | 90 days | Maurice's account |

Set calendar reminders 7 days before each expiry so you don't get caught.

---

## Process for adding/removing access

**To grant access (e.g., new team member):**
1. Maurice creates 1Password vault entry with their email
2. Sets permission tier (Admin / Manager / Staff / Read-only) per [`team-handoff.md`](../docs/team-handoff.md)
3. Updates this credentials map

**To revoke access (e.g., team departure):**
1. Maurice removes 1Password vault membership
2. Rotates ALL shared credentials (especially PIT, Stripe key)
3. Removes user from CreateOS Settings → My Staff
4. Updates this credentials map

---

## What to do if a credential leaks

1. Rotate it immediately (don't wait, don't ask)
2. Notify Maurice
3. Audit recent activity for any unauthorized actions
4. Document the incident in `/logs/security-incidents.md` (create if not exists)

---

## What's NOT in this map (because it shouldn't be anywhere)

- Thomas's personal banking
- Thomas's social media personal accounts (separate from AGN brand)
- Customer payment details (handled by Stripe directly, never stored in CRM)
- Any password Thomas reuses across multiple services (please use 1Password — Maurice can help set up)

---

**Maurice will keep this map current. If you see a credential that should be added, ping Maurice and we'll add it.**
