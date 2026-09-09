#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars -- CommonJS tooling, run with plain node */
/**
 * Local stand-in for the /intake/<token> route, for proving the driver when
 * cc.getcreait.com is unreachable.
 *
 * It serves the real Sheet markup and the real IntakeForm bundle, and
 * implements the server side with the repository's own sanitize/merge/submit
 * logic (lib/assessment-intake.ts), so "unknown" persistence, the __cleared
 * list, the required-answer gate and the single-use close all behave as
 * production does. The database and the token lookup are the only parts faked.
 *
 *   node server.js <port> <token>
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const HERE = __dirname;
const PORT = Number(process.argv[2] || 4310);
const TOKEN = process.argv[3];
if (!TOKEN) {
  console.error("usage: node server.js <port> <token>");
  process.exit(2);
}

const lib = require(path.join(HERE, "build", "intake-lib.cjs"));
const CSS = fs.readFileSync(path.join(HERE, "intake.css"), "utf8");
const BUNDLE = fs.readFileSync(path.join(HERE, "build", "bundle.js"), "utf8");

const state = { intake: {}, submittedAt: null, writes: 0 };

function page(body) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${CSS}</style></head><body style="margin:0">${body}</body></html>`;
}

function closedPage() {
  return page(`<div class="intake-root"><main class="ci-sheet">
<header class="ci-letterhead"><p class="ci-wordmark">CREAiT</p><p class="ci-mono">Growth &amp; AI Diagnostic</p></header>
<h1 class="ci-title">This link is closed</h1>
<p class="ci-p">Either your answers are already in, or your advisor has moved the engagement on.</p>
</main></div>`);
}

function formPage() {
  return page(
    `<div id="root"></div><script>
window.__TOKEN__=${JSON.stringify(TOKEN)};
window.__COMPANY__=${JSON.stringify("Harness Co (local)")};
window.__INTAKE__=${JSON.stringify(state.intake)};
</script><script>${BUNDLE}</script>`
  );
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === `/intake/${TOKEN}`) {
    const html = state.submittedAt ? closedPage() : formPage();
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(html);
  }
  if (req.method === "GET" && url.pathname.startsWith("/intake/")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(closedPage());
  }
  if (req.method === "GET" && url.pathname === "/api/dump") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(state, null, 2));
  }
  if (req.method === "POST" && url.pathname === "/api/save") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const send = (obj) => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return send({ ok: false, error: "bad json" });
      }
      if (body.token !== TOKEN || state.submittedAt)
        return send({ ok: false, error: "This link is closed.", closed: true });

      state.writes += 1;
      // Exactly the server action's merge, using the repository's own helpers.
      const incoming = lib.sanitizeIntakePatch(body.patch);
      const merged = { ...lib.parseIntake(state.intake) };
      for (const [id, value] of Object.entries(incoming)) {
        if (lib.isClearedAnswer(value)) delete merged[id];
        else merged[id] = value;
      }
      const cleared = Array.isArray(body.patch && body.patch.__cleared)
        ? body.patch.__cleared
        : [];
      for (const id of cleared) delete merged[id];

      if (body.submit) {
        const missing = lib.missingRequired(merged);
        if (missing.length > 0)
          return send({
            ok: false,
            error:
              "A few answers are still needed before you can send this: " +
              missing.join(" · "),
          });
      }
      state.intake = merged;
      if (body.submit) state.submittedAt = new Date().toISOString();
      // A little latency so the driver's "Saving…" → "Saved" wait is real.
      setTimeout(() => send({ ok: true, submitted: !!body.submit }), 120);
    });
    return;
  }
  res.writeHead(404).end("no");
});

server.listen(PORT, "127.0.0.1", () =>
  console.log(`harness on http://127.0.0.1:${PORT}/intake/${TOKEN}`)
);
