"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateMyProfile } from "@/lib/profile-actions";
import { personName, type Person } from "@/lib/authorship";

interface Props {
  /** The caller's own roster row, or null when no login is linked to one. */
  member: Person | null;
  /** Clerk's own name, shown when there is no roster row to edit. */
  fallbackName: string | null;
}

/**
 * "Your profile" — the one place a member edits their own name.
 *
 * There is no member picker here on purpose. `updateMyProfile` takes no id and
 * locates the row by the caller's Clerk user id server-side, so this card can
 * only ever write to the person using it. Editing someone *else's* record is
 * still an admin action on the Team page.
 */
export function ProfileCard({ member, fallbackName }: Props) {
  const [displayName, setDisplayName] = useState(member?.display_name ?? "");
  const [title, setTitle] = useState(member?.title ?? "");
  const [pronouns, setPronouns] = useState(member?.pronouns ?? "");
  const [saved, setSaved] = useState<Person | null>(member);
  const [submitting, setSubmitting] = useState(false);

  const dirty =
    (saved?.display_name ?? "") !== displayName ||
    (saved?.title ?? "") !== title ||
    (saved?.pronouns ?? "") !== pronouns;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await updateMyProfile({
      displayName: displayName || null,
      title: title || null,
      pronouns: pronouns || null,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    // Take the saved row back rather than trusting the local form: the server
    // trims and caps what it stores, so this is what everyone else will see.
    setSaved(result.data);
    setDisplayName(result.data.display_name ?? "");
    setTitle(result.data.title ?? "");
    setPronouns(result.data.pronouns ?? "");
    toast.success("Profile updated");
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-[color:var(--color-brand-electric)]/15 flex items-center justify-center shrink-0">
            <UserRound className="size-4 text-[color:var(--color-brand-electric)]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Your profile</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              This is the name the Command Center shows on your To-Dos, Rocks,
              Wins and issues — and next to your seat on the Team page. You edit
              your own; nobody needs to do it for you.
            </p>
          </div>
        </div>

        {member === null ? (
          <div className="rounded-md border border-[color:var(--color-brand-warning)]/40 bg-[color:var(--color-brand-warning)]/10 px-3 py-2 text-xs text-[color:var(--color-brand-warning)]">
            {fallbackName
              ? `You're signed in as ${fallbackName}, but no roster record is linked to that login yet.`
              : "No roster record is linked to your login yet."}{" "}
            Ask an admin to link you on the Team page, then this card becomes
            editable.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="profile-display-name"
                >
                  Display name
                </label>
                <Input
                  id="profile-display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={member.full_name}
                  maxLength={80}
                />
                <p className="text-[10px] text-muted-foreground">
                  Leave blank to keep using your roster name,{" "}
                  <span className="text-foreground">{member.full_name}</span>.
                </p>
              </div>

              <div className="space-y-1">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="profile-title"
                >
                  Title
                </label>
                <Input
                  id="profile-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. COO"
                  maxLength={120}
                />
                <p className="text-[10px] text-muted-foreground">
                  Shown under your name on the roster and org chart.
                </p>
              </div>
            </div>

            <div className="space-y-1 md:max-w-[calc(50%-0.375rem)]">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="profile-pronouns"
              >
                Pronouns
              </label>
              <Input
                id="profile-pronouns"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
                placeholder="e.g. she/her"
                maxLength={40}
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" size="sm" disabled={submitting || !dirty}>
                {submitting ? "Saving…" : "Save profile"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Saved as{" "}
                <span className="text-foreground">{personName(saved ?? member)}</span>
                {saved?.pronouns ? ` (${saved.pronouns})` : ""}
                {saved?.title ? ` · ${saved.title}` : ""}
              </span>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
