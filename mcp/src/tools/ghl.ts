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

// ─── Tool: ghl_get_contacts ──────────────────────────────────────────────────

export const ghlGetContactsInput = {
  limit: z.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
};

export async function ghlGetContacts({
  limit = 25,
  search,
}: {
  limit?: number;
  search?: string;
}) {
  const cfg = readGhlConfig();
  if (!cfg.ok) return notConfigured(cfg.reason);

  const params = new URLSearchParams({
    locationId: cfg.locationId,
    limit: String(limit),
  });
  if (search) params.set("query", search);

  try {
    const body = (await ghlFetch(cfg.pit, `/contacts/?${params}`)) as {
      contacts?: Array<Record<string, unknown>>;
    };
    const contacts = (body.contacts ?? []).map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      tags: c.tags,
      dateAdded: c.dateAdded,
    }));
    return jsonResult(contacts);
  } catch (err) {
    return errorResult(err);
  }
}

// ─── Tool: ghl_get_opportunities ─────────────────────────────────────────────

export const ghlGetOpportunitiesInput = {
  pipelineId: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
};

export async function ghlGetOpportunities({
  pipelineId,
  limit = 50,
}: {
  pipelineId?: string;
  limit?: number;
}) {
  const cfg = readGhlConfig();
  if (!cfg.ok) return notConfigured(cfg.reason);

  try {
    let pipelineIds: string[];
    if (pipelineId) {
      pipelineIds = [pipelineId];
    } else {
      const pipes = (await ghlFetch(
        cfg.pit,
        `/opportunities/pipelines?locationId=${encodeURIComponent(cfg.locationId)}`,
      )) as { pipelines?: Array<{ id: string }> };
      pipelineIds = (pipes.pipelines ?? []).map((p) => p.id).filter(Boolean);
    }

    const collected: Array<Record<string, unknown>> = [];
    for (const pid of pipelineIds) {
      if (collected.length >= 100) break;
      const remaining = Math.min(limit, 100 - collected.length);
      const params = new URLSearchParams({
        location_id: cfg.locationId,
        pipeline_id: pid,
        limit: String(remaining),
      });
      const body = (await ghlFetch(cfg.pit, `/opportunities/search?${params}`)) as {
        opportunities?: Array<Record<string, unknown>>;
      };
      for (const o of body.opportunities ?? []) {
        if (collected.length >= 100) break;
        collected.push({
          id: o.id,
          name: o.name,
          contactId: o.contactId,
          status: o.status,
          monetaryValue: o.monetaryValue,
          pipelineStageId: o.pipelineStageId,
          updatedAt: o.updatedAt,
        });
      }
    }
    return jsonResult(collected);
  } catch (err) {
    return errorResult(err);
  }
}

// ─── Tool: ghl_get_conversations ─────────────────────────────────────────────

export const ghlGetConversationsInput = {
  limit: z.number().int().min(1).max(100).optional(),
};

export async function ghlGetConversations({ limit = 25 }: { limit?: number }) {
  const cfg = readGhlConfig();
  if (!cfg.ok) return notConfigured(cfg.reason);

  const params = new URLSearchParams({
    locationId: cfg.locationId,
    limit: String(limit),
  });
  try {
    const body = (await ghlFetch(cfg.pit, `/conversations/search?${params}`)) as {
      conversations?: Array<Record<string, unknown>>;
    };
    const conversations = (body.conversations ?? []).map((c) => ({
      id: c.id,
      contactName: c.fullName ?? c.contactName,
      lastMessageBody: c.lastMessageBody,
      lastMessageType: c.lastMessageType,
      unreadCount: c.unreadCount,
      lastMessageDate: c.lastMessageDate,
    }));
    return jsonResult(conversations);
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
