/**
 * Minimal Resend client over fetch. No SDK install required.
 * Gracefully no-ops if RESEND_API_KEY is not set so the rest of the system
 * keeps running. Maurice can drop a key in Vercel env at any time.
 */

interface SendArgs {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
  skipped?: boolean;
}

export async function sendEmail({ to, subject, html, from }: SendArgs): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, skipped: true, error: "RESEND_API_KEY not set (no-op)" };
  }
  const sender = from ?? process.env.RESEND_FROM_EMAIL ?? "CREAIT Command Center <noreply@getcreait.com>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown" };
  }
}

/**
 * Render markdown-ish text into safe-ish HTML for transactional email.
 * Not a full markdown parser — handles paragraphs, **bold**, and links.
 */
export function markdownToEmailHtml(md: string): string {
  const escaped = md.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:#3b82f6">$1</a>')
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 14px 0;line-height:1.55">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}
