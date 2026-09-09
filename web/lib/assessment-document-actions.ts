"use server";

/**
 * The data room holds files, and the client gets a link.
 *
 * Files go to the private `assessment-documents` bucket (migration 0014) under
 * `{org_id}/{assessment_id}/{uuid}-{filename}`; the bucket's policies hold the
 * first path segment against the caller's org claim, and every path this file
 * mints is checked again here before it is written into `documents`, so a
 * path can never point outside the engagement it is logged on.
 *
 * The client link is a second unguessable token on the row, honoured by
 * /results/<token> only while the engagement is delivered. It is deliberately
 * outside the delivered-row lock: issuing it after release is the point.
 */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { todayInET } from "@/lib/business-date";
import { ASSESSMENT_DOCUMENT_KINDS } from "@/lib/assessment-instrument";
import type { ActionResult } from "@/lib/assessment-actions";
import type {
  AssessmentDocument,
  AssessmentStatus,
  CcAssessment,
  Json,
} from "@/lib/supabase/types";

export const DOCUMENTS_BUCKET = "assessment-documents";
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const KINDS = new Set<string>(ASSESSMENT_DOCUMENT_KINDS);

async function requireOrg(): Promise<{ orgId: string } | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in" };
  return { orgId: await getActiveOrgId() };
}

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

/** Keep the original name readable in the bucket, minus anything path-like. */
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || "file";
}

function parseDocuments(value: unknown): AssessmentDocument[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (d): d is AssessmentDocument =>
      !!d && typeof d === "object" && typeof (d as { name?: unknown }).name === "string"
  );
}

async function loadRow(
  id: string,
  orgId: string
): Promise<
  | { ok: true; status: AssessmentStatus; documents: AssessmentDocument[] }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cc_assessments")
    .select("status, documents")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Assessment not found" };
  const row = data as { status: AssessmentStatus; documents: unknown };
  return { ok: true, status: row.status, documents: parseDocuments(row.documents) };
}

async function writeDocuments(
  id: string,
  orgId: string,
  documents: AssessmentDocument[],
  extra: Record<string, unknown> = {}
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const supabase = await createClient();
  // Under RLS a refused update reports success with no rows — hand a row back.
  const { data, error } = await supabase
    .from("cc_assessments")
    .update({
      documents: documents as unknown as Json,
      updated_at: new Date().toISOString(),
      ...extra,
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error:
        "The document list did not save — the engagement may be delivered or you may not have access.",
    };
  }
  revalidatePath(`/assessments/${id}`);
  return { ok: true, data: { assessment: data as CcAssessment } };
}

/**
 * Upload one file and log it in the data room. Called with a FormData carrying
 * `assessment_id`, `kind`, and `file`.
 */
