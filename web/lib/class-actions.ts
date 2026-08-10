"use server";

/**
 * Server actions for AI Tuesday.
 *
 * Two trust models live in this file and the boundary matters:
 *
 *  - `registerForClass` is reachable by anyone on the internet. It validates
 *    with zod, carries a honeypot, and writes through the service-role client
 *    because an anonymous visitor has no Clerk claim for RLS to check.
 *  - Every other action is founders-only and starts with `requireOrg()`.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CREAIT_ORG_ID, getActiveOrgId } from "@/lib/active-org";
import {
  CLASS_TAGS,
  addContactTags,
  findContactByEmail,
  upsertContactWithTags,
} from "@/lib/ghl";
import { currentClassDate } from "@/lib/tuesday-class";
import type { CcClassRegistration, CcClassSession } from "@/lib/supabase/types";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// ---------------------------------------------------------------------------
// Public registration
// ---------------------------------------------------------------------------

const trimmed = (max: number) => z.string().trim().max(max);

const registrationSchema = z.object({
  firstName: trimmed(80).min(1, "First name is required"),
  lastName: trimmed(80).min(1, "Last name is required"),
  email: trimmed(200).pipe(z.email("That email doesn't look right")),
  // Deliberately permissive: owners type "(404) 555-0100" and "404.555.0100"
  // and both are the same person. Digit count is the only real check.
  phone: trimmed(40).min(7, "Phone number is required"),
  businessName: trimmed(140).optional(),
  industry: trimmed(140).optional(),
  annoyance: trimmed(2000).min(3, "Tell us one thing — a few words is plenty"),
  /** Honeypot. Real people never see it, so anything here is a bot. */
  website: z.string().max(200).optional(),
});

export type RegistrationInput = z.input<typeof registrationSchema>;

export type RegistrationSuccess = {
  firstName: string;
  email: string;
  /** False when the CRM write failed. The registration is still saved. */
  syncedToCrm: boolean;
};

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * GHL wants E.164. US numbers arrive as ten digits nine times out of ten, so
 * add the country code; anything already international is passed through
 * untouched rather than mangled by a guess.
 */
function normalizePhone(raw: string): string {
  const d = digits(raw);
  if (raw.trim().startsWith("+")) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return `+${d}`;
}

/**
 * Register someone for the weekly class.
 *
 * Order of operations is the whole design: the Supabase row is written FIRST
 * and its success is what the visitor is told about. GHL is attempted after,
 * and a failure there leaves `ghl_contact_id` null for reconciliation instead
 * of losing a registration to somebody else's outage.
 */
export async function registerForClass(
  input: RegistrationInput,
): Promise<ActionResult<RegistrationSuccess>> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      error: "A couple of fields need another look.",
      fieldErrors,
    };
  }
  const value = parsed.data;

  // Honeypot: silently succeed so the bot learns nothing, and write nothing.
  if (value.website && value.website.trim().length > 0) {
    return {
      ok: true,
      data: { firstName: value.firstName, email: value.email, syncedToCrm: true },
    };
  }

  if (digits(value.phone).length < 10) {
    return {
      ok: false,
      error: "A couple of fields need another look.",
      fieldErrors: { phone: "That number is missing some digits." },
    };
  }

  const email = value.email.toLowerCase();
  const phone = normalizePhone(value.phone);
  const supabase = createServiceClient();

  // Dedupe on email: a second registration updates the person in place rather
  // than seeding a duplicate that GHL would text twice.
  const { data: existingRow } = await supabase
    .from("cc_class_registrations")
    .select("id, ghl_contact_id")
    .eq("org_id", CREAIT_ORG_ID)
    .ilike("email", email)
    .maybeSingle();
  const existing = existingRow as Pick<
    CcClassRegistration,
    "id" | "ghl_contact_id"
  > | null;

  const row = {
    org_id: CREAIT_ORG_ID,
    first_name: value.firstName,
    last_name: value.lastName,
    email,
    phone,
    business_name: value.businessName || null,
    industry: value.industry || null,
    annoyance: value.annoyance,
    source: "web",
  };

  let registrationId: string;
  if (existing) {
    const { error } = await supabase
      .from("cc_class_registrations")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) {
      console.error("[tuesday] registration update failed:", error.message);
      return { ok: false, error: "We couldn't save that. Please try again in a moment." };
    }
    registrationId = existing.id;
  } else {
    const { data, error } = await supabase
      .from("cc_class_registrations")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) {
      console.error("[tuesday] registration insert failed:", error?.message);
      return { ok: false, error: "We couldn't save that. Please try again in a moment." };
    }
    registrationId = (data as { id: string }).id;
  }

  // The registration is safe from here on. GHL is best-effort.
  const crm = await upsertContactWithTags({
    firstName: value.firstName,
    lastName: value.lastName,
    email,
    phone,
    companyName: value.businessName || null,
    tags: [CLASS_TAGS.registered],
  });

  if (crm.ok) {
    await supabase
      .from("cc_class_registrations")
      .update({ ghl_contact_id: crm.data.contactId })
      .eq("id", registrationId);
  } else {
    console.error("[tuesday] GHL sync failed, row kept for reconciliation:", crm.error);
  }

  revalidatePath("/tuesday-class");

  return {
    ok: true,
    data: { firstName: value.firstName, email, syncedToCrm: crm.ok },
  };
}

