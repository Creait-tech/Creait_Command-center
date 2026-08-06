/**
 * GoHighLevel tools — proxied through the master agency's PIT.
 *
 * Env vars are read at the start of EACH tool call (not at module load) so
 * the .env file on the VPS can be updated and the next call sees the new
 * value without restarting the container.
 *
 * On missing PIT, every GHL tool returns a clear GHL_NOT_CONFIGURED error
 * instead of throwing, so consumers (the chat widget, the skills engine)
 * can render a useful message.
 */
import { z } from "zod";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

type ConfigOk = { ok: true; pit: string; locationId: string };
type ConfigErr = { ok: false; reason: "NO_PIT" | "NO_LOCATION" };

function readGhlConfig(): ConfigOk | ConfigErr {
  const pit = process.env.GETCREAIT_PIT?.trim();
  const locationId = process.env.GETCREAIT_LOCATION_ID?.trim();
  if (!pit) return { ok: false, reason: "NO_PIT" };
  if (!locationId) return { ok: false, reason: "NO_LOCATION" };
  return { ok: true, pit, locationId };
}

function notConfigured(reason: ConfigErr["reason"]) {
  const msg =
    reason === "NO_PIT"
      ? "GETCREAIT_PIT not set on MCP server"
      : "GETCREAIT_LOCATION_ID not set on MCP server";
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: "GHL_NOT_CONFIGURED", message: msg }),
      },
    ],
  };
}

async function ghlFetch(
  pit: string,
  pathAndQuery: string,
  init: RequestInit = {},
): Promise<unknown> {
  const url = `${GHL_BASE}${pathAndQuery}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${pit}`,
    Version: GHL_VERSION,
    Accept: "application/json",
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    throw Object.assign(
      new Error(`GHL ${res.status} ${res.statusText} on ${pathAndQuery}`),
      { status: res.status, body },
    );
  }
  return body;
}

function errorResult(err: unknown) {
  const e = err as { status?: number; body?: unknown; message?: string };
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          { error: "GHL_REQUEST_FAILED", status: e.status ?? null, message: e.message, body: e.body ?? null },
        ),
      },
    ],
  };
}

function jsonResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

/**
 * GHL returns at most 100 rows per request. These tools used to stop there,
 * so a location with 8,012 contacts reported "100" — a floor presented as a
 * total, which put wrong numbers on the Command Center scoreboard.
 *
 * GHL's list endpoints expose `meta.total` (an exact count, free of charge)
 * plus a `startAfter`/`startAfterId` cursor pair. We read the total from the
 * first page and follow the cursor for the rows themselves.
 *
 * Guards: a page that returns nothing, a cursor that fails to advance, and
 * hard page/row ceilings all end the walk, so a malformed cursor can never
 * spin forever against a paid API.
 */
const GHL_PAGE_SIZE = 100;
const GHL_MAX_PAGES = 60;

type GhlPage = {
  rows: Array<Record<string, unknown>>;
  total: number | null;
  startAfter?: string | number;
  startAfterId?: string;
};

async function paginateGhl(
  pit: string,
  buildQuery: (cursor: { startAfter?: string | number; startAfterId?: string }) => string,
  readPage: (body: unknown) => GhlPage,
  maxItems: number,
): Promise<{ items: Array<Record<string, unknown>>; total: number | null; truncated: boolean }> {
  const items: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  let cursor: { startAfter?: string | number; startAfterId?: string } = {};
  let total: number | null = null;
  let truncated = false;

  for (let page = 0; page < GHL_MAX_PAGES; page++) {
    const body = await ghlFetch(pit, buildQuery(cursor));
    const parsed = readPage(body);
    if (page === 0) total = parsed.total;
    if (parsed.rows.length === 0) break;

    for (const row of parsed.rows) {
      const id = typeof row.id === "string" ? row.id : null;
      if (id) {
        if (seen.has(id)) continue; // cursor overlap — never double-count
        seen.add(id);
      }
      items.push(row);
      if (items.length >= maxItems) break;
    }
    if (items.length >= maxItems) {
      truncated = total === null ? true : items.length < total;
      break;
    }

    // No cursor, or a cursor that didn't move, means there is no next page.
    const advanced =
      (parsed.startAfter !== undefined && parsed.startAfter !== cursor.startAfter) ||
      (parsed.startAfterId !== undefined && parsed.startAfterId !== cursor.startAfterId);
    if (!advanced) break;
    cursor = { startAfter: parsed.startAfter, startAfterId: parsed.startAfterId };

    if (page === GHL_MAX_PAGES - 1) truncated = true;
  }

  return { items, total, truncated };
}

