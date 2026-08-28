-- =============================================================================
-- phase18 — a KPI with no reading is unknown, not zero
--
-- `kpis.value` was NOT NULL, so a metric nobody had measured had to be stored
-- as 0. On a scorecard 0 is a claim — "no calls were booked this week" — and
-- an absence of measurement is not that claim. "Calls Booked 7d" sat at 0 for
-- months with nothing feeding it, reading as a hard miss every single week.
--
-- `cc_kpi_weekly.value` has always been nullable for exactly this reason
-- (see phase16); this brings the headline reading into line with the weekly
-- grid, so both surfaces can render "-" for the same fact.
--
-- Relaxing a NOT NULL is safe for every existing row: nothing already stored
-- becomes invalid.
-- =============================================================================

ALTER TABLE public.kpis ALTER COLUMN value DROP NOT NULL;

COMMENT ON COLUMN public.kpis.value IS
  'Latest reading. NULL means not measured — never render as 0. Weekly history lives in cc_kpi_weekly.';