/**
 * `useActionState` adapter for the public form.
 *
 * Taking FormData (rather than a typed object) is what lets the form work
 * before React hydrates — an owner on a slow phone can submit a half-loaded
 * page and still end up on the list. Entered values ride back out on failure
 * so a validation error never empties the form someone just filled in.
 */
export type RegistrationFormState = {
  status: "idle" | "error" | "success";
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  success?: RegistrationSuccess;
};

export const initialRegistrationState: RegistrationFormState = { status: "idle" };

const FORM_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "businessName",
  "industry",
  "annoyance",
] as const;

export async function submitRegistration(
  _prev: RegistrationFormState,
  formData: FormData,
): Promise<RegistrationFormState> {
  const values: Record<string, string> = {};
  for (const field of FORM_FIELDS) {
    values[field] = String(formData.get(field) ?? "");
  }

  const result = await registerForClass({
    ...(values as unknown as RegistrationInput),
    website: String(formData.get("website") ?? ""),
  });

  if (!result.ok) {
    return {
      status: "error",
      error: result.error,
      fieldErrors: result.fieldErrors,
      values,
    };
  }
  return { status: "success", success: result.data };
}

// ---------------------------------------------------------------------------
// Founders-only: sessions and attendance
// ---------------------------------------------------------------------------

async function requireOrg(): Promise<{ orgId: string } | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in" };
  return { orgId: await getActiveOrgId() };
}

/** Find or create the session row for a class date. */
export async function ensureClassSession(
  sessionDate: string,
): Promise<ActionResult<CcClassSession>> {
  const org = await requireOrg();
  if ("error" in org) return { ok: false, error: org.error };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
    return { ok: false, error: "Invalid session date" };
  }

  const supabase = await createClient();
  const { data: found } = await supabase
    .from("cc_class_sessions")
    .select("*")
    .eq("org_id", org.orgId)
    .eq("session_date", sessionDate)
    .maybeSingle();
  if (found) return { ok: true, data: found as CcClassSession };

  const { data, error } = await supabase
    .from("cc_class_sessions")
    .insert({ org_id: org.orgId, session_date: sessionDate })
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create the session" };
  }
  return { ok: true, data: data as CcClassSession };
}