export async function uploadAssessmentDocument(
  formData: FormData
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const id = formData.get("assessment_id");
  const kind = formData.get("kind");
  const file = formData.get("file");
  if (!isUuid(id)) return { ok: false, error: "Assessment not found" };
  if (typeof kind !== "string" || !KINDS.has(kind)) {
    return { ok: false, error: `Unknown document kind: ${String(kind)}` };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file first." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "That file is over 25 MB. Export a smaller PDF or split it." };
  }
  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(contentType)) {
    return {
      ok: false,
      error: "PDF, PNG, JPEG, CSV, Excel and Word files only.",
    };
  }

  const row = await loadRow(id, ctx.orgId);
  if (!row.ok) return row;
  const isBlueprint = kind === "blueprint";
  if (row.status === "delivered" && !isBlueprint) {
    return {
      ok: false,
      error:
        "This engagement is delivered. Reopen it for edits to add data-room documents; the Executive Blueprint PDF can still be attached.",
    };
  }
  if (isBlueprint && contentType !== "application/pdf") {
    return { ok: false, error: "The Executive Blueprint is attached as a PDF." };
  }

  const fileName = safeFileName(file.name);
  const path = `${ctx.orgId}/${id}/${randomUUID()}-${fileName}`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType, upsert: false });
  if (uploadError) {
    return { ok: false, error: `Upload failed: ${uploadError.message}` };
  }

  // The released Blueprint lives in its own column, outside the delivered-row
  // lock: it only exists once the row is delivered, and the client page serves
  // it from here. Replacing it swaps the file; the old one is removed.
  if (isBlueprint) {
    const { data: prev } = await supabase
      .from("cc_assessments")
      .select("blueprint_storage_path")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    const { data, error } = await supabase
      .from("cc_assessments")
      .update({ blueprint_storage_path: path, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .select("*")
      .maybeSingle();
    if (error || !data) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
      return { ok: false, error: error?.message ?? "The Blueprint did not attach — you may not have access." };
    }
    const old = (prev as { blueprint_storage_path: string | null } | null)?.blueprint_storage_path;
    if (old && old !== path && old.startsWith(`${ctx.orgId}/${id}/`)) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([old]);
    }
    revalidatePath(`/assessments/${id}`);
    return { ok: true, data: { assessment: data as CcAssessment } };
  }

  const entry: AssessmentDocument = {
    name: fileName,
    kind: kind as AssessmentDocument["kind"],
    received_on: todayInET(),
    storage_path: path,
    content_type: contentType,
    size_bytes: file.size,
  };
  const result = await writeDocuments(id, ctx.orgId, [...row.documents, entry]);
  if (!result.ok) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
  }
  return result;
}

/** A short-lived link to open or download one stored document. */
export async function getAssessmentDocumentUrl(
  id: string,
  storagePath: string
): Promise<ActionResult<{ url: string }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!isUuid(id) || !storagePath.startsWith(`${ctx.orgId}/${id}/`)) {
    return { ok: false, error: "Document not found" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, 600);
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? "Could not open the document" };
  }
  return { ok: true, data: { url: data.signedUrl } };
}

/** Remove a stored file and its data-room entry. Refused after delivery. */
export async function removeAssessmentDocument(
  id: string,
  storagePath: string
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!isUuid(id) || !storagePath.startsWith(`${ctx.orgId}/${id}/`)) {
    return { ok: false, error: "Document not found" };
  }
  const row = await loadRow(id, ctx.orgId);
  if (!row.ok) return row;
  if (row.status === "delivered") {
    return {
      ok: false,
      error: "This engagement is delivered. Reopen it for edits before removing documents.",
    };
  }
  const remaining = row.documents.filter((d) => d.storage_path !== storagePath);
  const result = await writeDocuments(id, ctx.orgId, remaining);
  if (result.ok) {
    const supabase = await createClient();
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
  }
  return result;
}

// ── Client link ─────────────────────────────────────────────────────────────

/**
 * Issue (or rotate) the owner's results link. Only a delivered engagement can
 * carry one — the page it opens is the released document, nothing earlier.
 */
export async function issueClientLink(
  id: string
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!isUuid(id)) return { ok: false, error: "Assessment not found" };

  const row = await loadRow(id, ctx.orgId);
  if (!row.ok) return row;
  if (row.status !== "delivered") {
    return {
      ok: false,
      error: "Mark the engagement delivered first — the client link opens the released document.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cc_assessments")
    .update({
      client_token: randomUUID(),
      client_token_issued_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "The link did not save — you may not have access." };
  revalidatePath(`/assessments/${id}`);
  return { ok: true, data: { assessment: data as CcAssessment } };
}

/** Close the owner's results link. The page answers "closed" from then on. */
export async function revokeClientLink(
  id: string
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!isUuid(id)) return { ok: false, error: "Assessment not found" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cc_assessments")
    .update({
      client_token: null,
      client_token_issued_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "The link did not close — you may not have access." };
  revalidatePath(`/assessments/${id}`);
  return { ok: true, data: { assessment: data as CcAssessment } };
}
