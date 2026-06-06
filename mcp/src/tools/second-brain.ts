/**
 * Second Brain tools — markdown file storage under DATA_DIR.
 *
 * Tools:
 *   - search_context : keyword search across all *.md files
 *   - get_file       : read one file
 *   - update_file    : write or append to a file (creates parents)
 *   - list_topics    : list every file in the tree
 *
 * All paths are validated against DATA_DIR to prevent traversal.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "./data");

const SKIP_EXACT = new Set([".DS_Store"]);
const isDraft = (filename: string) => filename.endsWith(".draft.md");
const isMarkdown = (filename: string) => filename.endsWith(".md");

/** Resolve a user-supplied path under DATA_DIR and reject traversal. */
function safeResolve(rel: string): string {
  const cleaned = rel.replace(/^\/+/, ""); // strip leading slashes
  const resolved = path.resolve(DATA_DIR, cleaned);
  const dataDirWithSep = DATA_DIR.endsWith(path.sep) ? DATA_DIR : DATA_DIR + path.sep;
  if (resolved !== DATA_DIR && !resolved.startsWith(dataDirWithSep)) {
    throw new Error(`PATH_TRAVERSAL_BLOCKED: ${rel}`);
  }
  return resolved;
}

/** Recursively walk DATA_DIR and yield relative *.md paths (skipping drafts/.DS_Store). */
async function walkMarkdown(dir: string, rel = ""): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: string[] = [];
  for (const entry of entries) {
    if (SKIP_EXACT.has(entry.name)) continue;
    const childAbs = path.join(dir, entry.name);
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await walkMarkdown(childAbs, childRel)));
    } else if (entry.isFile() && isMarkdown(entry.name) && !isDraft(entry.name)) {
      out.push(childRel);
    }
  }
  return out;
}

/** Build a 200-char excerpt centered on the first match (or file head if no match). */
function makeExcerpt(content: string, tokens: string[]): string {
  const lower = content.toLowerCase();
  let firstIdx = -1;
  for (const t of tokens) {
    const idx = lower.indexOf(t);
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) firstIdx = idx;
  }
  if (firstIdx === -1) return content.slice(0, 200);
  const start = Math.max(0, firstIdx - 60);
  return content.slice(start, start + 200);
}

/** Count case-insensitive matches of all tokens in content. */
function scoreContent(content: string, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const lower = content.toLowerCase();
  let total = 0;
  for (const t of tokens) {
    if (!t) continue;
    let i = 0;
    while (true) {
      const idx = lower.indexOf(t, i);
      if (idx === -1) break;
      total += 1;
      i = idx + t.length;
    }
  }
  return total;
}

// ─── Tool: search_context ────────────────────────────────────────────────────

export const searchContextInput = {
  query: z.string().min(1).describe("Whitespace-separated keywords to search for."),
};

export async function searchContext({ query }: { query: string }) {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const files = await walkMarkdown(DATA_DIR);
  const scored: Array<{ file: string; excerpt: string; relevance_score: number }> = [];

  for (const rel of files) {
    let content: string;
    try {
      content = await fs.readFile(path.join(DATA_DIR, rel), "utf8");
    } catch {
      continue;
    }
    const score = scoreContent(content, tokens);
    if (score > 0) {
      scored.push({
        file: rel,
        excerpt: makeExcerpt(content, tokens),
        relevance_score: score,
      });
    }
  }

  scored.sort((a, b) => b.relevance_score - a.relevance_score);
  const results = scored.slice(0, 10);

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ query, results }, null, 2) }],
  };
}

// ─── Tool: get_file ──────────────────────────────────────────────────────────

export const getFileInput = {
  path: z.string().min(1).describe("Path relative to DATA_DIR, e.g. 'company/team-roster.md'."),
};

export async function getFile({ path: rel }: { path: string }) {
  const abs = safeResolve(rel);
  try {
    const [content, stat] = await Promise.all([fs.readFile(abs, "utf8"), fs.stat(abs)]);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { path: rel, content, last_modified: stat.mtime.toISOString() },
            null,
            2,
          ),
        },
      ],
    };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EISDIR") {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "NOT_FOUND", path: rel }),
          },
        ],
      };
    }
    throw err;
  }
}

// ─── Tool: update_file ───────────────────────────────────────────────────────

export const updateFileInput = {
  path: z.string().min(1).describe("Path relative to DATA_DIR."),
  content: z.string().describe("New content (or content to append when append=true)."),
  append: z
    .boolean()
    .optional()
    .default(false)
    .describe("When true, append to existing file separated by two newlines."),
};

export async function updateFile({
  path: rel,
  content,
  append,
}: {
  path: string;
  content: string;
  append?: boolean;
}) {
  const abs = safeResolve(rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });

  let finalContent = content;
  if (append) {
    try {
      const existing = await fs.readFile(abs, "utf8");
      const separator = existing.endsWith("\n") ? "\n" : "\n\n";
      finalContent = existing + separator + content;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      // file didn't exist — write content as-is
    }
  }

  await fs.writeFile(abs, finalContent, "utf8");
  const bytes = Buffer.byteLength(finalContent, "utf8");

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          { success: true, path: rel, bytes_written: bytes },
          null,
          2,
        ),
      },
    ],
  };
}

// ─── Tool: list_topics ───────────────────────────────────────────────────────

export const listTopicsInput = {};

export async function listTopics() {
  const files = (await walkMarkdown(DATA_DIR)).sort((a, b) => a.localeCompare(b));
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ files, total_count: files.length }, null, 2),
      },
    ],
  };
}
