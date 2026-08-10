import "server-only";

/**
 * Minimal GoHighLevel (LeadConnector) contacts client.
 *
 * GHL owns every outbound SMS and email CREAiT sends. This app never sends
 * messages itself — it writes *tags*, and GHL workflows read those tags and
 * decide what to send. That keeps one cadence in one place and means a change
 * to the reminder copy never needs a deploy here.
 *
 * Two hard-won details:
 *
 *  1. GHL's WAF blocks default Node/undici user agents with a 403 that looks
 *     nothing like an auth failure. Every request must carry a real browser
 *     User-Agent. This is the single most common way this integration
 *     "mysteriously" stops working.
 *  2. `GET /contacts/?query=` is a fuzzy search, not a lookup. Searching for
 *     "sam@x.com" happily returns "samantha@x.com". Callers must compare the
 *     returned email themselves — `findContactByEmail` does.
 *
 * Every function returns a result object rather than throwing. A registration
 * must never be lost because a third party hiccuped, so callers can record the
 * failure and still succeed.
 */

const GHL_API = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

/** GHL's WAF rejects non-browser agents. Not optional. */
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export type GhlResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type GhlContact = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  tags: string[];
};

export function ghlConfigured(): boolean {
  return Boolean(process.env.GETCREAIT_PIT && process.env.GETCREAIT_LOCATION_ID);
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.GETCREAIT_PIT}`,
    Version: GHL_VERSION,
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": BROWSER_UA,
  };
}

async function request<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<GhlResult<T>> {
  if (!ghlConfigured()) {
    return { ok: false, error: "GHL not configured (GETCREAIT_PIT / GETCREAIT_LOCATION_ID)" };
  }

  const { timeoutMs = 10_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${GHL_API}${path}`, {
      ...rest,
      headers: { ...headers(), ...(rest.headers as Record<string, string> | undefined) },
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: `GHL ${res.status} ${path}: ${text.slice(0, 300)}` };
    }
    return { ok: true, data: (text ? JSON.parse(text) : {}) as T };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `GHL request failed (${path}): ${message}` };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeContact(raw: Record<string, unknown>): GhlContact {
  return {
    id: String(raw.id ?? ""),
    email: typeof raw.email === "string" ? raw.email : null,
    firstName: typeof raw.firstName === "string" ? raw.firstName : null,
    lastName: typeof raw.lastName === "string" ? raw.lastName : null,
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((t): t is string => typeof t === "string")
      : [],
  };
}

/**
 * Exact-email lookup. GHL's `query` param is fuzzy, so the match is verified
 * here rather than trusted — otherwise a near-miss address would inherit
 * someone else's contact record and their tags.
 */
export async function findContactByEmail(
  email: string,
): Promise<GhlResult<GhlContact | null>> {
  const locationId = process.env.GETCREAIT_LOCATION_ID ?? "";
  const params = new URLSearchParams({ locationId, query: email, limit: "20" });
  const res = await request<{ contacts?: Record<string, unknown>[] }>(
    `/contacts/?${params.toString()}`,
  );
  if (!res.ok) return res;

  const wanted = email.trim().toLowerCase();
  const match = (res.data.contacts ?? [])
    .map(normalizeContact)
    .find((c) => c.id && c.email?.trim().toLowerCase() === wanted);

  return { ok: true, data: match ?? null };
}

/** Add tags to an existing contact. Additive — GHL never removes on this call. */
export async function addContactTags(
  contactId: string,
  tags: string[],
): Promise<GhlResult<string[]>> {
  if (tags.length === 0) return { ok: true, data: [] };
  const res = await request<{ tags?: string[] }>(`/contacts/${contactId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) return res;
  return { ok: true, data: res.data.tags ?? tags };
}

/** Remove tags from a contact. Used by cleanup paths, never by the class flow. */
export async function removeContactTags(
  contactId: string,
  tags: string[],
): Promise<GhlResult<string[]>> {
  if (tags.length === 0) return { ok: true, data: [] };
  const res = await request<{ tags?: string[] }>(`/contacts/${contactId}/tags`, {
    method: "DELETE",
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) return res;
  return { ok: true, data: res.data.tags ?? [] };
}

export type UpsertContactInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName?: string | null;
  tags: string[];
};

/**
 * Find-or-create by email, then apply tags either way.
 *
 * Deliberately additive on the update path: an existing contact keeps every
 * tag it already carries. `tuesday-registered` is permanent list membership —
 * nothing in this app ever removes it — and a returning registrant must not
 * lose the rest of their CRM history to a re-signup.
 */
export async function upsertContactWithTags(
  input: UpsertContactInput,
): Promise<GhlResult<{ contactId: string; created: boolean }>> {
  const found = await findContactByEmail(input.email);
  if (!found.ok) return found;

  if (found.data) {
    const tagged = await addContactTags(found.data.id, input.tags);
    if (!tagged.ok) return tagged;
    return { ok: true, data: { contactId: found.data.id, created: false } };
  }

  const body: Record<string, unknown> = {
    locationId: process.env.GETCREAIT_LOCATION_ID,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    tags: input.tags,
  };
  if (input.companyName) body.companyName = input.companyName;

  const created = await request<{ contact?: { id?: string } }>("/contacts/", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!created.ok) return created;

  const id = created.data.contact?.id;
  if (!id) return { ok: false, error: "GHL create returned no contact id" };
  return { ok: true, data: { contactId: id, created: true } };
}

/**
 * Class tags — the contract with GHL's workflows.
 *
 * `TUESDAY_REGISTERED` is permanent list membership: applied once at
 * registration, never removed by this app. A weekly-looping GHL workflow sends
 * everyone carrying it the Monday 5 PM and Tuesday 9 AM reminders.
 *
 * `ATTENDED` and `MISSED` are per-week outcome tags that split the follow-up
 * into two tracks (replay + feedback ask vs. "we missed you"). The GHL
 * workflows remove their own tag when their sequence finishes, so the same
 * person can be an attendee one week and a no-show the next.
 */
export const CLASS_TAGS = {
  registered: "tuesday-registered",
  attended: "attended-tuesday",
  missed: "missed-tuesday",
} as const;
