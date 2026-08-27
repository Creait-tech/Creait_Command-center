/**
 * CREAIT MCP server — Phase 2.
 *
 * Combines Second Brain (markdown over DATA_DIR) + GoHighLevel tools behind
 * a single Bearer-token-authenticated HTTP endpoint.
 *
 * Endpoints:
 *   GET  /health   - liveness, returns tool list, NO auth
 *   POST /mcp      - JSON-RPC over Streamable HTTP (stateless, per-request)
 *   GET  /sse      - SSE keepalive for clients that prefer it
 *
 * All routes other than /health require `Authorization: Bearer <MCP_TOKEN>`.
 */
import express from "express";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { requireBearer } from "./auth.js";
import {
  searchContext,
  searchContextInput,
  getFile,
  getFileInput,
  updateFile,
  updateFileInput,
  listTopics,
  listTopicsInput,
} from "./tools/second-brain.js";
import {
  ghlGetContacts,
  ghlGetContactsInput,
  ghlGetOpportunities,
  ghlGetOpportunitiesInput,
  ghlGetConversations,
  ghlGetConversationsInput,
  ghlSendMessage,
  ghlSendMessageInput,
  ghlUpdateOppStage,
  ghlUpdateOppStageInput,
} from "./tools/ghl.js";
import {
  ccDashboard, ccDashboardInput,
  ccListRocks, ccListRocksInput,
  ccCreateRock, ccCreateRockInput,
  ccSetRockStatus, ccSetRockStatusInput,
  ccListTodos, ccListTodosInput,
  ccCreateTodo, ccCreateTodoInput,
  ccCompleteTodo, ccCompleteTodoInput,
  ccListIssues, ccListIssuesInput,
  ccCreateIssue, ccCreateIssueInput,
  ccAddWin, ccAddWinInput,
  ccAddHeadline, ccAddHeadlineInput,
  ccListKpis, ccListKpisInput,
} from "./tools/command-center.js";
import {
  ccListClients, ccListClientsInput,
  ccGetClientProgress, ccGetClientProgressInput,
  ccProposeClientUpdate, ccProposeClientUpdateInput,
  ccAddClientNote, ccAddClientNoteInput,
} from "./tools/client-journey.js";
import {
  ccMemorySet, ccMemorySetInput,
  ccMemoryGet, ccMemoryGetInput,
  ccMemorySearch, ccMemorySearchInput,
  ccMemoryList, ccMemoryListInput,
  ccMemoryDelete, ccMemoryDeleteInput,
} from "./tools/memory.js";

const PORT = Number(process.env.PORT ?? 8080);
const TOKEN = process.env.MCP_TOKEN ?? "";
const VERSION = "1.0.0";
const SERVER_NAME = "creait-mcp";

const TOOL_NAMES = [
  // Second brain
  "search_context", "get_file", "update_file", "list_topics",
  // GHL
  "ghl_get_contacts", "ghl_get_opportunities", "ghl_get_conversations", "ghl_send_message", "ghl_update_opp_stage",
  // Command Center
  "cc_dashboard", "cc_list_rocks", "cc_create_rock", "cc_set_rock_status",
  "cc_list_todos", "cc_create_todo", "cc_complete_todo",
  "cc_list_issues", "cc_create_issue",
  "cc_add_win", "cc_add_headline", "cc_list_kpis",
  // Client delivery journey (Hermes proposes, humans confirm)
  "cc_list_clients", "cc_get_client_progress", "cc_propose_client_update", "cc_add_client_note",
  // Cross-org memory
  "cc_memory_set", "cc_memory_get", "cc_memory_search", "cc_memory_list", "cc_memory_delete",
];

/** Wrap a tool handler with stopwatch + log line. */
function instrument<TArgs extends Record<string, unknown>, TResult>(
  name: string,
  fn: (args: TArgs) => Promise<TResult>,
): (args: TArgs) => Promise<TResult> {
  return async (args) => {
    const t0 = Date.now();
    try {
      const result = await fn(args);
      console.log(`[tool=${name}] ok ${Date.now() - t0}ms`);
      return result;
    } catch (err) {
      console.log(
        `[tool=${name}] error ${Date.now() - t0}ms ${(err as Error).message ?? err}`,
      );
      throw err;
    }
  };
}

