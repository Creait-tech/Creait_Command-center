"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { savePrepAnswer, setPrepSubmitted } from "@/lib/prep-actions";
import type { PrepAnswerRow, PrepQuestionRow, PrepSessionRow } from "@/lib/prep-types";
import { personName, type Person } from "@/lib/authorship";

interface Props {
  session: PrepSessionRow;
  questions: PrepQuestionRow[];
  /** Every answer the viewer may see — their own always, others once revealed. */
  answers: PrepAnswerRow[];
  people: Person[];
  viewerMemberId: string | null;
  revealed: boolean;
  submitted: boolean;
}

/** Debounce so a paragraph is one save, not one save per keystroke. */
const SAVE_DEBOUNCE_MS = 900;

export function PrepAnswerForm({ session, questions, answers, people, viewerMemberId, revealed, submitted }: Props) {
  const router = useRouter();
  const closed = session.status === "closed";
  const byId = new Map(people.map((p) => [p.id, p]));

  const mine = new Map(answers.filter((a) => a.member_id === viewerMemberId).map((a) => [a.question_id, a]));
  const [text, setText] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, mine.get(q.id)?.answer ?? ""])),
  );
  const [items, setItems] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, mine.get(q.id)?.items ?? []])),
  );
  const [draftItem, setDraftItem] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  // A boolean that clears itself, not a timestamp compared during render —
  // reading the clock while rendering is impure.
  const [justSaved, setJustSaved] = useState<Record<string, boolean>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of Object.values(pending)) clearTimeout(t);
    };
  }, []);

  async function persist(questionId: string, payload: { answer?: string | null; items?: string[] }) {
    setSaving((p) => ({ ...p, [questionId]: true }));
    const result = await savePrepAnswer({ sessionId: session.id, questionId, ...payload });
    setSaving((p) => ({ ...p, [questionId]: false }));
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setJustSaved((p) => ({ ...p, [questionId]: true }));
    setTimeout(() => setJustSaved((p) => ({ ...p, [questionId]: false })), 4000);
  }

  function onText(questionId: string, value: string) {
    setText((p) => ({ ...p, [questionId]: value }));
    clearTimeout(timers.current[questionId]);
    timers.current[questionId] = setTimeout(() => void persist(questionId, { answer: value }), SAVE_DEBOUNCE_MS);
  }

  function addItem(questionId: string) {
    const value = (draftItem[questionId] ?? "").trim();
    if (!value) return;
    const next = [...(items[questionId] ?? []), value];
    setItems((p) => ({ ...p, [questionId]: next }));
    setDraftItem((p) => ({ ...p, [questionId]: "" }));
    void persist(questionId, { items: next });
  }

  function removeItem(questionId: string, index: number) {
    const next = (items[questionId] ?? []).filter((_, i) => i !== index);
    setItems((p) => ({ ...p, [questionId]: next }));
    void persist(questionId, { items: next });
  }

  async function toggleSubmitted() {
    // Flush anything still waiting on the debounce, or "submitted" would mean
    // "submitted except the sentence I was mid-way through".
    for (const [questionId, timer] of Object.entries(timers.current)) {
      clearTimeout(timer);
      delete timers.current[questionId];
      await persist(questionId, { answer: text[questionId] ?? "" });
    }
    const result = await setPrepSubmitted(session.id, !submitted);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(submitted ? "Reopened — you can keep editing." : "Submitted. Thanks.");
    router.refresh();
  }

  const answeredCount = questions.filter(
    (q) => (text[q.id] ?? "").trim().length > 0 || (items[q.id] ?? []).length > 0,
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-border px-4 py-3">
        <p className="text-sm">
          <span className="font-semibold">
            {answeredCount}/{questions.length}
          </span>
          <span className="text-muted-foreground"> answered</span>
          {!revealed && (
            <span className="text-muted-foreground">
              {" · "}
              <Lock className="inline size-3" /> others&apos; answers are hidden for now
            </span>
          )}
        </p>
        {viewerMemberId && !closed && (
          <Button variant={submitted ? "outline" : "default"} size="sm" onClick={() => void toggleSubmitted()}>
            {submitted ? "Reopen my answers" : "I'm done"}
          </Button>
        )}
      </div>

      {!viewerMemberId && (
        <p className="text-xs text-[color:var(--color-brand-warning)]">
          You&apos;re not on the team roster, so you can read this session but not answer it.
        </p>
      )}

      <ol className="space-y-6">
        {questions.map((q, i) => {
          const others = revealed
            ? answers.filter((a) => a.question_id === q.id && a.member_id !== viewerMemberId)
            : [];
          const busy = saving[q.id];
          const saved = justSaved[q.id];
          return (
            <li key={q.id} className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground mt-1 tabular-nums w-5 shrink-0">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{q.prompt}</p>
                  {q.help && <p className="text-xs text-muted-foreground mt-0.5">{q.help}</p>}
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0 w-14 text-right">
                  {busy ? "saving…" : saved ? "saved" : ""}
                </span>
              </div>

              <div className="pl-7 space-y-2">
                {q.kind === "text" ? (
                  <Textarea
                    className="min-h-20"
                    placeholder={viewerMemberId ? "Your answer…" : "Read-only"}
                    value={text[q.id] ?? ""}
                    disabled={!viewerMemberId || closed}
                    onChange={(e) => onText(q.id, e.target.value)}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {(items[q.id] ?? []).length > 0 && (
                      <ul className="space-y-1">
                        {(items[q.id] ?? []).map((it, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm">
                            <span className="flex-1">{it}</span>
                            {viewerMemberId && !closed && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Remove"
                                onClick={() => removeItem(q.id, idx)}
                              >
                                <X className="size-3" />
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {viewerMemberId && !closed && (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add one…"
                          value={draftItem[q.id] ?? ""}
                          onChange={(e) => setDraftItem((p) => ({ ...p, [q.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addItem(q.id);
                            }
                          }}
                        />
                        <Button variant="outline" onClick={() => addItem(q.id)} disabled={!(draftItem[q.id] ?? "").trim()}>
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {others.length > 0 && (
                  <ul className="space-y-1.5 pt-1">
                    {others.map((a) => {
                      const who = byId.get(a.member_id);
                      const body = a.items.length > 0 ? a.items.join(" · ") : (a.answer ?? "").trim();
                      if (!body) return null;
                      return (
                        <li key={a.id} className="text-xs border-l-2 border-border pl-2">
                          <span className="font-medium">{who ? personName(who) : "Someone"}: </span>
                          <span className="text-muted-foreground">{body}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {viewerMemberId && !closed && (
        <div className="flex justify-end">
          <Button variant={submitted ? "outline" : "default"} onClick={() => void toggleSubmitted()}>
            <Check className={cn("size-4", submitted && "opacity-50")} />
            {submitted ? "Reopen my answers" : "I'm done"}
          </Button>
        </div>
      )}
    </div>
  );
}
