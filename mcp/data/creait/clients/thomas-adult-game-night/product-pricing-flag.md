# Product Pricing Inconsistency — Decision Needed

**Flagged during Phase 6 endpoint probe (2026-05-04).**

The Liquor Store Adult Board Game has **conflicting prices** across our build artifacts. Before AI agents go live, Maurice/Thomas needs to pick one and we'll update everything to match.

## The mismatch

| Source | Price | CompareAt / Reference |
|---|---|---|
| Phase 5 KB (`config/knowledge-base.json`) | **$34.04** | Quoted in 6 FAQs (e.g., "How much does the game cost?") |
| Phase 5 KB Document 2 source (`knowledge-base-source.md`) | **$34.04** | Carried forward from Phase 5 spec |
| CreateOS product (`/products/69ef87584052980e4dfbefa2/price`) | **$65.00** | `compareAtPrice: $75` |
| Original Phase 5 prompt | **$34.04** | "Price: $34.04 (currently — Thomas adjusts pricing periodically)" |

## Why it matters

- The Voice AI Receptionist will quote **$34.04** in calls (KB lookup).
- The Conversation AI Sales Rep will quote **$34.04** in DMs/SMS (same KB).
- Anyone clicking through to a CreateOS-hosted checkout will see **$65/$75**.
- Anyone going to adultgamenights.com (Shopify) sees whatever Shopify is configured at — unknown from this build.

If the agents tell a customer $34 and they get to checkout at $65, that's a complaint waiting to happen.

## Possible answers

1. **$34.04 is correct** — KB is right; the in-CRM product needs to be updated to $34.04 (and compareAtPrice removed or set to $40).
2. **$65 is correct** — KB needs to be updated to $65 across 6 FAQs; the original Phase 5 spec was stale.
3. **$65 with $75 compareAt is a sale strategy** — KB should mention "currently $34.04 launch promo, regularly $65" or similar. Then both sources align.
4. **Different prices for direct vs retail** — $34.04 = wholesale to some channel, $65 = retail; KB should specify "online retail $65, ask about wholesale tiers."

## How to fix once Thomas decides

### If answer is $34.04

```bash
# Update the in-CRM product price
node scripts/19-update-product-price.js --product=69ef87584052980e4dfbefa2 --price=3404 --compareAt=3999
```
(Script not yet written — straightforward `POST /products/{id}/price` update once spec is locked.)

### If answer is $65

Update `config/knowledge-base.json`:
- Find all FAQs with $34.04 (6 instances in `liquor_store_game` and `wholesale` topics)
- Change to $65
- Re-run `node scripts/13-create-knowledge-base.js` — currently idempotent on question, so duplicates won't appear, but **answer text won't update**. Need to delete + recreate the affected FAQs (or extend the script with `--force-refresh-answers`).

### If answer is "promo + regular"

Update KB FAQs to: `"$34.04 right now (launch promo). Regular price $65. Free shipping on orders over $50."` — re-seed KB.

## Recommendation for Maurice/Thomas

Take 60 seconds, decide, message back with: `"It's $X — please align."` Then I'll script the fix and re-run.

In the meantime, **do NOT go live with the AI agents** until this is resolved — the worst customer experience possible is "AI told me $34, checkout was $65."

## Other product details to verify while we're here

The CreateOS product is currently:
- **Type:** `DIGITAL` ← should probably be `PHYSICAL` (it's a board game that ships)
- **Name:** `"The Liquor Store "` ← trailing space, should be `"The Liquor Store Adult Board Game"` to match KB
- **Status:** `active` ✅
- **Variants:** 0 ← if there are different versions or bundles, set them up
- **Medias:** 0 ← no product image, should add

These are all editable via API once the price call is made.
