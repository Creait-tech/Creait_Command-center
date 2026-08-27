import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { TodosView } from "@/components/todos/todos-view";
import { asAuthoredRows, type AuthoredTodo, type Person } from "@/lib/authorship";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const [todosRes, membersRes] = await Promise.all([
    supabase
      .from("cc_todos")
      .select("*")
      .eq("org_id", orgId)
      .order("done", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("team_members")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "active")
      .order("full_name"),
  ]);

  // `select("*")` already returns the authorship and profile columns added by
  // `phase15_authorship_everywhere`; the generated types in lib/supabase/types.ts
  // just don't describe them yet, so the row shapes are widened here.
  const todos = asAuthoredRows<AuthoredTodo>(todosRes.data);
  const members = asAuthoredRows<Person>(membersRes.data);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">To-Dos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          EOS 7-day commitments. Captured during Level 10 meetings, owned by a person, due in 7 days unless changed.
        </p>
      </div>
      <TodosView initialTodos={todos} members={members} orgId={orgId} />
    </div>
  );
}
