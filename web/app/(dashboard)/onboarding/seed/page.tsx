import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { SeedConfirm } from "@/components/onboarding/seed-confirm";

export const dynamic = "force-dynamic";

/**
 * Auto-runs after a user creates a new Organization via the OrganizationSwitcher.
 * Seeds default data scoped to the new org's slug — so the new workspace boots
 * with 4 priorities, 5 KPIs, and Maurice as the admin team member.
 *
 * Idempotent: re-running for an already-seeded org is a no-op.
 */
export default async function OnboardingSeedPage() {
  const { userId, orgId, orgSlug, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) {
    // No active org — Clerk should have redirected here only after creation.
    redirect("/command-center");
  }

  const user = await currentUser();
  const fullName =
    user?.fullName ??
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ??
    "Owner";
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const orgName =
    (sessionClaims as { org_name?: string } | null)?.org_name ?? orgSlug ?? orgId;

  const supabase = createServiceClient();

  // Idempotency check — bail if priorities already exist for this org
  const { count } = await supabase
    .from("company_priorities")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  if ((count ?? 0) > 0) {
    return (
      <SeedConfirm
        orgSlug={orgSlug ?? orgId}
        orgName={orgName}
        alreadySeeded
        seeded={null}
      />
    );
  }

  // Seed default priorities (placeholder — owner edits later)
  const priorityInserts = [
    { title: "Define this quarter's #1 priority", sort_order: 0 },
    { title: "Hit your revenue target", sort_order: 1 },
    { title: "Ship your most important product or offer", sort_order: 2 },
    { title: "Build your team or process", sort_order: 3 },
  ].map((p) => ({ ...p, org_id: orgId, status: "active" as const }));

  // Seed 5 default KPIs (zero values — owner connects real data later)
  const kpiInserts = [
    { name: "Revenue (MRR)", unit: "USD", source: "manual" },
    { name: "Active Deals", unit: "count", source: "manual" },
    { name: "Conversations 7d", unit: "count", source: "manual" },
    { name: "Calls Booked 7d", unit: "count", source: "manual" },
    { name: "New Contacts 7d", unit: "count", source: "manual" },
  ].map((k, i) => ({
    ...k,
    org_id: orgId,
    value: 0,
    target: null,
    sort_order: i,
  })) as Array<{
    name: string;
    unit: string;
    source: "manual";
    org_id: string;
    value: number;
    target: number | null;
    sort_order: number;
  }>;

  // Seed founder as the first team member (admin)
  const teamInsert = {
    org_id: orgId,
    clerk_user_id: userId,
    full_name: fullName,
    email,
    role: "admin" as const,
    status: "active" as const,
    title: "Founder",
  };

  const [pRes, kRes, tRes] = await Promise.all([
    supabase.from("company_priorities").insert(priorityInserts),
    supabase.from("kpis").insert(kpiInserts),
    supabase.from("team_members").insert(teamInsert),
  ]);

  const seeded = {
    priorities: pRes.error ? `error: ${pRes.error.message}` : `${priorityInserts.length} created`,
    kpis: kRes.error ? `error: ${kRes.error.message}` : `${kpiInserts.length} created`,
    team: tRes.error ? `error: ${tRes.error.message}` : "1 created",
  };

  return (
    <SeedConfirm
      orgSlug={orgSlug ?? orgId}
      orgName={orgName}
      alreadySeeded={false}
      seeded={seeded}
    />
  );
}
