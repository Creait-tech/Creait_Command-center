import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs } from "ai";
import { createServiceClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { loadMcpTools } from "@/lib/mcp-client";
import type { Rock, RockMilestone, RockStatusUpdate } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rockId } = await params;
  // Service role bypasses RLS, so the rock is scoped to the caller's org here;
  // milestones and status history hang off the rock and are only used when it matches.
  const orgId = await getActiveOrgId();
  const supabase = createServiceClient();

  const [rockRes, milestonesRes, statusesRes] = await Promise.all([
    supabase.from("cc_rocks").select("*").eq("id", rockId).eq("org_id", orgId).maybeSingle(),
    supabase.from("cc_rock_milestones").select("*").eq("rock_id", rockId).order("sort_order"),
    supabase.from("cc_rock_status_updates").select("*").eq("rock_id", rockId).order("created_at", { ascending: false }).limit(8),
  ]);

  const rock = rockRes.data as Rock | null;
  if (!rock) {
    return NextResponse.json({ error: "Rock not found" }, { status: 404 });
  }
  const milestones = (milestonesRes.data as RockMilestone[] | null) ?? [];
  const statusHistory = (statusesRes.data as RockStatusUpdate[] | null) ?? [];

  const daysUntilDue = Math.ceil((new Date(rock.due_date).getTime() - Date.now()) / 86_400_000);
  const milestonesComplete = milestones.filter((m) => m.done).length;

  const systemPrompt = `You are an EOS-trained operations coach working inside Maurice Grant's CREAIT Command Center.
Maurice runs a 4-person AI consulting agency. He follows the Ninety.com flavor of EOS.

Brand voice: direct, operator-mode, bullets beat paragraphs. Never use "All-in-One", CRM, API, webhooks, pipeline, funnel builder. Sound like a sharp ops lead.

The user just pressed "Unstick this Rock" on a 90-day priority that is yellow or red. Your job: produce 3 concrete moves to get it back on track THIS WEEK. Be specific to the data shown. No fluff. No restating the problem. Each move under 30 words.`;

  const userPrompt = `Rock title: ${rock.title}
${rock.description ? `Description: ${rock.description}\n` : ""}Quarter: ${rock.quarter}
Status: ${rock.status}
Days until due: ${daysUntilDue}
Milestones: ${milestonesComplete}/${milestones.length} complete
${milestones.length > 0 ? `Milestone list:\n${milestones.map((m) => `  ${m.done ? "✓" : "○"} ${m.title}${m.due_date ? ` (due ${m.due_date})` : ""}`).join("\n")}\n` : ""}
Recent weekly status (newest first):
${statusHistory.slice(0, 5).map((s) => `  ${s.created_at.slice(0, 10)}: ${s.status.toUpperCase()}${s.note ? ` — ${s.note}` : ""}`).join("\n") || "  (no weekly status updates yet)"}

${rock.smart_specific ? `SMART specific: ${rock.smart_specific}\n` : ""}${rock.smart_measurable ? `SMART measurable: ${rock.smart_measurable}\n` : ""}

Output ONLY this exact format, no preamble:

**1. <move>**
<one-sentence why>

**2. <move>**
<one-sentence why>

**3. <move>**
<one-sentence why>

**Owner action this week:** <one sentence aimed at the Rock owner>`;

  const tools = await loadMcpTools();

  try {
    const result = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      system: systemPrompt,
      prompt: userPrompt,
      tools,
      // Without a stop condition a tool call ends generation with empty text.
      stopWhen: stepCountIs(5),
      maxRetries: 1,
    });

    return NextResponse.json({ suggestions: result.text, rockId, model: "claude-sonnet-4-6" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI call failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