/** Build a fresh MCP server instance (stateless mode → new instance per request). */
function buildMcpServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: VERSION });

  // Second Brain
  server.tool(
    "search_context",
    "Keyword search across all markdown files in the CREAIT second brain. Returns up to 10 ranked results with excerpts.",
    searchContextInput,
    instrument("search_context", searchContext),
  );
  server.tool(
    "get_file",
    "Read one markdown file from the second brain by relative path.",
    getFileInput,
    instrument("get_file", getFile),
  );
  server.tool(
    "update_file",
    "Write or append to a markdown file in the second brain.",
    updateFileInput,
    instrument("update_file", updateFile as (args: { path: string; content: string; append?: boolean }) => Promise<unknown>) as never,
  );
  server.tool(
    "list_topics",
    "List every markdown file in the second brain, sorted alphabetically.",
    listTopicsInput,
    instrument("list_topics", listTopics),
  );

  // GHL
  server.tool(
    "ghl_get_contacts",
    "List GoHighLevel contacts for the CREAIT location. Optional `search` query, `limit` capped at 100.",
    ghlGetContactsInput,
    instrument("ghl_get_contacts", ghlGetContacts),
  );
  server.tool(
    "ghl_get_opportunities",
    "List GoHighLevel opportunities. Without `pipelineId`, merges across every pipeline (cap 100).",
    ghlGetOpportunitiesInput,
    instrument("ghl_get_opportunities", ghlGetOpportunities),
  );
  server.tool(
    "ghl_get_conversations",
    "List recent GoHighLevel conversations with last-message metadata.",
    ghlGetConversationsInput,
    instrument("ghl_get_conversations", ghlGetConversations),
  );
  server.tool(
    "ghl_send_message",
    "Send an SMS, Email, or WhatsApp message into an existing GoHighLevel conversation.",
    ghlSendMessageInput,
    instrument("ghl_send_message", ghlSendMessage),
  );
  server.tool(
    "ghl_update_opp_stage",
    "Move a GoHighLevel opportunity to a different pipeline stage.",
    ghlUpdateOppStageInput,
    instrument("ghl_update_opp_stage", ghlUpdateOppStage),
  );

  // Command Center — read + write the CREAIT operating system
  server.tool(
    "cc_dashboard",
    "One-call snapshot of the CREAIT business: priorities, off-track Rocks, overdue To-Dos, high-priority Issues, KPIs. Use this first when asked 'what's going on'.",
    ccDashboardInput,
    instrument("cc_dashboard", ccDashboard as never) as never,
  );
  server.tool(
    "cc_list_rocks",
    "List quarterly Rocks. Defaults to current quarter; pass quarter='2026-Q3' or include_all_quarters=true.",
    ccListRocksInput,
    instrument("cc_list_rocks", ccListRocks),
  );
  server.tool(
    "cc_create_rock",
    "Create a new 90-day Rock. Defaults to company-type for current quarter. Be SMART — pass smart_specific/smart_measurable/smart_relevant when possible.",
    ccCreateRockInput,
    instrument("cc_create_rock", ccCreateRock),
  );
  server.tool(
    "cc_set_rock_status",
    "Log a weekly Green/Yellow/Red status update on a Rock. Use Red when off-track, Yellow when at risk.",
    ccSetRockStatusInput,
    instrument("cc_set_rock_status", ccSetRockStatus),
  );
  server.tool(
    "cc_list_todos",
    "List To-Dos. filter='open' (default), 'overdue', 'done', 'all'.",
    ccListTodosInput,
    instrument("cc_list_todos", ccListTodos),
  );
  server.tool(
    "cc_create_todo",
    "Create a 7-day To-Do commitment. Optional owner_id (team_members.id UUID) and explicit due_date.",
    ccCreateTodoInput,
    instrument("cc_create_todo", ccCreateTodo),
  );
  server.tool(
    "cc_complete_todo",
    "Mark a To-Do done by id.",
    ccCompleteTodoInput,
    instrument("cc_complete_todo", ccCompleteTodo),
  );
  server.tool(
    "cc_list_issues",
    "List IDS issues. long_term=false (default) for current-week, true for parked long-term issues.",
    ccListIssuesInput,
    instrument("cc_list_issues", ccListIssues),
  );
  server.tool(
    "cc_create_issue",
    "Add an IDS issue (problem, decision, or risk). Priority 1-10, defaults to 5. long_term=true to park for Quarterly Planning.",
    ccCreateIssueInput,
    instrument("cc_create_issue", ccCreateIssue),
  );
  server.tool(
    "cc_add_win",
    "Log a Win to the Level 10 wins feed.",
    ccAddWinInput,
    instrument("cc_add_win", ccAddWin),
  );
  server.tool(
    "cc_add_headline",
    "Capture a one-sentence Headline (customer/employee/market/general). Surfaces in next L10.",
    ccAddHeadlineInput,
    instrument("cc_add_headline", ccAddHeadline),
  );
  server.tool(
    "cc_list_kpis",
    "Return the Scorecard KPIs with current value vs target.",
    ccListKpisInput,
    instrument("cc_list_kpis", ccListKpis),
  );

  // Client delivery journey — Hermes reads freely, but PROPOSES changes.
  server.tool(
    "cc_list_clients",
    "The CREAIT client roster with delivery progress: status, health, tier, MRR, deliverables done vs total, percent complete, the milestone each client is currently sitting in, and how many days since anything moved. Use this whenever asked who the clients are, how a build is going, which accounts are stalling or behind, or where the delivery team should look first. sort='stalled' surfaces the longest-untouched clients; sort='progress' the least complete.",
    ccListClientsInput,
    instrument("cc_list_clients", ccListClients),
  );
  server.tool(
    "cc_get_client_progress",
    "Full delivery detail for ONE client: every journey milestone with each of its deliverables marked done or not, who last touched each and when (human vs agent), what is next up, the recent activity timeline, and any proposals still awaiting a human decision. Accepts a human name like 'Rad Media' or a uuid; an ambiguous name comes back as a candidate list to disambiguate rather than a guess. Call this before proposing any change so you cite the exact deliverable title.",
    ccGetClientProgressInput,
    instrument("cc_get_client_progress", ccGetClientProgress),
  );
  server.tool(
    "cc_propose_client_update",
    "Propose a change to a client's delivery record — mark a deliverable done, reopen one, attach a note to one, or change the client's lifecycle status. THIS DOES NOT CHANGE ANYTHING. It files a pending proposal that a CREAIT teammate must accept or reject in the Command Center; until they do, the client's record is untouched. Use it whenever you infer from a meeting, message, or document that delivery has moved — never state the work as done, say a proposal is waiting for approval. `rationale` is required: explain what led you to believe it, and put the source in `evidence`.",
    ccProposeClientUpdateInput,
    instrument("cc_propose_client_update", ccProposeClientUpdate),
  );
  server.tool(
    "cc_add_client_note",
    "Append an observation to a client's activity timeline, attributed to Hermes as an agent. Use for context worth keeping — what came up on a call, a risk you noticed, a summary for the team. This is commentary only and writes immediately; it changes no delivery state. If a deliverable actually moved, use cc_propose_client_update instead so a human confirms it.",
    ccAddClientNoteInput,
    instrument("cc_add_client_note", ccAddClientNote),
  );

  // Cross-org memory — Maurice's brain across all his businesses
  server.tool(
    "cc_memory_set",
    "Remember something. scope='personal' for cross-org user memory (default), 'org' for org-specific, 'shared' for cross-org-but-user-scoped. Provide key for upsert behavior.",
    ccMemorySetInput,
    instrument("cc_memory_set", ccMemorySet as never) as never,
  );
  server.tool(
    "cc_memory_get",
    "Fetch a memory by id, or by (scope + namespace + key).",
    ccMemoryGetInput,
    instrument("cc_memory_get", ccMemoryGet as never) as never,
  );
  server.tool(
    "cc_memory_search",
    "Full-text search across memory content. Use this to recall relevant context before answering — e.g. 'did Maurice ever decide X' or 'what does he prefer for Y'.",
    ccMemorySearchInput,
    instrument("cc_memory_search", ccMemorySearch as never) as never,
  );
  server.tool(
    "cc_memory_list",
    "List recent memories in a scope/namespace, newest first. Defaults: 25 results.",
    ccMemoryListInput,
    instrument("cc_memory_list", ccMemoryList as never) as never,
  );
  server.tool(
    "cc_memory_delete",
    "Delete a memory by id, or by (scope + namespace + key).",
    ccMemoryDeleteInput,
    instrument("cc_memory_delete", ccMemoryDelete as never) as never,
  );

  return server;
}