type GhlMeta = {
  total?: number;
  startAfter?: string | number;
  startAfterId?: string;
};

function readMeta(body: unknown): GhlMeta {
  const meta = (body as { meta?: GhlMeta } | null)?.meta;
  return meta ?? {};
}

// ─── Tool: ghl_get_contacts ──────────────────────────────────────────────────

export const ghlGetContactsInput = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(5000)
    .optional()
    .describe("Max contacts to return. Pagination is automatic; `total` is exact regardless."),
  search: z.string().optional(),
};

export async function ghlGetContacts({
  limit = 100,
  search,
}: {
  limit?: number;
  search?: string;
}) {
  const cfg = readGhlConfig();
  if (!cfg.ok) return notConfigured(cfg.reason);

  try {
    const { items, total, truncated } = await paginateGhl(
      cfg.pit,
      (cursor) => {
        const params = new URLSearchParams({
          locationId: cfg.locationId,
          limit: String(GHL_PAGE_SIZE),
        });
        if (search) params.set("query", search);
        if (cursor.startAfter !== undefined)
          params.set("startAfter", String(cursor.startAfter));
        if (cursor.startAfterId) params.set("startAfterId", cursor.startAfterId);
        return `/contacts/?${params}`;
      },
      (body) => {
        const meta = readMeta(body);
        return {
          rows: (body as { contacts?: Array<Record<string, unknown>> })?.contacts ?? [],
          total: meta.total ?? null,
          startAfter: meta.startAfter,
          startAfterId: meta.startAfterId,
        };
      },
      limit,
    );

    const contacts = items.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      tags: c.tags,
      dateAdded: c.dateAdded,
    }));
    return jsonResult({ total, count: contacts.length, truncated, items: contacts });
  } catch (err) {
    return errorResult(err);
  }
}

// ─── Tool: ghl_get_opportunities ─────────────────────────────────────────────

export const ghlGetOpportunitiesInput = {
  pipelineId: z.string().optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(5000)
    .optional()
    .describe("Max opportunities to return. Pagination is automatic; `total` is exact regardless."),
};

export async function ghlGetOpportunities({
  pipelineId,
  limit = 500,
}: {
  pipelineId?: string;
  limit?: number;
}) {
  const cfg = readGhlConfig();
  if (!cfg.ok) return notConfigured(cfg.reason);

  try {
    // Searching without a pipeline filter returns every pipeline's
    // opportunities in one cursor-paged stream, and `meta.total` is then the
    // location-wide total. Only narrow to one pipeline when asked.
    const { items, total, truncated } = await paginateGhl(
      cfg.pit,
      (cursor) => {
        const params = new URLSearchParams({
          location_id: cfg.locationId,
          limit: String(GHL_PAGE_SIZE),
        });
        if (pipelineId) params.set("pipeline_id", pipelineId);
        if (cursor.startAfter !== undefined)
          params.set("startAfter", String(cursor.startAfter));
        if (cursor.startAfterId) params.set("startAfterId", cursor.startAfterId);
        return `/opportunities/search?${params}`;
      },
      (body) => {
        const meta = readMeta(body);
        return {
          rows:
            (body as { opportunities?: Array<Record<string, unknown>> })?.opportunities ?? [],
          total: meta.total ?? null,
          startAfter: meta.startAfter,
          startAfterId: meta.startAfterId,
        };
      },
      limit,
    );

    const opportunities = items.map((o) => ({
      id: o.id,
      name: o.name,
      contactId: o.contactId,
      status: o.status,
      monetaryValue: o.monetaryValue,
      pipelineId: o.pipelineId,
      pipelineStageId: o.pipelineStageId,
      updatedAt: o.updatedAt,
    }));

    // Open-only rollups, computed here so every consumer agrees on the
    // definition of "open" rather than each re-deriving it.
    let openCount = 0;
    let openValue = 0;
    for (const o of opportunities) {
      const status = String(o.status ?? "").toLowerCase();
      if (status === "won" || status === "lost" || status === "abandoned") continue;
      openCount++;
      const v = Number(o.monetaryValue ?? 0);
      if (Number.isFinite(v)) openValue += v;
    }

    return jsonResult({
      total,
      count: opportunities.length,
      truncated,
      openCount,
      openValue: Number(openValue.toFixed(2)),
      items: opportunities,
    });
  } catch (err) {
    return errorResult(err);
  }
}

// ─── Tool: ghl_get_conversations ─────────────────────────────────────────────

export const ghlGetConversationsInput = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(2000)
    .optional()
    .describe("Max conversations to return, newest first. `total` is exact regardless."),
};

