# Tag Taxonomy

Tags drive segmentation, workflow entry, and reporting. **Rule:** prefixed with a category so Sabrina can read them at a glance.

## Product Interest
- `product:cyber`
- `product:pro-liab`
- `product:surety`
- `product:commercial-gl`
- `product:workers-comp`
- `product:multi` (cross-sell candidate)

## Lifecycle Stage (mirrors pipeline)
- `stage:cold-lead`
- `stage:warm-lead`
- `stage:contacted`
- `stage:quoted`
- `stage:bound`
- `stage:lost`
- `stage:dormant` (auto-applied after 90 days no activity)
- `stage:client-active` (has at least one bound policy)

## Source
- `source:website`
- `source:ig`
- `source:fb`
- `source:li`
- `source:tt`
- `source:google`
- `source:chatgpt-llm`
- `source:referral`
- `source:networking-event`
- `source:business-card`
- `source:cold-outbound`

## Compliance
- `compliance:standard` (5-yr retention)
- `compliance:medicare-medicaid` (10-yr retention)
- `consent:email-marketing`
- `consent:sms-marketing`
- `unsubscribed:email`
- `unsubscribed:sms`

## Campaign / Sequence Entry
- `seq:cyber-nurture`
- `seq:pro-liab-nurture`
- `seq:surety-nurture`
- `seq:business-card-drip`
- `seq:quote-follow-up`
- `seq:renewal-11mo`
- `seq:cross-sell-cyber-to-proliab`
- `seq:cross-sell-proliab-to-cyber`
- `seq:newsletter-weekly`

## Action Flags
- `flag:reply-stop` (auto-applied when contact replies; exits all sequences)
- `flag:do-not-contact`
- `flag:vip`
- `flag:high-credit-risk` (surety-specific)
- `flag:has-claim` (coverage pricing affected)

## Events / Attribution (free text suffix)
- `event:<slug>` e.g., `event:blackest-tech-2026`, `event:chamber-mixer-march`
- `referrer:<contact-id>` e.g., `referrer:abc123`

## Tag Hygiene Rules
1. `stage:*` tags — only one active per contact. Workflow must remove old stage tag when applying new.
2. `flag:reply-stop` wins — any sequence checks this tag at every step and exits if present.
3. `consent:*` and `unsubscribed:*` — unsubscribed wins, period. Filter every bulk send by `NOT unsubscribed:email/sms`.
