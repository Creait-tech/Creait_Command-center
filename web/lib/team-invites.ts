import "server-only";

/**
 * Inviting a teammate into the Command Center.
 *
 * Clerk's own Members UI creates an invitation but this instance is a
 * *development* instance, and no invitation email has ever arrived — verified
 * by searching the inbox, not assumed. So a teammate was invited, saw nothing,
 * and had to be told out of band to go and sign up. That is not an invite.
 *
 * This module keeps Clerk as the authority on membership — the invitation is
 * still created through Clerk's Backend API, so the person genuinely lands in
 * the CREAIT organization rather than in some parallel roster of our own — and
 * adds the one thing the dev instance will not do: actually send the email,
 * through Resend, which this project already uses for transactional mail.
 *
 * Clerk's REST API is called directly rather than through the SDK: the same
 * choice the GHL and Resend helpers make, and it does not move under us when
 * the SDK's TypeScript surface changes.
 */

import { auth, currentUser } from "@clerk/nextjs/server";

import { getActiveOrgId } from "@/lib/active-org";
import { sendEmail } from "@/lib/email";
import { createServiceClient } from "@/lib/supabase/server";
import { INVITE_ROLES, type InviteRole } from "@/lib/team-roles";

export type { InviteRole };

const CLERK_API = "https://api.clerk.com/v1";

export interface InviteResult {
  email: string;
  /** True when Clerk now holds a pending invitation for this address. */
  invited: boolean;
  /** True when the Resend email went out. */
  emailed: boolean;
  /** Present when the email could not be sent — the invite still stands. */
  emailError?: string;
  /** Set when Clerk already knew about this person. */
  alreadyKnown?: boolean;
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
    "https://cc.getcreait.com"
  );
}

/**
 * The invitation email.
 *
 * It names who is inviting them and what the Command Center is for, because a
 * bare link from an unfamiliar domain reads as phishing. The one instruction
 * that matters is stated twice: sign up with *this* address, because Clerk
 * matches the pending invitation on the email and any other address creates an
 * account outside the organization that then sees nothing.
 */