export async function ghlGetConversations({ limit = 100 }: { limit?: number }) {
  const cfg = readGhlConfig();
  if (!cfg.ok) return notConfigured(cfg.reason);

  // `/conversations/search` reports the exact count as a top-level `total`
  // (not under `meta`) and pages by `startAfterDate` rather than the
  // startAfter/startAfterId cursor the other endpoints use.
  const collected: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  let total: number | null = null;
  let truncated = false;
  let startAfterDate: number | undefined;

  try {
    for (let page = 0; page < GHL_MAX_PAGES; page++) {
      const params = new URLSearchParams({
        locationId: cfg.locationId,
        limit: String(GHL_PAGE_SIZE),
        sortBy: "last_message_date",
        sort: "desc",
      });
      if (startAfterDate !== undefined)
        params.set("startAfterDate", String(startAfterDate));

      const body = (await ghlFetch(cfg.pit, `/conversations/search?${params}`)) as {
        conversations?: Array<Record<string, unknown>>;
        total?: number;
      };
      if (page === 0) total = typeof body.total === "number" ? body.total : null;

      const rows = body.conversations ?? [];
      if (rows.length === 0) break;

      let newestCursor: number | undefined;
      let added = 0;
      for (const c of rows) {
        const id = typeof c.id === "string" ? c.id : null;
        if (id) {
          if (seen.has(id)) continue;
          seen.add(id);
        }
        collected.push(c);
        added++;
        const d = Number(c.lastMessageDate);
        if (Number.isFinite(d)) newestCursor = d;
        if (collected.length >= limit) break;
      }

      if (collected.length >= limit) {
        truncated = total !== null && collected.length < total;
        break;
      }
      // Nothing new, or no usable cursor — we've reached the end.
      if (added === 0 || newestCursor === undefined || newestCursor === startAfterDate)
        break;
      startAfterDate = newestCursor;
      if (page === GHL_MAX_PAGES - 1) truncated = true;
    }

    const conversations = collected.map((c) => ({
      id: c.id,
      contactId: c.contactId,
      contactName: c.fullName ?? c.contactName,
      email: c.email,
      phone: c.phone,
      lastMessageBody: c.lastMessageBody,
      lastMessageType: c.lastMessageType,
      lastMessageDirection: c.lastMessageDirection,
      unreadCount: c.unreadCount,
      lastMessageDate: c.lastMessageDate,
    }));
    return jsonResult({
      total,
      count: conversations.length,
      truncated,
      items: conversations,
    });
  } catch (err) {
    return errorResult(err);
  }
}

// ─── Tool: ghl_send_message ──────────────────────────────────────────────────

export const ghlSendMessageInput = {
  conversationId: z.string().min(1),
  type: z.enum(["SMS", "Email", "WhatsApp"]),
  message: z.string().min(1),
};

export async function ghlSendMessage({
  conversationId,
  type,
  message,
}: {
  conversationId: string;
  type: "SMS" | "Email" | "WhatsApp";
  message: string;
}) {
  const cfg = readGhlConfig();
  if (!cfg.ok) return notConfigured(cfg.reason);

  try {
    const body = (await ghlFetch(cfg.pit, `/conversations/messages`, {
      method: "POST",
      body: JSON.stringify({ type, conversationId, message }),
    })) as { messageId?: string; status?: string };
    return jsonResult({ messageId: body.messageId, status: body.status });
  } catch (err) {
    return errorResult(err);
  }
}

// ─── Tool: ghl_update_opp_stage ──────────────────────────────────────────────

export const ghlUpdateOppStageInput = {
  opportunityId: z.string().min(1),
  pipelineStageId: z.string().min(1),
};

export async function ghlUpdateOppStage({
  opportunityId,
  pipelineStageId,
}: {
  opportunityId: string;
  pipelineStageId: string;
}) {
  const cfg = readGhlConfig();
  if (!cfg.ok) return notConfigured(cfg.reason);

  try {
    const body = (await ghlFetch(
      cfg.pit,
      `/opportunities/${encodeURIComponent(opportunityId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ pipelineStageId, locationId: cfg.locationId }),
      },
    )) as { opportunity?: Record<string, unknown> } | Record<string, unknown>;
    const opp =
      "opportunity" in (body as Record<string, unknown>)
        ? ((body as { opportunity: Record<string, unknown> }).opportunity)
        : (body as Record<string, unknown>);
    return jsonResult({
      id: opp.id ?? opportunityId,
      pipelineStageId: opp.pipelineStageId ?? pipelineStageId,
      status: opp.status,
    });
  } catch (err) {
    return errorResult(err);
  }
}
