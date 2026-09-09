# Calibration cases 02–21 (simulated engagements, 9 Sep 2026)

Twenty fictional owners, each a complete engagement: the full intake as typed (`intake`), the facilitator's session capture (`session`), the data room, all 30 scores with the evidence level and the note behind each (`scores`), the constraint, and 2–3 opportunities with calculator inputs. Case 01 is Summit Exterior (`../CREAIT-Summit-Exterior-Answer-Key.md`).

Every case was pushed through the real public intake form in a browser, scored through `web/lib` (prefill, cross-checks, `computeScores`, calculators, `assessmentReadiness`) with `web/scripts/sim-facilitate.ts`, and loaded into the Command Center as a practice engagement. The scores are the author's key, not Maurice's: treat them as **draft keys** until a founder has scored the case blind and the disagreements are logged.

Use for L2 certification (score blind from `intake` + `session`, compare to `scores`) and for regression: `cd web && npx tsx scripts/sim-facilitate.ts <dir-with-shells-and-personas>`.

| # | Company | Industry | Revenue | Composite | Gate | Designed to test |
|---|---|---|---|---|---|---|
| 01 | Reid Comfort Heating & Air | Residential HVAC | $1,800,000 | 38 Stabilizing | pass | Typical mid case — the calibration baseline everything else is compared to; P&L on file, so no ranges are wide |
| 02 | Brightside Family Dental | Dental practice (general & family) | $2,600,000 | 58 Building | pass | Strong-systems case — composite in the 55–62 band, Building; Heavily Documented evidence (P&L, revenue by pati |
| 03 | Northstar Growth Agency | Marketing agency (B2B demand generation) | $1,100,000 | 44 Building | pass | No P&L and an empty data room — every opportunity range widens ±25% and the report carries the unaudited-figur |
| 04 | Loomcraft Home Goods | E-commerce (DTC home textiles) | $3,400,000 | 38 Stabilizing | pass | cash_distress overlay active — inventory-heavy DTC with a credit line and a supplier buy due; L2 at 0 and L4 a |
| 05 | Okafor & Lee Law | Law firm (family & estate) | $2,200,000 | 41 Building | pass | Fifteen intake questions answered 'unknown' — tests that unknowns are preserved and never scored as zero; Ever |
| 06 | Delgado Hospitality Group | Restaurant group (3 units) | $5,800,000 | 53 Building | pass | Restaurants have no lead funnel — leads and conversion are left n/a so the funnel cross-check should return in |
| 07 | Fieldnote Software | Vertical SaaS (inspection software for environmental consultancies) | $900,000 | 66 Scaling | pass | Composite should land in Scaling (61–80) — the strongest business in the cohort; key_person overlay active: th |
| 08 | Whitaker Custom Builders | Residential construction (custom homes & major renovations) | $4,500,000 | 37 Stabilizing | pass | Designed to FAIL the funnel cross-check: 40 leads/mo × 30% × $9,000 implies about $1.3M against $4.5M of reven |
| 09 | Meridian Staffing Partners | Staffing agency (light industrial & administrative) | $7,500,000 | 50 Building | pass | Margin cross-check should FLAG: the owner says 'about 30%' in the session while the P&L on file says 18 — twel |
| 10 | IronPath Fitness | Fitness studios (2 locations) | $1,300,000 | 60 Building | pass | Membership model — S9 near the top of the scale on 88% recurring revenue; P7 at 3: retention genuinely measure |
| 11 | Luxe Aesthetics Med Spa | Med spa | $2,010,000 | 45 Building | pass | owner_burnout overlay driven by q57 'Running on empty' plus the four-week test; legal_exposure overlay on an u |
| 12 | Fontaine Freight Solutions | Regional trucking | $6,210,000 | 31 Stabilizing | pass | key_person overlay — one dispatcher is the routing system, the rate memory and the customer memory; data_risk  |
| 13 | Liu & Partners Accounting | Accounting firm | $1,610,000 | 51 Building | pass | seasonal business — funnel and capacity numbers must reconcile across a four-month peak; high S5 (4) and high  |
| 14 | GreenScape Pros | Commercial landscaping | $2,930,000 | 52 Building | pass | same trade family as the Summit Exterior calibration case, deliberately different situation — tests rubric con |
| 15 | Summit Peak IT | Managed IT services | $3,100,000 | 73 Scaling | pass | the healthy control case — composite in the low 70s, Scaling band; 23 of 30 indicators at Demonstrated or Docu |
| 16 | Brooks Realty Collective | Real estate brokerage | $8,500,000 | 54 Building | pass | exactly two legitimate N/As in one pillar (S4 and S7), each with a written model-based reason — under the thre |
| 17 | Kowalski Precision Machining | Job-shop manufacturing | $4,020,000 | 39 Stabilizing | blocked | DESIGNED TO FAIL THE GATE: four N/As in the Leverage pillar (L6, L7, L9, L10) with 'we don't do it' reasons, w |
| 18 | Carter Franchise Holdings | Quick-service franchisee (3 units) | $9,200,000 | 59 Building | pass | two legitimate N/As in the Profit pillar (P5, P6) — both franchisor-imposed, both with written reasons; under  |
| 19 | Marchetti Consulting | Solo consultant (edge: below range) | $280,000 | 32 Stabilizing | blocked | below the $1M qualification range — run deliberately, and the report has to be honest about what that means; D |
| 20 | Verdant Health Coaching | Pre-revenue wellness startup (edge: red) | $0 | 8 Reactive | blocked | THE INCOMPLETE CASE — the file is deliberately unfinished and must fail the gate loudly rather than quietly pr |