export async function setSessionTopic(
  sessionDate: string,
  topic: string,
): Promise<ActionResult> {
  const session = await ensureClassSession(sessionDate);
  if (!session.ok) return session;

  const org = await requireOrg();
  if ("error" in org) return { ok: false, error: org.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("cc_class_sessions")
    .update({ topic: topic.trim() || null })
    .eq("id", session.data!.id)
    .eq("org_id", org.orgId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tuesday-class");
  return { ok: true };
}

export type AttendanceMark = {
  registrationId: string;
  /** `null` clears the mark back to undecided — and never tags anyone. */
  attended: boolean | null;
};

export type AttendanceSaveResult = {
  saved: number;
  cleared: number;
  tagged: number;
  /** Per-person CRM failures, named. Never swallowed. */
  failures: { name: string; email: string; reason: string }[];
};

/**
 * Save a batch of attendance marks and push the matching tags to GHL.
 *
 * The tag contract:
 *   attended → `attended-tuesday`   (replay + feedback track)
 *   no-show  → `missed-tuesday`     ("we missed you" track)
 *   unmarked → nothing at all
 *
 * That last line is the important one. A half-finished check-off must never
 * tag a real attendee as missing — so only marks a human explicitly set are
 * ever sent, and clearing a mark deletes the row without touching the CRM
 * (GHL's own workflows retire their tags when their sequence ends).
 *
 * `tuesday-registered` is permanent list membership and is never removed here.
 */
export async function saveAttendance(
  sessionDate: string,
  marks: AttendanceMark[],
): Promise<ActionResult<AttendanceSaveResult>> {
  const org = await requireOrg();
  if ("error" in org) return { ok: false, error: org.error };
  if (marks.length === 0) return { ok: true, data: emptyResult() };

  const session = await ensureClassSession(sessionDate);
  if (!session.ok) return session;
  const sessionId = session.data!.id;

  const supabase = await createClient();
  const ids = marks.map((m) => m.registrationId);
  const { data: peopleRows, error: peopleError } = await supabase
    .from("cc_class_registrations")
    .select("id, first_name, last_name, email, ghl_contact_id")
    .eq("org_id", org.orgId)
    .in("id", ids);
  if (peopleError) return { ok: false, error: peopleError.message };

  const people = new Map(
    ((peopleRows as Pick<
      CcClassRegistration,
      "id" | "first_name" | "last_name" | "email" | "ghl_contact_id"
    >[] | null) ?? []).map((p) => [p.id, p]),
  );

  const decided = marks.filter((m) => m.attended !== null && people.has(m.registrationId));
  const cleared = marks.filter((m) => m.attended === null && people.has(m.registrationId));

  // Clear first: a mark being removed should not survive as a stale row if the
  // upsert below fails for an unrelated person.
  if (cleared.length > 0) {
    const { error } = await supabase
      .from("cc_class_attendance")
      .delete()
      .eq("session_id", sessionId)
      .in(
        "registration_id",
        cleared.map((m) => m.registrationId),
      );
    if (error) return { ok: false, error: error.message };
  }

  if (decided.length > 0) {
    const rows = decided.map((m) => {
      const person = people.get(m.registrationId)!;
      return {
        session_id: sessionId,
        registration_id: person.id,
        email: person.email,
        attended: m.attended === true,
        source: "manual" as const,
        updated_at: new Date().toISOString(),
      };
    });
    // The unique index is on (session_id, lower(email)), which Postgres can't
    // use as an ON CONFLICT target, so replace this session's rows for exactly
    // these people and reinsert. Scoped to one session, so nothing else moves.
    const { error: delError } = await supabase
      .from("cc_class_attendance")
      .delete()
      .eq("session_id", sessionId)
      .in(
        "registration_id",
        decided.map((m) => m.registrationId),
      );
    if (delError) return { ok: false, error: delError.message };

    const { error } = await supabase.from("cc_class_attendance").insert(rows);
    if (error) return { ok: false, error: error.message };
  }

  // CRM push. Failures are collected and reported, never silently dropped.
  const failures: AttendanceSaveResult["failures"] = [];
  let tagged = 0;

  for (const mark of decided) {
    const person = people.get(mark.registrationId)!;
    const tag = mark.attended ? CLASS_TAGS.attended : CLASS_TAGS.missed;
    const name = `${person.first_name} ${person.last_name}`.trim();

    let contactId = person.ghl_contact_id;
    if (!contactId) {
      const found = await findContactByEmail(person.email);
      if (!found.ok) {
        failures.push({ name, email: person.email, reason: found.error });
        continue;
      }
      if (!found.data) {
        failures.push({
          name,
          email: person.email,
          reason: "No GHL contact with that email — attendance saved, tag not sent.",
        });
        continue;
      }
      contactId = found.data.id;
      await supabase
        .from("cc_class_registrations")
        .update({ ghl_contact_id: contactId })
        .eq("id", person.id);
    }

    const res = await addContactTags(contactId, [tag]);
    if (res.ok) tagged += 1;
    else failures.push({ name, email: person.email, reason: res.error });
  }

  revalidatePath("/tuesday-class");

  return {
    ok: true,
    data: { saved: decided.length, cleared: cleared.length, tagged, failures },
  };
}

function emptyResult(): AttendanceSaveResult {
  return { saved: 0, cleared: 0, tagged: 0, failures: [] };
}

/**
 * Create this week's session row on demand — the page calls this the first
 * time anyone opens the current Tuesday.
 */
export async function ensureCurrentSession(): Promise<ActionResult<CcClassSession>> {
  return ensureClassSession(currentClassDate());
}
