-- 0014 — The data room holds files, and the client gets a link.
--
-- Two things the founder click-through and the rigor review asked for:
--
--   1. "P&L on file" was a checkbox. The documents column listed names; the
--      files lived in someone's inbox. This adds a private storage bucket,
--      `assessment-documents`, whose object paths are `{org_id}/{assessment_id}/…`
--      and whose policies hold the first path segment against the caller's
--      Clerk org claim — the same isolation rule every cc_ table uses. The
--      `documents` JSONB gains `storage_path`, `content_type` and `size_bytes`
--      per entry (validated in the application, as before). The Executive
--      Blueprint PDF is one more document kind, so the client page can serve it.
--
--   2. A delivered engagement can be shared with the owner through
--      `client_token`, an unguessable path segment under /results/<token>,
--      mirroring `intake_token` (0013). It is issued and revoked by the
--      facilitator, is only honoured while status = 'delivered', and is NOT in
--      the delivered-row lock: issuing the link after release is the point.
--      Rotating it is how a leaked link is closed.

-- ── Storage bucket ──────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assessment-documents',
  'assessment-documents',
  false,
  26214400, -- 25 MB
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Object-level isolation: the first folder of the path is the org id.
DROP POLICY IF EXISTS assessment_documents_org_select ON storage.objects;
CREATE POLICY assessment_documents_org_select ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assessment-documents'
    AND (storage.foldername(name))[1] = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))
  );

DROP POLICY IF EXISTS assessment_documents_org_insert ON storage.objects;
CREATE POLICY assessment_documents_org_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assessment-documents'
    AND (storage.foldername(name))[1] = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))
  );

DROP POLICY IF EXISTS assessment_documents_org_update ON storage.objects;
CREATE POLICY assessment_documents_org_update ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'assessment-documents'
    AND (storage.foldername(name))[1] = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))
  );

DROP POLICY IF EXISTS assessment_documents_org_delete ON storage.objects;
CREATE POLICY assessment_documents_org_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'assessment-documents'
    AND (storage.foldername(name))[1] = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))
  );

-- ── Client link ─────────────────────────────────────────────────────────────

ALTER TABLE public.cc_assessments
  ADD COLUMN IF NOT EXISTS client_token           UUID,
  ADD COLUMN IF NOT EXISTS client_token_issued_at TIMESTAMPTZ,
  -- The printed Executive Blueprint, attached AFTER release so the client page
  -- can serve it. It lives outside `documents` on purpose: that column is in
  -- the delivered-row lock, and the PDF only exists once the row is delivered.
  ADD COLUMN IF NOT EXISTS blueprint_storage_path TEXT;

COMMENT ON COLUMN public.cc_assessments.blueprint_storage_path IS
  'Object path of the released Executive Blueprint PDF in the assessment-documents bucket. Attached after delivery; replaced, never edited.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_assessments_client_token
  ON public.cc_assessments (client_token)
  WHERE client_token IS NOT NULL;

COMMENT ON COLUMN public.cc_assessments.client_token IS
  'Unguessable path segment of the owner''s results page (/results/<token>). Honoured only while status = delivered. Issue, rotate or revoke from the workbench; never printed anywhere but the link itself.';
COMMENT ON COLUMN public.cc_assessments.client_token_issued_at IS
  'When the current client_token was issued; null when none is live.';
