"use client";

import { useState } from "react";
import { UserPlus, MailWarning, Clock } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { inviteTeammateAction } from "@/app/(dashboard)/settings/invite-actions";
import { INVITE_ROLES, type InviteRole } from "@/lib/team-roles";
import { personName } from "@/lib/authorship";
import type { TeamMember } from "@/lib/supabase/types";

interface Props {
  roster: TeamMember[];
  /** Clerk's org role for the viewer; only an admin sees the invite form. */
  isAdmin: boolean;
}

const STATUS_COPY: Record<string, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "text-[color:var(--color-brand-success)]",
  },
  invited: {
    label: "Invited — not signed up yet",
    className: "text-[color:var(--color-brand-warning)]",
  },
  inactive: { label: "Inactive", className: "text-muted-foreground" },
};

/**
 * "Team" — the roster, and the invite that actually sends an email.
 *
 * Clerk's own Members UI creates an invitation silently on this development
 * instance: the teammate is told nothing and never arrives. This panel goes
 * through the same Clerk invitation (so membership stays Clerk's business) and
 * then sends the mail through Resend.
 *
 * An invited teammate is listed immediately, in their own state, so nobody
 * invites the same person three times wondering why nothing happened.
 */
/** Field-complete blank used only for the optimistic row above. */
const PENDING_MEMBER: TeamMember = {
  id: "",
  org_id: "",
  clerk_user_id: null,
  full_name: "",
  display_name: null,
  pronouns: null,
  email: null,
  role: "member",
  title: null,
  department: null,
  avatar_url: null,
  bio: null,
  status: "invited",
  reports_to: null,
  joined_at: null,
  created_at: "",
  updated_at: "",
};

export function TeamPanel({ roster, isAdmin }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<InviteRole>("member");
  const [submitting, setSubmitting] = useState(false);
  const [members, setMembers] = useState(roster);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    const result = await inviteTeammateAction({ email, name, role });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    const { emailed, emailError, alreadyKnown, email: sentTo } = result.data;
    if (emailed) {
      toast.success(
        alreadyKnown
          ? `${sentTo} was already invited — sent them the email again.`
          : `Invited ${sentTo} and emailed them the link.`,
      );
    } else {
      // The invitation is real either way; what failed is the delivery. Saying
      // "invited" alone would leave someone waiting on an email that is never
      // coming, so the failure is named and the manual fallback given.
      toast.warning(
        `${sentTo} is invited in Clerk, but the email didn't send${
          emailError ? ` — ${emailError}` : ""
        }. Send them to cc.getcreait.com/sign-up yourself.`,
        { duration: 12_000 },
      );
    }

    setEmail("");
    setName("");
    setRole("member");

    // Optimistically show the pending teammate. A page revalidation is already
    // queued server-side; this just stops the row appearing a beat late.
    if (!members.some((m) => m.email?.toLowerCase() === sentTo)) {
      setMembers((prev) => [
        ...prev,
        // A placeholder for the row the server just wrote, not a real record:
        // the revalidation replaces it within the same interaction. Built from
        // a real TeamMember shape so it can never drift from the type.
        {
          ...PENDING_MEMBER,
          id: `pending-${sentTo}`,
          full_name: name.trim() || sentTo.split("@")[0],
          email: sentTo,
          role,
        },
      ]);
    }
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Team</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Everyone with access to the Command Center. Invitations are sent
            from here — Clerk&apos;s own Members screen creates the invite but
            does not email anyone on this instance.
          </p>
        </div>

        <ul className="divide-y divide-border">
          {members.map((m) => {
            const status = STATUS_COPY[m.status] ?? STATUS_COPY.inactive;
            return (
              <li
                key={m.id}
                className="py-2.5 flex items-center gap-3 text-sm"
              >
                <span className="size-7 rounded-full bg-[color:var(--color-brand-slate)] flex items-center justify-center text-[11px] font-medium shrink-0">
                  {personName(m).slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{personName(m)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {m.email ?? "no email on file"}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground capitalize">
                  {m.role}
                </span>
                <span
                  className={cn(
                    "text-[11px] flex items-center gap-1 shrink-0",
                    status.className,
                  )}
                >
                  {m.status === "invited" && <Clock className="size-3" />}
                  {status.label}
                </span>
              </li>
            );
          })}
        </ul>

        {isAdmin ? (
          <form
            onSubmit={invite}
            className="grid grid-cols-1 md:grid-cols-12 gap-2 pt-1"
          >
            <Input
              className="md:col-span-5"
              type="email"
              placeholder="teammate@creait.tech"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              className="md:col-span-4"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Select
              value={role}
              onValueChange={(v) =>
                typeof v === "string" && setRole(v as InviteRole)
              }
            >
              <SelectTrigger className="md:col-span-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITE_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="submit"
              className="md:col-span-1"
              disabled={submitting || !email.trim()}
              aria-label="Send invitation"
            >
              <UserPlus className="size-4" />
            </Button>
          </form>
        ) : (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <MailWarning className="size-3.5" />
            Only an organization admin can invite teammates.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
