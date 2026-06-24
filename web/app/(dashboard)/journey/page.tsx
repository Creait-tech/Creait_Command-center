import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { JourneyView } from "@/components/journey/journey-view";
import type {
  JourneyMilestone,
  JourneyDeliverable,
  CcClient,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function JourneyPage() {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const { data: milestonesData } = await supabase
    .from("journey_milestones")
    .select("*")
    .eq("org_id", orgId)
    .order("sort_order", { ascending: true });

  const milestones: JourneyMilestone[] =
    (milestonesData as JourneyMilestone[] | null) ?? [];

  const milestoneIds = milestones.map((m) => m.id);
  let deliverables: JourneyDeliverable[] = [];
  if (milestoneIds.length > 0) {
    const { data: deliverablesData } = await supabase
      .from("journey_deliverables")
      .select("*")
      .in("milestone_id", milestoneIds)
      .order("sort_order", { ascending: true });
    deliverables =
      (deliverablesData as JourneyDeliverable[] | null) ?? [];
  }

  const { data: clientsData } = await supabase
    .from("cc_clients")
    .select("*")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  const clients: CcClient[] = (clientsData as CcClient[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Customer Journey</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The standard CREAIT customer journey from intake to 90-day review.
          Switch to "By Client" to track per-client progress.
        </p>
      </div>

      <JourneyView
        milestones={milestones}
        deliverables={deliverables}
        clients={clients}
      />
    </div>
  );
}
