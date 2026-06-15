import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import type { WorkspaceProject } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const { data } = await supabase
    .from("cc_workspace_projects")
    .select("*")
    .eq("org_id", orgId)
    .eq("archived", false)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  const projects: WorkspaceProject[] = (data as WorkspaceProject[] | null) ?? [];

  return <WorkspaceShell initialProjects={projects} orgId={orgId} />;
}
