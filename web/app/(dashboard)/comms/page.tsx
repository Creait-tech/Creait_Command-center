import { createClient } from "@/lib/supabase/server";
import { CommsLayout } from "@/components/comms/comms-layout";
import type { Message } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function CommsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("org_id", "creait")
    .order("priority_score", { ascending: false })
    .order("received_at", { ascending: false })
    .limit(200);
  const messages: Message[] = (data as Message[] | null) ?? [];
  return <CommsLayout initialMessages={messages} />;
}
