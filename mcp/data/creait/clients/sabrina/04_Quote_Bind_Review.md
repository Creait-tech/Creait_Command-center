# Quote, Bind, Renewal, Review — Copy

---

## Email_Quote_01_Here_Is_Your_Quote (transactional)

**Subject:** Your {{opportunity.product}} quote from {{opportunity.carrier}}

```
{{contact.first_name}},

Attached is your quote for {{opportunity.product}}. Plain-English version below the line.

── QUOTE SUMMARY ──
Carrier: {{opportunity.carrier}}
Annual Premium: ${{opportunity.quote_amount}}
Quote Expires: {{opportunity.quote_expires}}
Key Coverages:
  · [pulled from quote data]
  · [pulled from quote data]

Two options to move forward:

  ✅ Accept & Bind → [button]
  💬 Questions First → reply or book a call: {{user.booking_link}}

If you want to shop around, I can pull 2 more markets — just say the word.

— Sabrina
```

Accept button = click-through link that moves opportunity to Bound + triggers bind workflow. Include confirmation step (don't auto-bind without acknowledgment).

---

## SMS_Quote_01_Did_You_Get_It (Day 1)

```
{{contact.first_name}}, the quote I sent — did it land in your inbox? Check spam if you didn't see it. Happy to walk through it. — Sabrina
```

---

## Email_Quote_02_FAQ (Day 3)

**Subject:** Common questions on the quote I sent

```
{{contact.first_name}},

Most clients ask one of these three questions after seeing a quote. Here's the short version on each.

1. "Is there a cheaper option?"
   Often yes, but cheaper usually means lower limits or higher deductibles. I'll be straight with you about what's giving up coverage vs. giving up price.

2. "What's not covered?"
   Every policy has exclusions. The big ones on your policy are [pull key exclusions by product]. I walk through all of them before you bind.

3. "How fast can I get covered?"
   Same-day binding is normal. If you need a certificate of insurance for a contract, usually within 2 hours of bind.

What's the holdup, if any? Reply with one word and I'll respond quick.

— Sabrina
```

---

## SMS_Quote_02_Quick_Call (Day 5)

```
{{contact.first_name}}, 5 min call on the quote? Easier than email. — Sabrina
```

---

## Email_Quote_03_Expiring_Soon (Day 7)

**Subject:** Your quote expires {{opportunity.quote_expires}}

```
{{contact.first_name}},

Quick heads up — the quote I sent expires {{opportunity.quote_expires}}. After that date I have to re-quote, and rates can move.

If you're still interested, let's lock it in this week. Click here to accept: [bind link]

Or text me what's holding you back and I'll help sort it.

— Sabrina
```

---

## Email_Quote_04_Last_Chance (Day 14)

**Subject:** Last note on your {{opportunity.product}} quote

```
{{contact.first_name}},

Going to close this one out on my end. If anything changes, reply and I'll reactivate the quote (pending no rate changes).

Thanks for considering Franklin Insurance Solutions.

— Sabrina
```

---

## Email_Bound_01_Welcome

**Subject:** Welcome to Franklin Insurance — you're covered

```
{{contact.first_name}},

Welcome. Your {{opportunity.product}} policy with {{opportunity.carrier}} is bound.

── YOUR POLICY ──
Policy #: {{opportunity.policy_number}}
Effective: {{opportunity.policy_effective_date}}
Expires: {{opportunity.policy_expiration}}
Premium: ${{opportunity.bound_premium}}

Your declarations page + ID cards are attached.

── WHAT TO DO IF A CLAIM HAPPENS ──
1. Call {{opportunity.carrier}} claims line (on your dec page)
2. Then call or text me — 281-819-2505
3. I'll walk you through the rest

── CLIENT PORTAL ──
Log in to see policy docs, certificates, and request changes anytime:
{{client_portal_link}}

── 30 DAYS FROM NOW ──
I'll check in to make sure the policy fits. 11 months from now, I'll start your renewal review.

Welcome to the team.

— Sabrina
Franklin Insurance Solutions
```

---

## Email_Review_01_Ask (3 days post-bind)

**Subject:** Quick 10-second favor, {{contact.first_name}}?

```
{{contact.first_name}},

How'd the process feel? One tap below:

😄 Great → [Google review link]
😐 Okay → [feedback form, goes to Sabrina only]
😕 Rough → [feedback form, goes to Sabrina only]

Either way, I read every reply personally. Thanks for trusting us with {{contact.business_legal_name}}.

— Sabrina
```

---

## SMS_Review_01_Nudge (5 days after above)

```
{{contact.first_name}}, if you have 30 seconds for a quick review it'd mean a lot. No pressure either way. [link] — Sabrina
```

---

## Email_Renewal_01_Heads_Up (T-30 days)

**Subject:** {{contact.business_legal_name}}'s {{opportunity.product}} renews in 30 days

```
{{contact.first_name}},

Renewal time. Your {{opportunity.product}} policy expires {{opportunity.policy_expiration}}.

Three things I'll do in the next two weeks:
  1. Shop your coverage against 2–3 markets (make sure your price is still right)
  2. Review your coverage against any changes in your business since last year
  3. Prepare your renewal paperwork

Anything change with {{contact.business_legal_name}} this past year — new services, revenue shift, more employees? Reply so I factor it in.

— Sabrina
```

---

## Email_Card_01_Nice_To_Meet (business card, within 1 hr)

**Subject:** Great meeting you at {{event}}, {{contact.first_name}}

```
{{contact.first_name}},

Enjoyed meeting you at {{event}}. Saving your card to my CRM like I said.

I work with businesses on cyber insurance, professional liability, and surety bonds. If any of that ever comes up for {{contact.business_legal_name}} or someone you know, I'd love to help.

No pitch today. Just glad to connect.

— Sabrina Franklin
Franklin Insurance Solutions
281-819-2505
```

---

## Email_Dormant_01_Its_Been_A_While

**Subject:** Quick check-in, {{contact.first_name}}

```
{{contact.first_name}},

It's been a while. Anything shift on your {{contact.primary_product_interest}} situation since we talked last?

If yes, reply with one line and I'll pick it back up.
If no, no worries — I'll keep your info on file for when the timing's right.

— Sabrina
```
