import { Card, CardContent } from "@/components/ui/card";
import { formatClassDateShort, type WeekStats } from "@/lib/tuesday-class";

/**
 * Eight weeks of show rate.
 *
 * The denominator is everyone registered as of that class, not everyone who
 * got marked — so `unmarked` is printed next to the rate rather than hidden
 * inside it. A week showing 100% off two marks and forty unmarked would be a
 * lie the scoreboard tells every Tuesday, and this is a company whose whole
 * pitch is showing the arithmetic.
 */

function pct(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

export function ClassScoreboard({
  stats,
  totalRegistered,
}: {
  stats: WeekStats[];
  totalRegistered: number;
}) {
  const measured = stats.filter((s) => s.attended + s.noShow > 0);
  const averageRate =
    measured.length > 0
      ? measured.reduce((sum, s) => sum + (s.showRate ?? 0), 0) / measured.length
      : null;
  const peak = Math.max(1, ...stats.map((s) => s.registered));

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Last 8 weeks</h2>
          <p className="text-sm text-muted-foreground">
            {measured.length === 0
              ? "No attendance marked yet — the rate starts the first week someone checks the list off."
              : `Average show rate across ${measured.length} marked week${
                  measured.length === 1 ? "" : "s"
                }: ${pct(averageRate)}`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="On the list" value={String(totalRegistered)} />
          <Tile label="This week here" value={String(stats[0]?.attended ?? 0)} />
          <Tile label="This week no-show" value={String(stats[0]?.noShow ?? 0)} />
          <Tile label="This week rate" value={pct(stats[0]?.showRate ?? null)} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Week
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Registered
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Here
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  No-show
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Unmarked
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Show rate
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => (
                <tr key={s.sessionDate} className="border-b border-border/60">
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    {formatClassDateShort(s.sessionDate)}
                    {i === 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        this week
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">
                    {s.registered}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-brand-success">
                    {s.attended}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-brand-warning">
                    {s.noShow}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {s.unmarked}
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span
                        aria-hidden="true"
                        className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block"
                      >
                        <span
                          className="block h-full rounded-full bg-brand-electric"
                          style={{
                            width: `${Math.round(((s.attended || 0) / peak) * 100)}%`,
                          }}
                        />
                      </span>
                      <span className="w-10 tabular-nums font-medium">
                        {pct(s.showRate)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">
          Registered counts everyone on the list when that class ran, so the rate
          never flatters a half-finished check-off. A week with a large Unmarked
          column has an unfinished list, not a bad turnout.
        </p>
      </CardContent>
    </Card>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-data text-2xl font-semibold">{value}</p>
    </div>
  );
}
