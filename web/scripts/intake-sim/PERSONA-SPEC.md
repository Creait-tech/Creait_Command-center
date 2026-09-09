# Simulation persona spec (one JSON file per business: personas/sim01.json … sim20.json)

Source of truth for ids, types, options and column keys: `schema.json` in this folder
(`questions[]` with id/type/options/columns/allowUnknown/required/feedsIndicators;
`indicators[]` with anchor0..anchor4; `overlay[]` keys; `calculators[]` with fields; `engineMetrics[]`).
Style reference for scoring notes: /home/claude/creait_command-center/resources/CREAIT-Summit-Exterior-Answer-Key.md
Rubric: /home/claude/creait_command-center/resources/CREAIT-Scoring-Engine-and-Rubrics.md

```jsonc
{
  "n": 1, "company": "…", "owner": "…", "industry": "…",
  "profile": { "revenue": 1800000, "grossMarginPct": 42, "operatingProfit": 150000, "headcount": 14,
               "founded": 2015, "story": "3–5 sentences of who they are and what hurts" },
  "edge_cases": ["what this persona is designed to test"],
  "intake": {
    // EVERY question id in schema.json (q1..q59, e1..e6 only if module E applies).
    // type short/long/number/currency/percent/upload_note -> string (numbers as plain strings, e.g. "1800000", "42")
    // type single -> exactly one option string from `options`
    // type multi  -> array of option strings
    // type table  -> array of row objects keyed by the column `key`s in `columns` (2–5 rows)
    // If allowUnknown is true and the owner would not know, use the literal string "unknown" (never 0, never "").
    // required questions must be answered (or "unknown" if allowUnknown). Leave nothing else blank unless the persona is the incomplete-intake edge case.
    "q1": "…", "q2": "…"
  },
  "session": {
    "engine": { "leads_per_month": "85", "conversion_rate": "35%", "avg_deal_value": "$1,850", "response_time": "same day, sometimes next",
                "gross_margin_pct": "38", "headcount": "17", "repetitive_hours_week": "Quote assembly — Dana — 8\nInvoicing — Lena — 6", "largest_customer_pct": "22" },
    "blockNotes": { "b1": "…", "b2": "…", "b3": "…", "b4": "…", "b5": "…" },   // what the facilitator wrote during each block
    "demonstrated": ["what was shown live"], "documents_seen": ["what was in the data room"]
  },
  "dataRoom": { "pnl_on_file": true, "documents": [ { "name": "QuickBooks P&L 24 mo", "kind": "pnl", "received_on": "2026-09-02" } ] },
  // kinds: pnl | revenue_by_customer | ar_aging | rate_card | job_cost | other
  "scores": {
    // all 30 keys P1..P10, S1..S10, L1..L10
    "P1": { "score": 2, "na": false, "evidence": "reported", "note": "the quote/number/document the score rests on", "why_not_higher": "…" },
    "S4": { "score": null, "na": true, "evidence": "reported", "note": "N/A because … (only when the indicator cannot apply to the model)" }
  },
  "assessment": {
    "owner_objective": "…", "owner_belief": "Q8 verbatim",
    "primary_constraint": "one sentence root", "constraint_symptoms": "…", "constraint_cost": "three numbers, never merged: …",
    "constraint_fix": "…", "momentum_initiative": "…",
    "overlay_flags": ["key_person"],   // keys from schema.json overlay[]
    "plan_items": ["Initiative — owner name — start date", "…", "…"],
    "overlap_factor": 0.7
  },
  "opportunities": [
    { "title": "…", "finding": "…", "calculator": { "kind": "close_rate_lift", "inputs": { /* field keys from schema.json calculators[].fields, numbers not strings */ } },
      "fix_cost": 5500, "months_to_benefit": 2, "confidence": "medium", "include_in_report": true, "basis_reported_only": true,
      "blueprint": "…", "replaces": "…" },
    { "title": "…", "finding": "…", "hand_entered": { "annual_low": 20000, "annual_expected": 40000, "annual_high": 60000 }, "fix_cost": 2000, "months_to_benefit": 1, "confidence": "high", "include_in_report": true, "basis_reported_only": false }
  ],
  "expected": { "gate_should_pass": true, "expected_blockers": [], "expected_warnings": ["hand-entered range"], "band_guess": "Stabilizing",
                "cross_checks": { "margin_vs_pnl": "pass", "funnel_vs_revenue": "flag", "concentration": "pass", "hours_vs_headcount": "pass" } }
}
```

Rules: numbers must be internally consistent (revenue, margin, headcount, leads × close × value ≈ revenue unless the persona is designed to fail that cross-check). Scores must follow the v2 anchors literally and the note must cite the intake or session fact. Evidence: documented only when a document is in dataRoom; demonstrated only when listed in session.demonstrated. Personas are fictional; do not reuse Summit Exterior's numbers.
