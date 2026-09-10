import Link from "next/link";
import { ClipboardList, CheckCircle2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { Card, CardContent } from "@/components/ui/card";
import { CreatePrepDialog } from "@/components/prep/create-prep-dialog";
import { MEETING_AGENDAS, isMeetingType } from "@/lib/meeting-agendas";
import { REVEAL_LABELS, type PrepSessionRow } from "@/lib/prep-types";
import { asAuthoredRows, type Person } from "@/lib/authorship";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PrepPage() {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const [sessionsRes, peopleRes, participantsRes] = await Promise.all([
    supabase.from("cc_prep_sessions").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(50),
    supabase.from("team_members").select("*").eq("org_id", orgId).eq("status", "active").order("full_name"),
    supabase.from("cc_prep_participants").select("session_id, member_id, submitted_at").eq("org_id", orgId),
  ]);

  const sessions = (sessionsRes.data as PrepSessionRow[] | null) ?? [];
  const people = asAuthoredRows<Person>(peopleRes.data);
  const participants = (participantsRes.data as Array<{ session_id: string; submitted_at: string | null }> | null) ?? [];

  const progress = new Map<string, { done: number; total: number }>();
  for (const p of participants) {
    const cur = progress.get(p.session_id) ?? { done: 0, total: 0 };
    cur.total += 1;
    if (p.submitted_at) cur.done += 1;
    progress.set(p.session_id, cur);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Meeting Prep</h1>
          <p className="text-sm text-muted-foreground mt-1">
            The homework before a quarterly, annual or Focus Day. Everyone answers alone, then the Command Center reads
            every answer and hands the room what it actually has to decide.
          </p>
        </div>
        <CreatePrepDialog people={people} />
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            <ClipboardList className="size-10 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium">No prep sessions yet</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Create one a week or two before the session. Nobody thinks well for six hours in a room; the good
              quarterlies are the ones where everyone already wrote their answers down.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <ul className="divide-y divide-border">
              {sessions.map((s) => {
                const p = progress.get(s.id) ?? { done: 0, total: 0 };
                const label = isMeetingType(s.meeting_type) ? MEETING_AGENDAS[s.meeting_type].label : s.meeting_type;
                const complete = p.total > 0 && p.done === p.total;
                return (
                  <li key={s.id} className="py-3">
                    <Link
                      href={`/prep/${s.id}`}
                      className="flex items-center gap-3 hover:bg-[color:var(--color-brand-slate)]/40 -mx-2 px-2 py-2 rounded-md transition-colors"
                    >
                      <div className="size-9 rounded-full bg-[color:var(--color-brand-slate)] flex items-center justify-center shrink-0">
                        <ClipboardList className="size-4 text-[color:var(--color-brand-electric)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.title}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                          <span>{label}</span>
                          <span>{REVEAL_LABELS[s.reveal]}</span>
                          {s.due_at && <span>due {new Date(s.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                        </div>
                      </div>
                      {s.status === "synthesized" && (
                        <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 font-medium bg-[color:var(--color-brand-success)]/15 text-[color:var(--color-brand-success)]">
                          Synthesized
                        </span>
                      )}
                      <span
                        className={cn(
                          "text-xs rounded-full px-2 py-0.5 font-medium flex items-center gap-1 shrink-0",
                          complete
                            ? "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)]"
                            : "bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-mist)]",
                        )}
                      >
                        {complete ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                        {p.done}/{p.total}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
