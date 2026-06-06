import { createClient } from "@/lib/supabase/server";
import { RecruitingBoard } from "@/components/recruiting/recruiting-board";
import type { Candidate } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function RecruitingPage() {
  const supabase = await createClient();

  const { data: candidatesData } = await supabase
    .from("candidates")
    .select("*")
    .eq("org_id", "creait")
    .order("stage", { ascending: true })
    .order("sort_order", { ascending: true });

  const candidates: Candidate[] =
    (candidatesData as Candidate[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Recruiting</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pipeline of every candidate. Drag cards between stages, click any
          card to open the full profile.
        </p>
      </div>

      <RecruitingBoard initialCandidates={candidates} />
    </div>
  );
}
