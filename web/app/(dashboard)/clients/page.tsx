import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { ClientsView } from "@/components/clients/clients-view";
import type { CcClient } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const { data } = await supabase
    .from("cc_clients")
    .select("*")
    .eq("org_id", orgId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const clients: CcClient[] = (data as CcClient[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Clients</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Client roster, health tracking, and second-brain links.
        </p>
      </div>
      <ClientsView initialClients={clients} />
    </div>
  );
}
