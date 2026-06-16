# Professional Liability — Email + SMS Copy

---

## Email_ProLiab_01_Confirmation (transactional)

**Subject:** Your professional liability quote is on the way

```
{{contact.first_name}},

Thanks — I've received your details and sent you over to the carrier to generate your quote. A few things to know:

  · You'll see their portal, not mine, but I'm still your broker of record on the policy
  · If you buy the policy, Franklin Insurance Solutions is who you call for service, claims, and renewals
  · The quote is good for 30 days

If the carrier asks anything you're unsure about, just reply to this email or text me at 281-819-2505.

— Sabrina
Franklin Insurance Solutions
```

---

## SMS_ProLiab_01_Intro

```
Hey {{contact.first_name}}, Sabrina from Franklin Insurance. Sent you over to the carrier for your pro-liab quote. Text me if anything looks off on their site. — Sabrina @ Franklin Ins. Reply STOP to opt out.
```

---

## Email_ProLiab_02_Why_You_Need_It (Day 0 nurture)

**Subject:** The one lawsuit that usually ends a service business

```
{{contact.first_name}},

If you give advice, design something, consult, or provide a professional service, here's the scenario that keeps me up at night for my clients:

A customer says your work cost them money. Doesn't matter if they're right. Doesn't matter if you're insured for general liability — that covers slip-and-falls, not "your advice was wrong."

Professional liability (sometimes called Errors & Omissions) is what pays:
  · The lawyer defending you
  · The settlement or judgment if it goes that way
  · Court costs either way

Most service businesses pay $40–$80/month for a $1M limit. Most lawsuits cost $25K just to respond to.

Worth 15 minutes: {{user.booking_link}}

— Sabrina
```

---

## SMS_ProLiab_02_Check_In (Day 2)

```
{{contact.first_name}}, did the carrier's quote page give you a number? Let me know if it felt off — I can run it through 2 other markets. — Sabrina
```

---

## Email_ProLiab_03_Claim_Scenarios (Day 4)

**Subject:** Three real claims I've seen this year

```
{{contact.first_name}},

Some context on what professional liability actually covers — three real scenarios from this year (details changed):

1. Marketing consultant in Dallas. Client said the strategy didn't deliver, sued for $85K in fees + "lost opportunity cost." Policy paid the lawyer, case settled for $12K. Consultant's premium that year: $620.

2. Bookkeeper in Austin. Missed a tax deadline for a client, penalties + interest totaled $9,200. Policy covered, minus $1K deductible. Premium: $540/yr.

3. IT consultant. Deployed a software update that caused 6 hours of downtime for a client. Client claimed $22K in lost revenue. Policy paid.

Your exposure depends on what you do and who you do it for. Want me to look at yours specifically? {{user.booking_link}}

— Sabrina
```

---

## Email_ProLiab_04_Service_Specific (Day 7)

Dynamic variant based on `Service Type` field.

### If Service Type = Beauty/Salon:
**Subject:** Salon professional liability — what most policies miss

```
{{contact.first_name}},

Salon-specific heads up: most general liability policies DON'T cover:
  · Allergic reaction to a product
  · Chemical burn from a color service
  · Injury from a tool you used incorrectly

Those are "professional acts" — and you need professional liability for them.

The policy I usually pair with salon GL runs around $25–$45/month. Want me to pull one for {{contact.business_legal_name}}?

{{user.booking_link}}

— Sabrina
```

### If Service Type = Consulting:
**Subject:** Consultant liability — the "my advice cost them money" problem

```
{{contact.first_name}},

Every consultant I work with tells me the same thing: "My clients sign a contract that limits my liability."

Here's the uncomfortable truth — those clauses get tested in court constantly, and judges throw them out half the time. A professional liability policy doesn't replace your contract. It's what actually pays when the contract doesn't hold up.

$60–$90/month for most solo and small consulting shops. Worth a look: {{user.booking_link}}

— Sabrina
```

### If Service Type = Tech:
**Subject:** Tech E&O — what breaks the most claims

```
{{contact.first_name}},

For tech businesses, the claim pattern I see most often is the "one bug, real damage" scenario. Software you built, a client relies on it, something goes sideways, they lose revenue. Tech Errors & Omissions is built for that.

Solid coverage for a small tech shop runs $80–$150/month. Happy to run {{contact.business_legal_name}}'s numbers.

{{user.booking_link}}

— Sabrina
```

(Write variants for Medical, Legal, Accounting, Design, Other as needed.)

---

## SMS_ProLiab_03_Calendar_Nudge (Day 10)

```
{{contact.first_name}}, 15 min this week to go through pro-liab options for {{contact.business_legal_name}}? Painless, promise. {{user.booking_link}} — Sabrina
```

---

## Email_ProLiab_05_Cost_vs_Risk (Day 14)

**Subject:** What an average pro-liab claim actually costs

```
{{contact.first_name}},

Hard numbers from the 2024 professional services claims report:

  · Median defense cost (even if you win): $28,000
  · Median settlement (when it settles): $62,000
  · Average time to resolve: 14 months

Now compare: typical professional liability premium for a business your size runs $500–$1,800/year.

Insurance is boring math. But it's math that matters when your revenue is on the line.

Want to see specific numbers for {{contact.business_legal_name}}? {{user.booking_link}}

— Sabrina
```

---

## Email_ProLiab_06_Last_Call (Day 21)

**Subject:** My last note on pro-liab

```
{{contact.first_name}},

Wrapping up my outreach on this — I don't want to be a pest.

Two quick things before I stop:
  · Most client contracts today require proof of professional liability. If you ever need fast turnaround, call me.
  · Claims don't just cost money — they cost 12+ months of attention. Insurance covers both.

Here when you need me.

— Sabrina
Franklin Insurance Solutions
```
