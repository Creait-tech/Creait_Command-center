"use client";

/**
 * The parts of the Review step that touch files and the client link.
 *
 *   DocumentUploadRow  — pick a file, log it in the data room (bucket
 *                        `assessment-documents`, migration 0014).
 *   DocumentRowActions — Open (signed URL) and Remove for one logged document.
 *   ClientLinkPanel    — attach the released Blueprint PDF, issue / rotate /
 *                        close the owner's results link, copy it.
 *
 * All three hand the returned engagement row back to the workbench, which is
 * the only holder of state; nothing here keeps a copy.
 */

import { useRef, useState } from "react";
import { Copy, ExternalLink, Link2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getAssessmentDocumentUrl,
  issueClientLink,
  removeAssessmentDocument,
  revokeClientLink,
  uploadAssessmentDocument,
} from "@/lib/assessment-document-actions";
import type {
  AssessmentDocument,
  CcAssessment,
} from "@/lib/supabase/types";
import type { AssessmentDocumentKind } from "@/lib/assessment-instrument";

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.csv,.xls,.xlsx,.doc,.docx,application/pdf,image/png,image/jpeg,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function formatBytes(n: number | null | undefined): string {
  if (!n || !Number.isFinite(n)) return "";
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/** A file picker that uploads on selection and logs the document under `kind`. */
export function DocumentUploadRow({
  assessmentId,
  kind,
  disabled,
  onAssessment,
  label = "Upload file",
}: {
  assessmentId: string;
  kind: AssessmentDocumentKind;
  disabled?: boolean;
  onAssessment: (a: CcAssessment) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("assessment_id", assessmentId);
    fd.append("kind", kind);
    fd.append("file", file);
    const res = await uploadAssessmentDocument(fd);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data) onAssessment(res.data.assessment);
    toast.success(`${file.name} attached`);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        title="PDF, PNG, JPEG, CSV, Excel or Word, up to 25 MB"
      >
        <Upload className="size-3.5" /> {busy ? "Uploading…" : label}
      </Button>
    </>
  );
}

/** Open / Remove for one logged document. Logged-only rows get Remove alone. */
export function DocumentRowActions({
  assessmentId,
  doc,
  disabled,
  onRemoveLogged,
  onAssessment,
}: {
  assessmentId: string;
  doc: AssessmentDocument;
  disabled?: boolean;
  onRemoveLogged: () => void;
  onAssessment: (a: CcAssessment) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function open() {
    if (!doc.storage_path) return;
    setBusy(true);
    const res = await getAssessmentDocumentUrl(assessmentId, doc.storage_path);
    setBusy(false);
    if (!res.ok || !res.data) {
      toast.error(res.ok ? "Could not open the document" : res.error);
      return;
    }
    window.open(res.data.url, "_blank", "noopener,noreferrer");
  }

  async function remove() {
    if (!doc.storage_path) {
      onRemoveLogged();
      return;
    }
    if (!window.confirm(`Remove "${doc.name}" from the data room? The file is deleted.`)) return;
    setBusy(true);
    const res = await removeAssessmentDocument(assessmentId, doc.storage_path);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data) onAssessment(res.data.assessment);
  }

  return (
    <span className="flex shrink-0 items-center gap-1">
      {doc.storage_path && (
        <>
          <span className="text-[11px] tabular-nums text-muted-foreground/70">
            {formatBytes(doc.size_bytes)}
          </span>
          <Button size="xs" variant="ghost" onClick={() => void open()} disabled={busy}>
            <ExternalLink className="size-3" /> Open
          </Button>
        </>
      )}
      <Button size="xs" variant="ghost" onClick={() => void remove()} disabled={disabled || busy}>
        Remove
      </Button>
    </span>
  );
}

/**
 * After delivery: the released PDF and the owner's link.
 *
 * The link opens /results/<token>, which renders the same exhibits the deck
 * showed on screen plus the PDF. Rotating mints a new token and closes the old
 * one; closing leaves the page saying "this link is closed".
 */
export function ClientLinkPanel({
  assessment,
  onAssessment,
}: {
  assessment: {
    id: string;
    status: string;
    client_token: string | null;
    client_token_issued_at: string | null;
    blueprint_storage_path: string | null;
  };
  onAssessment: (a: CcAssessment) => void;
}) {
  const [busy, setBusy] = useState(false);
  const delivered = assessment.status === "delivered";
  const link =
    assessment.client_token && typeof window !== "undefined"
      ? `${window.location.origin}/results/${assessment.client_token}`
      : null;

  async function issue() {
    setBusy(true);
    const res = await issueClientLink(assessment.id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data) onAssessment(res.data.assessment);
    toast.success(assessment.client_token ? "Link replaced — the old one is closed" : "Client link issued");
  }

  async function revoke() {
    if (!window.confirm("Close the client's results link? They will see \"this link is closed\".")) return;
    setBusy(true);
    const res = await revokeClientLink(assessment.id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data) onAssessment(res.data.assessment);
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy — select the link and copy it by hand.");
    }
  }

  async function openBlueprint() {
    if (!assessment.blueprint_storage_path) return;
    const res = await getAssessmentDocumentUrl(assessment.id, assessment.blueprint_storage_path);
    if (!res.ok || !res.data) {
      toast.error(res.ok ? "Could not open the PDF" : res.error);
      return;
    }
    window.open(res.data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-4 border-t border-border/60 pt-4">
      <div>
        <h3 className="text-[13px] font-semibold">The client&apos;s copy</h3>
        <p className="mt-1 max-w-[74ch] text-[12px] leading-relaxed text-muted-foreground">
          Print the Executive Blueprint to PDF, attach it here, then issue the
          link. The page the owner opens shows the score, the pillars, the
          mirror, the priced findings and the 90-day plan, with the PDF to
          download, and it picks up the day-30 and day-90 reviews as you record
          them. Nothing else on this engagement reaches them.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DocumentUploadRow
          assessmentId={assessment.id}
          kind="blueprint"
          disabled={!delivered}
          onAssessment={onAssessment}
          label={assessment.blueprint_storage_path ? "Replace the PDF" : "Attach the Blueprint PDF"}
        />
        {assessment.blueprint_storage_path && (
          <Button size="sm" variant="ghost" onClick={() => void openBlueprint()}>
            <ExternalLink className="size-3.5" /> Open attached PDF
          </Button>
        )}
        {!assessment.blueprint_storage_path && (
          <span className="text-[11.5px] text-muted-foreground/80">
            No PDF attached yet — the link works without it, but the download button will not show.
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {link ? (
          <>
            <code className="max-w-full truncate rounded bg-[color:var(--color-brand-slate)]/60 px-2 py-1 text-[12px]">
              {link}
            </code>
            <Button size="sm" variant="outline" onClick={() => void copy()}>
              <Copy className="size-3.5" /> Copy link
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void issue()} disabled={busy}>
              Replace link
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void revoke()} disabled={busy}>
              Close link
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => void issue()} disabled={!delivered || busy}>
            <Link2 className="size-3.5" /> Issue the client link
          </Button>
        )}
        {assessment.client_token_issued_at && (
          <span className="text-[11px] text-muted-foreground/70">
            issued {new Date(assessment.client_token_issued_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
}