const app = express();
app.use(express.json({ limit: "2mb" }));

// Health is intentionally unauthenticated so Traefik / uptime monitors can hit it.
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    version: VERSION,
    name: SERVER_NAME,
    tools: TOOL_NAMES,
  });
});

// All MCP routes require Bearer auth.
const auth = requireBearer(TOKEN);

// Stateless Streamable HTTP: spin up a fresh transport + server per request.
app.post("/mcp", auth, async (req: Request, res: Response) => {
  try {
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.log(`[mcp] error ${(err as Error).message ?? err}`);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// MCP spec also allows GET /mcp for server-initiated SSE messages. In
// stateless mode we have no persistent session, so we return Method Not Allowed.
app.get("/mcp", auth, (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "GET /mcp not supported in stateless mode" },
    id: null,
  });
});

// Lightweight SSE keepalive — some MCP clients open /sse just to check the
// server speaks SSE before falling back to plain POST. Hold the connection
// open with periodic comments; clients should still call POST /mcp for RPCs.
app.get("/sse", auth, (req: Request, res: Response) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  const sessionId = randomUUID();
  res.write(`event: ready\ndata: ${JSON.stringify({ sessionId })}\n\n`);
  const ka = setInterval(() => {
    res.write(`: keepalive ${Date.now()}\n\n`);
  }, 25000);
  req.on("close", () => clearInterval(ka));
});

app.listen(PORT, () => {
  console.log(
    `[startup] ${SERVER_NAME} v${VERSION} listening on :${PORT} ` +
      `(DATA_DIR=${process.env.DATA_DIR ?? "./data"}, ` +
      `GHL=${process.env.GETCREAIT_PIT ? "configured" : "NOT configured"})`,
  );
});
