# CREAiT Score — Scoring Engine & Rubrics v2
### Advisor-only. Source of truth for `web/lib/assessment-instrument.ts`. Approved 8 Sep 2026 (Maurice Grant). Supersedes v1 (30 Jul 2026).

## What changed in v2

- Anchors written for **every** level 0–4. v1 defined only 0, 2 and 4; levels 1 and 3 were names without definitions.
- **S8 Customer concentration** is now one axis (largest customer's share of revenue). v1 mixed largest-customer and top-five thresholds so some firms had no valid score.
- **L4** renamed *Manual work eliminated*; the "(reverse-scored)" label is gone because the anchors were already written high-good.
- Concentration overlay fires at one number: **largest customer > 25%**.
- An explicit **N/A rule** and an explicit **"don't know" rule**.
- The evidence-to-range rule is **enforced by the report generator**, not remembered by the advisor.
- A **release gate** (section 9) that the Command Center checks before an assessment can be marked delivered.

## 1. The model

- **30 scored indicators**, 10 per pillar. The advisor scores each 0–4 after the intensive; owner answers inform, the advisor calibrates.
- **Scale:** 0 **Absent** · 1 **Informal** (exists in someone's habits, not in the business) · 2 **Developing** · 3 **Established** (exists in the business but leans on the owner or isn't measured) · 4 **Scalable**.
- **N/A** is allowed only when the indicator cannot apply to the business model. It is removed from the denominator and never counted as zero. See section 5.
- **Evidence confidence** per indicator, tracked separately: **R** Reported (owner said so) · **D** Demonstrated (walked through it live) · **Doc** Documented (record, report or export seen). Confidence never changes the score. It widens financial ranges and is printed in Appendix A.
- **Pillar score** = mean of scored indicators ÷ 4 × 100, shown to one decimal in the report's "check the math" block.
- **CREAiT Score (0–100)** = Profit × 40% + Systems × 35% + Leverage × 25%. A pillar with fewer than **4** scored indicators is *insufficient data*: it is printed as such, excluded from the composite, and the remaining weights are renormalised. The report says so in one sentence.
- **Maturity bands:** 0–20 **Reactive** · 21–40 **Stabilizing** · 41–60 **Building** · 61–80 **Scaling** · 81–100 **Self-Running**. Bands apply to the rounded composite.
- **Critical Constraint Overlay** (section 6) sits alongside the score. A warning can never be averaged away.
- Every report names **one Primary Business Constraint** (+ up to 3 contributors).
- Fewer than **25** resolved indicators (scored or N/A) = not report-ready. The report prints "Draft".

## 2. PROFIT pillar (40%) — is the growth engine working?

| # | Indicator | 0 · Absent | 1 · Informal | 2 · Developing | 3 · Established | 4 · Scalable |
|---|---|---|---|---|---|---|
| P1 | Lead generation & tracking | No idea where leads come from or how many | Sources named from memory; no counts kept anywhere | Some sources known; volume roughly tracked | Sources and monthly volume logged in one place; cost or quality tracked for the main source only | Sources, volume, cost & quality tracked monthly |
| P2 | Lead response & capture | Inquiries sit or get lost; no single system | Inquiries land in one inbox or phone; answered same day when the owner is free; no log | Usually answered within a day; capture inconsistent | Every inquiry captured in one system; response within business hours the same half-day; partly automated | Every inquiry in one system, response < 1 hr, automated |
| P3 | Follow-up discipline | One touch, then nothing | A second touch happens when someone remembers; no record of who was followed up | Some follow-up, person-dependent | A defined sequence exists and is used on most leads; missed follow-ups are visible in the system | 2+ automated/systematic touches on every lead |
| P4 | Sales conversion process | No defined process; close rate unknown | The owner has a personal routine; no stages; close rate is a guess | Loose process; rate roughly known | Stages defined and used; close rate tracked; loss reasons captured informally | Defined stages, tracked close rate, loss reasons logged |
| P5 | Pricing discipline | Gut/competitor pricing, unchanged 2+ yrs | One price change in two years, reason anecdotal; discounts at owner discretion | Some economics behind prices; occasional reviews | Prices reviewed against costs annually; discount rules written; only the owner can defend them | Annual reviews, value-based, discount rules, team can defend |
| P6 | Offer architecture | One offer, take it or leave it | Add-ons exist but are offered only when the customer asks | Some add-ons offered ad hoc | Named tiers or bundles; an upsell scripted for the core offer; not yet routine across the team | Deliberate ladder: entry, core, premium, bundles, routine upsells |
| P7 | Retention & reactivation | Customers leave silently; nobody looks back | Repeat customers recognised by name; no rate, no inactive list | Repeat rate roughly known; no reactivation | Repeat or retention rate measured; inactive list pulled and worked at least twice a year | Retention measured & worked; inactive list reactivated on cadence |
| P8 | Growth ownership & measurement | Nobody owns marketing/sales; no numbers | Owner is de facto marketing and sales; numbers exist in scattered tools | Owners named; numbers reviewed sometimes | Named owners; leads, conversion and value reviewed monthly, but not acquisition cost | Accountable owners; leads/conversion/CAC/value reviewed together |
| P9 | Margin knowledge | Gross margin unknown | Gross margin estimated from the tax return once a year | Known overall, not by job/service | Margin by service line or job type known; used in pricing decisions occasionally | Tracked by job/service/customer; decisions use it |
| P10 | Financial visibility | Tax-time-only financials | Bookkeeper keeps the books; owner looks when cash feels tight | Monthly-ish, late, lightly used | Monthly close within 30 days; reviewed by the owner; targets informal | Monthly within 15 days, reviewed, targets exist |

## 3. SYSTEMS pillar (35%) — can it run and grow without the owner?

| # | Indicator | 0 · Absent | 1 · Informal | 2 · Developing | 3 · Established | 4 · Scalable |
|---|---|---|---|---|---|---|
| S1 | Owner decision load | Nearly everything needs the owner | Routine tasks delegated; every decision above routine returns to the owner | Several areas delegated; money/hiring/exceptions still owner-only | Decision rights written for most areas; owner still approves money and hiring | Clear decision rights; owner handles strategy only |
| S2 | Absence resilience (4-week test) | Business stops or bleeds within days | Runs about a week; owner answers calls daily from away | Runs short-term; slows, decisions stack up | Runs two to four weeks with a named deputy; a few owner-locked items remain (banking, top accounts) | Runs 4+ weeks; someone decides; nothing critical is owner-locked |
| S3 | Sales independence | Owner closes everything, relationships are the owner's | Someone else can quote; the owner closes and holds every relationship | Team sells with owner rescue on big deals | Team closes standard deals; owner steps in on the largest 10–20% | Team sells without owner; relationships institutional |
| S4 | Management depth & accountability | No managers, or managers in title only | One lead with a title who escalates rather than decides | Some real managers; accountability patchy | Managers own outcomes and metrics; misses get raised, but action needs the owner's push | Leaders own outcomes; misses trigger action without owner |
| S5 | Process documentation & adherence | In people's heads | A few checklists exist, not current; new hires learn by shadowing | Partially documented, loosely followed | Core workflows documented and current; used in training; adherence not audited | Documented, current, trained-from, actually followed |
| S6 | Rhythm & scoreboard | No regular meeting, no KPIs | Ad-hoc huddles; numbers discussed from memory | Meetings happen; few KPIs, loose follow-through | Weekly meeting with agenda and 3–7 KPIs; owners named; follow-through inconsistent | Weekly structured rhythm; owned KPIs; visible targets |
| S7 | Delivery consistency & capacity | Quality varies; +20% sales would break it | Quality depends on who is on the job; the owner inspects | Mostly consistent; growth needs heroics | Standards and QC steps defined; +20% would strain but not break; no written capacity plan | Consistent quality; capacity plan; +20% absorbable |
| S8 | Customer concentration (largest customer's share of revenue) | More than 30% | 20–30% | 15–20% | 10–15% | Less than 10%; broad base |
| S9 | Revenue predictability | All one-shot projects, restart every month | Some repeat customers; no contracts; the forecast is a hope | Some repeat/contract revenue | Recurring or contracted revenue covers fixed costs or ≥ 40% of revenue; a rolling forecast exists | Meaningful recurring/contracted base; forecastable |
| S10 | Contracts, continuity & key-person risk | Handshakes; key knowledge in one head; no plan | Templates used sometimes; key-person risk known and unaddressed | Some contracts written; known key-person gaps | Written contracts standard; cross-training started for key roles; continuity plan drafted, not tested | Written transferable contracts; cross-training; continuity plan |

S8 note: record the top-five share in the evidence note. It is context, not a threshold. Score from a revenue-by-customer report (Doc) whenever one exists; a Reported S8 is the single most common way a concentration risk gets missed.

## 4. LEVERAGE pillar (25%) — how much runs on systems and AI?

| # | Indicator | 0 · Absent | 1 · Informal | 2 · Developing | 3 · Established | 4 · Scalable |
|---|---|---|---|---|---|---|
| L1 | Core system coverage | Spreadsheets and memory | One real system (usually accounting); the rest is spreadsheets and texts | Key tools exist with big gaps | Systems for most core areas; one significant gap remains | Every core area has a real system |
| L2 | Integration | Same data typed into multiple places; a person is the glue | Manual export and import between systems on a schedule | Some integrations; some double entry | Main systems connected; one or two double-entry points remain | Core systems share data cleanly |
| L3 | Data trust & reporting | Numbers conflict; reports hand-built | One trusted report (the bank balance); everything else disputed | Mostly right after cleanup | Definitions agreed for the key KPIs; reports need light cleanup | Agreed definitions; reports on demand |
| L4 | Manual work eliminated | Heavy manual repetitive load everywhere | Load acknowledged; nothing fixed | Some load; a few fixes made | Major repetitive tasks reduced; a few hours a week remain per role | Little manual repetition; work flows |
| L5 | Automation in place | None | One or two automations set up by a vendor; nobody owns them | A few automations, reliability mixed | Automations in several functions; owned and monitored; occasional failures | Reliable automations across functions, maintained |
| L6 | AI adoption | None | One person experiments on their own | Individual/ad-hoc use | AI used in one or two defined workflows; results anecdotal | Deliberate use in defined workflows with results |
| L7 | AI & automation discipline | No rules, no review, no measurement | A verbal rule ("don't paste customer data"); no review | Some practices; inconsistent | Written use-case selection and data rules; human review defined; measurement partial | Impact-picked use cases, owners, human review, measured |
| L8 | Tech & data hygiene | Shared passwords, no backups, unknown access | Individual logins for most tools; backups assumed, never tested | Partial hygiene; known gaps | Access controlled and off-boarding done; backups tested once; data map partial | Access controlled, backups tested, data mapped |
| L9 | Team readiness | Resistant or untrained | Curious individuals; no training | Pockets of capability | Team trained on the core tools; adoption uneven across roles | Trained, adopting, improving |
| L10 | Change capacity | No budget/time/appetite | Appetite yes; no budget or time set aside | Limited but real | Budget and time named; execution still depends on the owner | Budget, time, and appetite committed |

## 5. N/A and "don't know"

- **N/A** is valid only when the indicator cannot apply to the business model (no employees for S4; no inventory-style cost base for a margin sub-question; no recurring model possible for S9 is *not* a reason, score it). Never because the owner doesn't know or won't say.
- **"Don't know"** scores the lowest anchor the available evidence supports and is flagged **R**. If nothing supports any level, score 0 and write "no evidence" in the note. Unknown is information about the business.
- More than **two** N/As in a pillar require a written reason in the note of each. **Four or more** make the pillar *insufficient data*: excluded from the composite, printed as such.
- Every scored indicator carries a **note** with the quote, number or document name that justifies the score. A score without a note does not pass the release gate.

## 6. Critical Constraint Overlay — check every engagement

Flag as an explicit warning (with trigger, evidence, business effect, resolution condition) regardless of scores:

- Largest customer **> 25%** of revenue
- Negative or perilously tight cash / debt distress
- Financial reporting too unreliable to base decisions on
- A key person or license whose loss stops the business
- Nontransferable or unwritten critical contracts
- Known legal / tax / insurance / compliance exposure → **refer to a professional**
- Owner burnout or health risk affecting continuity
- Sensitive data in uncontrolled tools / no backups

**Rule:** any active warning forces a "Prepare First" label on otherwise-attractive growth initiatives that depend on the weak foundation.

## 7. Primary Business Constraint — selection discipline

The constraint must: materially limit the owner's stated objective · show up in at least **two blocks** of session evidence · explain recurring symptoms · be actionable. Present as **Symptoms → Root Constraint → Annual Cost → Required Capability → First Intervention → Measurement.** If two roots are inseparable, present the cluster honestly. Always compare against the owner's own Q8 belief — "you said X; the evidence says Y" (or "the evidence agrees with you") is the pivotal Results Session moment, and the comparison is printed in the report, not only spoken.

## 8. Financial rules (the report generator enforces these)

- Every opportunity: **low / expected / high**, with a stated basis (the finding), fix cost, time-to-benefit, capacity check, confidence. Low ≤ expected ≤ high or the report refuses to print the range.
- Detailed cases for only the **2–3 strongest** profit opportunities; the rest go to the ranked backlog.
- **Overlap adjustment**: portfolio total = sum × overlap factor (default 0.7 unless justified in a note) — never sum raw maximums. Not applied to a single opportunity.
- Every dollar figure traces through a visible chain in Appendix B: units → rate → revenue → margin → operating profit. Revenue lift is never booked as profit.
- Automation savings = hours/wk × **loaded rate** (collected per role at intake) × 52 × automation share. Report **capacity recovered separately from cash profit**. An hour is never dollarized in payroll and also counted as owner hours.
- **Evidence-to-range rule:** an opportunity resting on Reported-only evidence, or any Profit opportunity when no P&L is on file, has its low bound × 0.75 and its high bound × 1.25 and carries the words "based on your estimates". The report applies this automatically.
- **P&L disclosure:** when no P&L is on file, the cover and the methodology block print: "Profit-pillar findings rest on unaudited figures provided by the owner."
- Never compound unrelated percentages into one headline number. Margin shift is stated in **points**, never as a profit-lift percentage. No valuation language; no benchmark without a named source.

## 9. Release gate

The Command Center refuses "delivered" until all blockers clear. A named reviewer signs; a snapshot of scores and opportunities is frozen at delivery and the rows lock until the assessment is reopened to *review*.

**Blockers:** 25+ indicators resolved · no scored pillar under 4 indicators · every scored indicator has evidence confidence other than unknown · at least 10 indicators Demonstrated or Documented · every scored indicator has a note · Primary Constraint text and annual cost present · every included opportunity has a finding and an ordered, positive range · overlay flags valid · reviewer named.

**Warnings (reviewer acknowledges):** no P&L on file · one opportunity above 50% of the raw expected total · a potential score set below the current score · overlap factor changed from 0.7 without a note.

## Changelog

| Version | Date | Change |
|---|---|---|
| v1 | 30 Jul 2026 | Initial 30-indicator model; anchors at 0 / 2 / 4 |
| v2 | 8 Sep 2026 | Anchors for 1 and 3; S8 single axis; L4 relabel; concentration overlay at 25%; N/A and don't-know rules; enforced evidence widening; P&L disclosure; release gate; thin pillar excluded from composite |
