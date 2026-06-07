import { createClient } from "@/lib/supabase/server";
import { TodosView } from "@/components/todos/todos-view";
import type { Todo, TeamMember } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
  const supabase = await createClient();

  const [todosRes, membersRes] = await Promise.all([
    supabase
      .from("cc_todos")
      .select("*")
      .eq("org_id", "creait")
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("team_members")
      .select("*")
      .eq("org_id", "creait")
      .eq("status", "active")
      .order("full_name"),
  ]);

  const todos = (todosRes.data as Todo[] | null) ?? [];
  const members = (membersRes.data as TeamMember[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">To-Dos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          EOS 7-day commitments. Captured during Level 10 meetings, owned by a person, due in 7 days unless changed.
        </p>
      </div>
      <TodosView initialTodos={todos} members={members} />
    </div>
  );
}
