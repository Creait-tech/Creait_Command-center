"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { Plus, MessageSquare, Pin, Archive, Folder, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ProjectChat } from "./project-chat";
import { ProjectSettingsDialog } from "./project-settings-dialog";
import type { WorkspaceProject } from "@/lib/supabase/types";

interface Props {
  initialProjects: WorkspaceProject[];
  orgId: string;
}

function WorkspaceShellInner({ initialProjects, orgId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("p");

  const [projects, setProjects] = useState<WorkspaceProject[]>(initialProjects);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectIdFromUrl) ?? projects[0] ?? null,
    [projects, projectIdFromUrl],
  );

  // Realtime
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`workspace-projects-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cc_workspace_projects", filter: `org_id=eq.${orgId}` },
        async () => {
          const { data } = await supabase
            .from("cc_workspace_projects")
            .select("*")
            .eq("org_id", orgId)
            .eq("archived", false)
            .order("pinned", { ascending: false })
            .order("updated_at", { ascending: false });
          if (data) setProjects(data as WorkspaceProject[]);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [orgId]);

  const selectProject = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("p", id);
      else params.delete("p");
      router.replace(`/workspace?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  async function createProject(name: string) {
    if (!name.trim()) return;
    setCreating(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("cc_workspace_projects")
      .insert({
        org_id: orgId,
        name: name.trim(),
        preferred_model: "claude-sonnet-4-6",
      })
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      setNewName("");
      selectProject((data as WorkspaceProject).id);
      toast.success("Project created");
    }
  }

  // Both writes select the row back: an UPDATE that RLS refuses matches zero
  // rows and still reports success, so an empty result is a failed save.
  async function togglePin(p: WorkspaceProject) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("cc_workspace_projects")
      .update({ pinned: !p.pinned })
      .eq("id", p.id)
      .eq("org_id", orgId)
      .select("id");
    if (error || !data || data.length === 0) {
      toast.error(error?.message ?? "Couldn't update that project — the change was rejected.");
    }
  }

  async function archive(p: WorkspaceProject) {
    if (!confirm(`Archive "${p.name}"? (won't delete messages)`)) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("cc_workspace_projects")
      .update({ archived: true })
      .eq("id", p.id)
      .eq("org_id", orgId)
      .select("id");
    if (error || !data || data.length === 0) {
      toast.error(error?.message ?? "Couldn't archive that project — the change was rejected.");
      return;
    }
    if (selectedProject?.id === p.id) selectProject(null);
    toast.success("Archived");
  }

  function handleProjectUpdated(updated: WorkspaceProject) {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  const filtered = filter.trim()
    ? projects.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
    : projects;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Projects sidebar */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-border bg-sidebar">
        <div className="h-12 shrink-0 border-b border-border px-3 flex items-center gap-2">
          <Sparkles className="size-4 text-[color:var(--color-brand-electric)]" />
          <span className="text-sm font-semibold">AI Workspace</span>
        </div>
        <div className="p-3 space-y-2 border-b border-border">
          <div className="flex gap-2">
            <Input
              placeholder="New project name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createProject(newName); } }}
              className="h-8 text-xs"
            />
            <Button
              size="icon"
              onClick={() => createProject(newName)}
              disabled={!newName.trim() || creating}
              aria-label="Create project"
              className="size-8 shrink-0"
            >
              <Plus className="size-4" />
            </Button>
          </div>
          {projects.length > 8 && (
            <Input
              placeholder="Search projects…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-7 text-xs"
            />
          )}
        </div>
        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="p-6 text-center space-y-1">
              <Folder className="size-8 mx-auto text-muted-foreground mb-2" />
              {projects.length === 0 ? (
                <>
                  <p className="text-xs font-medium">No projects yet</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Name one after a job you do every week — the thread and its
                    system prompt persist, so you stop re-explaining context.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No project matches &ldquo;{filter}&rdquo;.
                </p>
              )}
            </div>
          ) : (
            <ul>
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => selectProject(p.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-b border-border/40 transition-colors",
                      selectedProject?.id === p.id
                        ? "bg-[color:var(--color-brand-slate)] text-foreground"
                        : "text-muted-foreground hover:bg-[color:var(--color-brand-slate)]/40 hover:text-foreground",
                    )}
                  >
                    <span className="text-base shrink-0">{p.emoji ?? "💬"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      {p.description && (
                        <p className="text-[10px] truncate text-muted-foreground">{p.description}</p>
                      )}
                    </div>
                    {p.pinned && <Pin className="size-3 text-[color:var(--color-brand-electric)] shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="p-3 border-t border-border text-[10px] text-muted-foreground space-y-1">
          <p><strong>How this works:</strong></p>
          <p>Each project is one long-running thread plus its own system prompt. The AI reaches the Command Center, GHL and the second brain through the MCP server, so it can answer and also change things.</p>
        </div>
      </aside>

      {/* Main pane */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {selectedProject ? (
          <>
            <header className="h-12 shrink-0 flex items-center justify-between gap-3 border-b border-border px-4">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">{selectedProject.emoji ?? "💬"}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{selectedProject.name}</p>
                  {selectedProject.description && (
                    <p className="text-[10px] text-muted-foreground truncate">{selectedProject.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => togglePin(selectedProject)} aria-label="Pin">
                  <Pin className={cn("size-3.5", selectedProject.pinned && "text-[color:var(--color-brand-electric)] fill-current")} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>Settings</Button>
                <Button variant="ghost" size="icon" onClick={() => archive(selectedProject)} aria-label="Archive">
                  <Archive className="size-3.5" />
                </Button>
              </div>
            </header>

            <ProjectChat project={selectedProject} />

            <ProjectSettingsDialog
              project={selectedProject}
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              onUpdated={handleProjectUpdated}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <Sparkles className="size-12 text-[color:var(--color-brand-electric)] mb-3" />
            <h2 className="text-xl font-bold mb-2">No project open</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              A project is one standing thread with its own system prompt, so the
              context you set up on Monday is still there on Friday. The AI can
              read the Command Center, GHL and the second brain — and write back
              to them: add a Rock, log a To-Do, draft a reply.
            </p>
            <p className="text-xs text-muted-foreground max-w-md mt-3">
              Keep one project per recurring job. Ad-hoc questions belong in the
              floating chat, not here.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {[
                "Diagnostic Delivery",
                "Outbound — 2,500 List",
                "Weekly L10 Prep",
                "Client Builds",
              ].map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => createProject(suggestion)}
                  disabled={creating}
                >
                  + {suggestion}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-6">
              <MessageSquare className="size-3 inline mr-1" />
              Or use the floating chat (bottom-right) for quick one-off questions
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export function WorkspaceShell(props: Props) {
  return (
    <Suspense fallback={null}>
      <WorkspaceShellInner {...props} />
    </Suspense>
  );
}