function inviteHtml(args: {
  inviterName: string;
  recipientName: string | null;
  role: InviteRole;
  email: string;
}): string {
  const greeting = args.recipientName ? `Hi ${args.recipientName},` : "Hi,";
  const roleLine =
    args.role === "admin"
      ? "You'll join as an admin, so you can invite others and change settings."
      : "You'll join as a member.";
  const url = `${appUrl()}/sign-up`;
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
  <p style="margin:0 0 16px;line-height:1.55">${greeting}</p>
  <p style="margin:0 0 16px;line-height:1.55">
    <strong>${args.inviterName}</strong> has invited you to the
    <strong>CREAiT Command Center</strong> — the place the team runs its Level 10
    meetings, Rocks, To-Dos and client delivery from. ${roleLine}
  </p>
  <p style="margin:0 0 24px;line-height:1.55">
    <a href="${url}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600">
      Create your account
    </a>
  </p>
  <p style="margin:0 0 16px;line-height:1.55;padding:12px 14px;background:#f1f5f9;border-radius:6px">
    Please sign up with <strong>${args.email}</strong>. Your invitation is tied to
    that address — signing up with a different one creates an account that
    can't see the team's workspace.
  </p>
  <p style="margin:0;line-height:1.55;color:#64748b;font-size:13px">
    If you weren't expecting this, you can ignore it — nothing happens until you
    create an account.
  </p>
</div>`.trim();
}

interface ClerkErrorBody {
  errors?: Array<{ code?: string; message?: string; long_message?: string }>;
}

/**
 * Clerk refuses a duplicate invitation and refuses to invite an existing
 * member. Neither is a failure the person inviting needs to act on — the
 * outcome they wanted (this teammate can get in) is already true — so both are
 * reported as success with `alreadyKnown`, and the email is still sent, since
 * the reason we are here at all is that the first one never arrived.
 */
function isAlreadyKnown(body: ClerkErrorBody): boolean {
  return (body.errors ?? []).some((e) => {
    const code = e.code ?? "";
    return (
      code === "duplicate_record" ||
      code === "organization_invitation_already_exists" ||
      code === "already_a_member_in_organization"
    );
  });
}

function clerkErrorMessage(body: ClerkErrorBody, status: number): string {
  const first = (body.errors ?? [])[0];
  return first?.long_message ?? first?.message ?? `Clerk returned ${status}`;
}

/**
 * Invite one teammate.
 *
 * Order matters. Clerk first: if the invitation cannot be created, the person
 * has no route in, and an email telling them to sign up would send them into a
 * workspace they can't join. Only once membership is genuinely pending do we
 * write the roster row and send the mail.
 */
export async function inviteTeammate(args: {
  email: string;
  name: string | null;
  role: InviteRole;
}): Promise<{ ok: true; data: InviteResult } | { ok: false; error: string }> {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    return { ok: false, error: "CLERK_SECRET_KEY is not configured." };
  }

  const { userId, orgId: clerkOrgId } = await auth();
  if (!userId) return { ok: false, error: "Not signed in." };
  if (!clerkOrgId) {
    return {
      ok: false,
      error: "No active organization — switch to CREAIT and try again.",
    };
  }

  const email = args.email.trim().toLowerCase();
  // Deliberately permissive: the goal is to catch a typo like a missing "@",
  // not to adjudicate RFC 5322. Clerk validates properly on its side.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That doesn't look like an email address." };
  }

  const roleDef = INVITE_ROLES.find((r) => r.value === args.role);
  if (!roleDef) return { ok: false, error: "Unknown role." };

  let alreadyKnown = false;
  try {
    const res = await fetch(
      `${CLERK_API}/organizations/${clerkOrgId}/invitations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inviter_user_id: userId,
          email_address: email,
          role: roleDef.clerk,
        }),
      },
    );

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as ClerkErrorBody;
      if (!isAlreadyKnown(body)) {
        return { ok: false, error: clerkErrorMessage(body, res.status) };
      }
      alreadyKnown = true;
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Could not reach Clerk: ${err.message}`
          : "Could not reach Clerk.",
    };
  }

  // The roster row makes the pending teammate visible in the app immediately,
  // so nobody invites the same person twice. `invited` is its own status: they
  // are not active (cannot sign in yet) and not inactive (which means gone).
  const orgId = await getActiveOrgId();
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("team_members")
    .select("id, status")
    .eq("org_id", orgId)
    .ilike("email", email)
    .maybeSingle();

  const row = existing as { id: string; status: string } | null;
  if (row) {
    // Never demote someone who has already signed in back to "invited".
    if (row.status !== "active") {
      await supabase
        .from("team_members")
        .update({ status: "invited", updated_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  } else {
    await supabase.from("team_members").insert({
      org_id: orgId,
      full_name: args.name?.trim() || email.split("@")[0],
      email,
      role: args.role,
      status: "invited",
    });
  }

  const inviter = await currentUser();
  const inviterName =
    inviter?.fullName?.trim() ||
    [inviter?.firstName, inviter?.lastName].filter(Boolean).join(" ").trim() ||
    "A teammate";

  const sent = await sendEmail({
    to: email,
    subject: `${inviterName} invited you to the CREAiT Command Center`,
    html: inviteHtml({
      inviterName,
      recipientName: args.name?.trim() || null,
      role: args.role,
      email,
    }),
  });

  return {
    ok: true,
    data: {
      email,
      invited: true,
      emailed: sent.ok,
      // A skipped send (no RESEND_API_KEY) is not the same as a failed one, and
      // the difference decides whether the person inviting needs to follow up
      // by hand — so it is reported rather than folded into a generic error.
      emailError: sent.ok
        ? undefined
        : sent.skipped
          ? "Email not sent — RESEND_API_KEY isn't set on this deployment."
          : sent.error,
      alreadyKnown,
    },
  };
}
