import { createClient } from "@/lib/supabase/server";
import { VisionDocument } from "@/components/vision/vision-document";
import type { Strategy } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function VisionPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("strategy")
    .select("*")
    .eq("org_id", "creait")
    .maybeSingle();

  const strategy: Strategy | null = (data as Strategy | null) ?? null;

  return (
    <div className="min-h-screen bg-background">
      <VisionDocument strategy={strategy} />
    </div>
  );
}
