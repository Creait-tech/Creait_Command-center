#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars -- CommonJS tooling, run with plain node */
/**
 * CREAiT owner-intake Playwright driver.
 *
 *   node intake-driver.js <token> <persona.json>          fill + submit + verify close
 *   node intake-driver.js <token> <persona.json> --dry     fill, never submit
 *   node intake-driver.js <token> --check                  DOM-vs-schema audit only
 *
 * It drives https://cc.getcreait.com/intake/<token> exactly as an owner would:
 * real clicks, real typing, real autosave (the server action behind
 * lib/intake-actions.ts), real submit. Nothing is posted directly.
 *
 * How fields are identified
 * ------------------------
 * Every question renders as `<li id="q-<questionId>" class="ci-q">`
 * (components/intake/intake-form.tsx, QuestionField). That id is the anchor for
 * everything: the driver scopes a locator to `li#q-q17` and then picks the
 * control by the class the form gives it — `.ci-textarea`, `.ci-input-num`,
 * `.ci-input`, `[role=radiogroup] label.ci-option`, `[role=group]
 * label.ci-option`, `.ci-grid .ci-grid-row`. Options and fixed table rows are
 * matched on their *exact* visible text (an option string is often a prefix of
 * another, so substring matching is never used). Table columns are matched
 * positionally inside `.ci-grid-cells`, which the form renders one element per
 * `columns[]` entry in schema order, and cross-checked against the cell's
 * aria-label. "Not currently known" is `button.ci-unknown` with aria-pressed.
 *
 * Schema: sim/intake-schema.json, dumped straight out of
 * web/lib/assessment-intake.ts by sim/dump-intake-schema.ts. Regenerate with:
 *   cd /home/claude/creait_command-center/web && \
 *     ./node_modules/.bin/tsx <thisDir>/dump-intake-schema.ts
 *
 * Environment: playwright is required out of the scratchpad tools install,
 * Chromium out of PLAYWRIGHT_BROWSERS_PATH, and all traffic to cc.getcreait.com
 * goes through the agent proxy ($HTTPS_PROXY) with ignoreHTTPSErrors, because
 * the proxy terminates TLS with its own CA.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const TOOLS = "/tmp/claude-0/-home-claude/a34cff6d-e28e-53c1-9842-582c5f5ece56/scratchpad/tools/node_modules";
const { chromium } = require(path.join(TOOLS, "playwright"));

const HERE = __dirname;
const SCHEMA = JSON.parse(
  fs.readFileSync(path.join(HERE, "intake-schema.json"), "utf8")
);
const Q_BY_ID = Object.fromEntries(SCHEMA.questions.map((q) => [q.id, q]));
const ROW_KEY = SCHEMA.tableRowKey; // "row"
const UNKNOWN = SCHEMA.unknown; // "unknown"

const BASE = process.env.INTAKE_BASE || "https://cc.getcreait.com";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** intake-form.tsx AUTOSAVE_MS is 800; give the debounce room to fire. */
const DEBOUNCE_GRACE_MS = 1000;
const SAVE_TIMEOUT_MS = 25_000;
/** lib/intake-server.ts allows 60 writes/token/minute. Stay well under. */
const MAX_WRITES_PER_MIN = 45;

// ─────────────────────────────────────────────────────────────────────────────
// small helpers
// ─────────────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function log(...args) {
  process.stdout.write(args.join(" ") + "\n");
}

/** Exact-text index inside a list of strings, with a whitespace-tolerant retry. */
function exactIndex(list, wanted) {
  const norm = (s) => String(s).replace(/\s+/g, " ").trim();
  const w = norm(wanted);
  let i = list.findIndex((t) => norm(t) === w);
  if (i !== -1) return i;
  // NBSP / en-dash normalisation, then a last-resort case-insensitive pass.
  const loose = (s) => norm(s).replace(/ /g, " ").toLowerCase();
  i = list.findIndex((t) => loose(t) === loose(wanted));
  return i;
}

// ─────────────────────────────────────────────────────────────────────────────
// run state
// ─────────────────────────────────────────────────────────────────────────────

class Run {
  constructor(token, label) {
    this.token = token;
    this.label = label;
    this.startedAt = Date.now();
    this.filled = [];
    this.skipped = [];
    this.unknownSelected = [];
    this.errors = [];
    this.consoleErrors = [];
    this.submitted = false;
    this.closedAfter = false;
    this.writeTimes = [];
    this.shots = [];
  }
  err(where, message) {
    const line = `${where}: ${message}`;
    this.errors.push(line);
    log("  ! " + line);
  }
  /** Keep under the server's per-token write budget. */
  async pace() {
    const cutoff = Date.now() - 60_000;
    this.writeTimes = this.writeTimes.filter((t) => t > cutoff);
    if (this.writeTimes.length >= MAX_WRITES_PER_MIN) {
      const waitMs = this.writeTimes[0] + 60_000 - Date.now() + 500;
      if (waitMs > 0) {
        log(`  · pacing ${Math.round(waitMs / 1000)}s (write budget)`);
        await sleep(waitMs);
      }
    }
    this.writeTimes.push(Date.now());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// browser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The playwright in tools/ is 1.49.1 and expects chromium build 1148; the image
 * ships 1194 under PLAYWRIGHT_BROWSERS_PATH. Point at whatever chrome is
 * actually on disk rather than re-downloading (playwright install is offline).
 */
function chromiumPath() {
  if (process.env.INTAKE_CHROME) return process.env.INTAKE_CHROME;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  let best = null;
  for (const dir of fs.existsSync(root) ? fs.readdirSync(root) : []) {
    const m = /^chromium-(\d+)$/.exec(dir);
    if (!m) continue;
    const exe = path.join(root, dir, "chrome-linux", "chrome");
    if (fs.existsSync(exe) && (!best || Number(m[1]) > best.build))
      best = { build: Number(m[1]), exe };
  }
  return best ? best.exe : undefined;
}

async function openBrowser() {
  const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy;
  const launch = {
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
    executablePath: chromiumPath(),
  };
  // cc.getcreait.com is only reachable through the agent proxy; Chromium does
  // not read HTTPS_PROXY on its own, so it has to be handed over explicitly.
  // A loopback INTAKE_BASE (the local harness) must not go through the agent
  // proxy at all — it only accepts CONNECT tunnels and answers plain HTTP 405.
  const loopback = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])/.test(BASE);
  if (proxyServer && !loopback)
    launch.proxy = { server: proxyServer, bypass: "127.0.0.1,localhost" };
  const browser = await chromium.launch(launch);
  const context = await browser.newContext({
    // The proxy re-signs TLS with its own CA, which Chromium does not trust.
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 1400 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });
  return { browser, context };
}

async function openIntake(context, token, run) {
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") run.consoleErrors.push(m.text().slice(0, 500));
  });
  page.on("pageerror", (e) =>
    run.consoleErrors.push("pageerror: " + String(e.message).slice(0, 500))
  );
  const url = `${BASE}/intake/${token}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("h1.ci-title, h2.ci-h2", { timeout: 60_000 });
  return page;
}

/** The form is server-rendered, so wait for React to actually take it over. */
async function waitForHydration(page) {
  await page.waitForSelector("li.ci-q", { timeout: 30_000 });
  await page.waitForSelector("button.ci-submit", { timeout: 30_000 });
  try {
    await page.waitForLoadState("networkidle", { timeout: 20_000 });
  } catch {
    /* force-dynamic pages sometimes never go fully idle; not fatal. */
  }
  await sleep(800);
}

// ─────────────────────────────────────────────────────────────────────────────
// autosave
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wait for the header indicator to settle. `.ci-save` carries the state class
 * the form sets: ci-save-saving / ci-save-saved / ci-save-error (idle has none
 * and reads "Saves as you type").
 */
async function saveState(page) {
  return page.evaluate(() => {
    const el = document.querySelector("span.ci-save");
    if (!el) return { state: "missing", text: "" };
    for (const s of ["saving", "saved", "error", "closed"]) {
      if (el.classList.contains("ci-save-" + s))
        return { state: s, text: el.textContent || "" };
    }
    return { state: "idle", text: el.textContent || "" };
  });
}

async function settle(page, run, where) {
  await run.pace();
  await sleep(DEBOUNCE_GRACE_MS);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await page.waitForFunction(
        () => {
          const el = document.querySelector("span.ci-save");
          if (!el) return true; // form replaced (submitted / closed)
          return (
            el.classList.contains("ci-save-saved") ||
            el.classList.contains("ci-save-error")
          );
        },
        null,
        { timeout: SAVE_TIMEOUT_MS }
      );
    } catch {
      run.err(where, "autosave never settled within " + SAVE_TIMEOUT_MS + "ms");
      return false;
    }
    const st = await saveState(page);
    if (st.state !== "error") return true;

    const alert = await page
      .locator("p.ci-alert")
      .first()
      .textContent()
      .catch(() => "");
    const text = (alert || "").trim();
    if (/give it a moment/i.test(text)) {
      log("  · rate limited by the server; backing off 30s");
      await sleep(30_000);
    } else {
      run.err(where, "autosave reported an error: " + text.slice(0, 200));
      await sleep(2000);
    }
    const retry = page.locator("button.ci-linkbtn", { hasText: "Try again" });
    if (await retry.count()) await retry.first().click();
    else return false;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// filling one question
// ─────────────────────────────────────────────────────────────────────────────

function qRoot(page, id) {
  return page.locator(`li#q-${id}`);
}

async function markUnknown(page, q, run) {
  const root = qRoot(page, q.id);
  const btn = root.locator("button.ci-unknown");
  if (!(await btn.count())) {
    run.err(q.id, `"${SCHEMA.unknownLabel}" is not offered on this question ` +
      `(schema allowUnknown=${q.allowUnknown}) — selector li#q-${q.id} button.ci-unknown`);
    return false;
  }
  const pressed = await btn.first().getAttribute("aria-pressed");
  if (pressed !== "true") await btn.first().click();
  return true;
}

async function fillScalar(page, q, value, run) {
  const root = qRoot(page, q.id);
  const sel =
    q.type === "long" || q.type === "upload_note"
      ? "textarea.ci-textarea"
      : "input.ci-input";
  const el = root.locator(sel).first();
  if (!(await el.count())) {
    run.err(q.id, `no control matched li#q-${q.id} ${sel}`);
    return false;
  }
  await el.scrollIntoViewIfNeeded();
  await el.fill(String(value));
  return true;
}

async function fillSingle(page, q, value, run) {
  const root = qRoot(page, q.id);
  const labels = root.locator("div.ci-options label.ci-option");
  const texts = await labels.locator("span").allTextContents();
  const idx = exactIndex(texts, value);
  if (idx === -1) {
    run.err(
      q.id,
      `option ${JSON.stringify(value)} not in the DOM. Rendered: ` +
        JSON.stringify(texts)
    );
    return false;
  }
  const input = labels.nth(idx).locator("input[type=radio]");
  await input.scrollIntoViewIfNeeded();
  await input.check();
  return true;
}

async function fillMulti(page, q, values, run) {
  const root = qRoot(page, q.id);
  const labels = root.locator("div.ci-options label.ci-option");
  const texts = await labels.locator("span").allTextContents();
  let ok = true;
  const wantIdx = new Set();
  for (const v of values) {
    const idx = exactIndex(texts, v);
    if (idx === -1) {
      run.err(
        q.id,
        `option ${JSON.stringify(v)} not in the DOM. Rendered: ` +
          JSON.stringify(texts)
      );
      ok = false;
      continue;
    }
    wantIdx.add(idx);
  }
  for (let i = 0; i < texts.length; i += 1) {
    const box = labels.nth(i).locator("input[type=checkbox]");
    const on = await box.isChecked();
    if (wantIdx.has(i) && !on) {
      await box.scrollIntoViewIfNeeded();
      await box.check();
    } else if (!wantIdx.has(i) && on) {
      await box.uncheck();
    }
  }
  return ok;
}

/** One cell: an <input> or a <select>, positioned by column order. */
async function setCell(rowLocator, colIndex, column, value, q, run, where) {
  const cells = rowLocator.locator(".ci-grid-cells input, .ci-grid-cells select");
  const count = await cells.count();
  if (colIndex >= count) {
    run.err(
      q.id,
      `${where}: column #${colIndex} (${column.key}) has no control — only ` +
        `${count} cells rendered`
    );
    return false;
  }
  const cell = cells.nth(colIndex);
  await cell.scrollIntoViewIfNeeded();
  const tag = await cell.evaluate((n) => n.tagName.toLowerCase());
  if (column.type === "single") {
    if (tag !== "select") {
      run.err(q.id, `${where}: column ${column.key} should be a <select>, got <${tag}>`);
      return false;
    }
    try {
      await cell.selectOption({ label: String(value) });
    } catch (e) {
      const opts = await cell.locator("option").allTextContents();
      run.err(
        q.id,
        `${where}: option ${JSON.stringify(value)} not selectable for column ` +
          `${column.key}. Rendered: ${JSON.stringify(opts)}`
      );
      return false;
    }
    return true;
  }
  if (tag !== "input") {
    run.err(q.id, `${where}: column ${column.key} should be an <input>, got <${tag}>`);
    return false;
  }
  await cell.fill(String(value));
  return true;
}

/**
 * Fixed-row tables are addressed by row LABEL, both in the DOM and in storage
 * (intake-form.tsx fixedCell/setFixedCell look the row up by
 * `r[TABLE_ROW_KEY] === label`). A schema whose `rows` repeats a label
 * therefore has only one addressable slot for all of its copies — see the
 * q3 note in the run report. Answering the same label twice would silently
 * overwrite the earlier answer, so the driver refuses to and says so.
 */
function duplicateLabels(q) {
  const seen = new Set();
  const dupes = new Set();
  for (const r of q.rows || []) {
    if (seen.has(r)) dupes.add(r);
    seen.add(r);
  }
  return dupes;
}

async function fillFixedTable(page, q, rows, run) {
  const root = qRoot(page, q.id);
  const gridRows = root.locator(".ci-grid > .ci-grid-row");
  const labels = await gridRows.locator("span.ci-grid-label").allTextContents();
  const columns = q.columns || [];
  const dupes = duplicateLabels(q);
  const claimed = new Map();
  let ok = true;

  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r] || {};
    const wantedLabel = row[ROW_KEY] !== undefined ? row[ROW_KEY] : (q.rows || [])[r];
    if (dupes.has(wantedLabel)) {
      const used = (claimed.get(wantedLabel) || 0) + 1;
      claimed.set(wantedLabel, used);
      if (used > 1) {
        run.err(
          q.id,
          `row label ${JSON.stringify(wantedLabel)} appears ${
            (q.rows || []).filter((x) => x === wantedLabel).length
          }× in the schema but is a single storage slot — persona row ${r + 1} ` +
            `(${JSON.stringify(row)}) cannot be recorded and was skipped. ` +
            `Selector: li#q-${q.id} .ci-grid-row (FORM BUG, see report)`
        );
        ok = false;
        continue;
      }
    }
    let idx = wantedLabel === undefined ? r : exactIndex(labels, wantedLabel);
    if (idx === -1) {
      run.err(
        q.id,
        `row ${JSON.stringify(wantedLabel)} not in the DOM. Rendered rows: ` +
          JSON.stringify(labels)
      );
      ok = false;
      continue;
    }
    const rowEl = gridRows.nth(idx);
    for (let c = 0; c < columns.length; c += 1) {
      const col = columns[c];
      const value = row[col.key];
      if (value === undefined || value === null || String(value) === "") continue;
      const done = await setCell(rowEl, c, col, value, q, run, `row "${labels[idx]}"`);
      if (!done) ok = false;
    }
  }
  return ok;
}

async function fillFreeTable(page, q, rows, run) {
  const root = qRoot(page, q.id);
  const columns = q.columns || [];
  const max = q.maxRows || 10;
  let ok = true;
  let written = 0;

  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r] || {};
    const has = columns.some(
      (c) => row[c.key] !== undefined && String(row[c.key]).trim() !== ""
    );
    if (!has) continue;
    if (written >= max) {
      run.err(q.id, `persona has more rows than maxRows=${max}; row ${r + 1} dropped`);
      ok = false;
      break;
    }
    // The form always offers exactly one spare blank row, so row N appears only
    // once row N-1 holds something. Wait for it rather than assuming.
    const target = written;
    try {
      await page.waitForFunction(
        ({ id, n }) => {
          const el = document.querySelector(`li#q-${id}`);
          if (!el) return false;
          return el.querySelectorAll(".ci-grid-row-free").length > n;
        },
        { id: q.id, n: target },
        { timeout: 10_000 }
      );
    } catch {
      run.err(
        q.id,
        `row ${target + 1} never appeared — the form only rendered ` +
          `${await root.locator(".ci-grid-row-free").count()} rows ` +
          `(selector li#q-${q.id} .ci-grid-row-free)`
      );
      return false;
    }
    const rowEl = root.locator(".ci-grid-row-free").nth(target);
    for (let c = 0; c < columns.length; c += 1) {
      const col = columns[c];
      const value = row[col.key];
      if (value === undefined || value === null || String(value) === "") continue;
      const done = await setCell(rowEl, c, col, value, q, run, `row ${target + 1}`);
      if (!done) ok = false;
    }
    written += 1;
  }
  return ok;
}

async function fillQuestion(page, q, value, run) {
  if (typeof value === "string" && value.trim().toLowerCase() === UNKNOWN) {
    const ok = await markUnknown(page, q, run);
    if (ok) run.unknownSelected.push(q.id);
    return ok;
  }
  switch (q.type) {
    case "single":
      if (typeof value !== "string") {
        run.err(q.id, "single expects a string, got " + typeof value);
        return false;
      }
      return fillSingle(page, q, value, run);
    case "multi":
      if (!Array.isArray(value)) {
        run.err(q.id, "multi expects an array, got " + typeof value);
        return false;
      }
      return fillMulti(page, q, value, run);
    case "table":
      if (!Array.isArray(value)) {
        run.err(q.id, "table expects an array of row objects, got " + typeof value);
        return false;
      }
      return q.rows
        ? fillFixedTable(page, q, value, run)
        : fillFreeTable(page, q, value, run);
    default:
      return fillScalar(page, q, value, run);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// read-back verification — catches anything the form silently refused to keep
// ─────────────────────────────────────────────────────────────────────────────

async function verifyQuestion(page, q, value, run) {
  const root = qRoot(page, q.id);
  if (typeof value === "string" && value.trim().toLowerCase() === UNKNOWN) {
    const pressed = await root
      .locator("button.ci-unknown")
      .first()
      .getAttribute("aria-pressed")
      .catch(() => null);
    const shown = await root.locator("p.ci-unknown-state").count();
    if (pressed !== "true" || shown === 0) {
      run.err(
        q.id,
        `"Not currently known" did not persist — aria-pressed=${pressed}, ` +
          `.ci-unknown-state count=${shown} (li#q-${q.id} button.ci-unknown)`
      );
    }
    return;
  }
  try {
    if (q.type === "single") {
      const labels = root.locator("div.ci-options label.ci-option");
      const texts = await labels.locator("span").allTextContents();
      const idx = exactIndex(texts, value);
      if (idx >= 0 && !(await labels.nth(idx).locator("input").isChecked())) {
        run.err(q.id, `radio ${JSON.stringify(value)} is not checked after filling`);
      }
    } else if (q.type === "multi") {
      const labels = root.locator("div.ci-options label.ci-option");
      const texts = await labels.locator("span").allTextContents();
      for (const v of value) {
        const idx = exactIndex(texts, v);
        if (idx >= 0 && !(await labels.nth(idx).locator("input").isChecked())) {
          run.err(q.id, `checkbox ${JSON.stringify(v)} is not checked after filling`);
        }
      }
    } else if (q.type === "table") {
      const rowSel = q.rows ? ".ci-grid > .ci-grid-row" : ".ci-grid-row-free";
      const gridRows = root.locator(rowSel);
      const labels = q.rows
        ? await gridRows.locator("span.ci-grid-label").allTextContents()
        : [];
      let free = 0;
      const dupes = q.rows ? duplicateLabels(q) : new Set();
      const claimed = new Map();
      for (let r = 0; r < value.length; r += 1) {
        const row = value[r] || {};
        const cols = q.columns || [];
        const has = cols.some(
          (c) => row[c.key] !== undefined && String(row[c.key]).trim() !== ""
        );
        if (!has) continue;
        if (q.rows) {
          const lbl = row[ROW_KEY] !== undefined ? row[ROW_KEY] : q.rows[r];
          if (dupes.has(lbl)) {
            const used = (claimed.get(lbl) || 0) + 1;
            claimed.set(lbl, used);
            if (used > 1) continue; // already reported once, at fill time
          }
        }
        const idx = q.rows
          ? row[ROW_KEY] !== undefined
            ? exactIndex(labels, row[ROW_KEY])
            : r
          : free++;
        if (idx < 0) continue;
        const cells = gridRows
          .nth(idx)
          .locator(".ci-grid-cells input, .ci-grid-cells select");
        for (let c = 0; c < cols.length; c += 1) {
          const want = row[cols[c].key];
          if (want === undefined || String(want).trim() === "") continue;
          const got = await cells.nth(c).inputValue();
          if (String(got).trim() !== String(want).trim()) {
            run.err(
              q.id,
              `cell [row ${idx + 1} / ${cols[c].key}] holds ${JSON.stringify(got)} ` +
                `after typing ${JSON.stringify(String(want))}`
            );
          }
        }
      }
    } else {
      const sel =
        q.type === "long" || q.type === "upload_note"
          ? "textarea.ci-textarea"
          : "input.ci-input";
      const got = await root.locator(sel).first().inputValue();
      if (String(got).trim() !== String(value).trim()) {
        run.err(
          q.id,
          `${sel} holds ${JSON.stringify(got.slice(0, 60))} after typing ` +
            `${JSON.stringify(String(value).slice(0, 60))}`
        );
      }
    }
  } catch (e) {
    run.err(q.id, "verification threw: " + String(e.message).slice(0, 200));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// --check
// ─────────────────────────────────────────────────────────────────────────────

async function readDom(page) {
  return page.evaluate(() => {
    const out = [];
    for (const li of document.querySelectorAll("li.ci-q")) {
      const id = (li.id || "").replace(/^q-/, "");
      const prompt =
        li.querySelector(".ci-q-prompt")?.textContent?.replace(/\s*\*$/, "").trim() || "";
      let kind = "unknown";
      if (li.querySelector("p.ci-unknown-state")) kind = "unknown-selected";
      else if (li.querySelector("textarea.ci-textarea")) kind = "textarea";
      else if (li.querySelector(".ci-grid-free")) kind = "table-free";
      else if (li.querySelector(".ci-grid")) kind = "table-fixed";
      else if (li.querySelector("[role=radiogroup]")) kind = "single";
      else if (li.querySelector("[role=group]")) kind = "multi";
      else if (li.querySelector("input.ci-input-num")) kind = "numeric";
      else if (li.querySelector("input.ci-input")) kind = "short";
      out.push({
        id,
        prompt,
        kind,
        required: !!li.querySelector(".ci-req"),
        allowUnknown: !!li.querySelector("button.ci-unknown"),
        options: [...li.querySelectorAll(".ci-options label.ci-option span")].map((s) =>
          s.textContent.trim()
        ),
        rowLabels: [...li.querySelectorAll("span.ci-grid-label")].map((s) =>
          s.textContent.trim()
        ),
        colLabels: [...li.querySelectorAll(".ci-grid-head .ci-grid-h")].map((s) =>
          s.textContent.trim()
        ),
        cellAriaLabels: [...li.querySelectorAll(".ci-grid-cells input, .ci-grid-cells select")]
          .slice(0, 8)
          .map((n) => n.getAttribute("aria-label")),
      });
    }
    const sections = [...document.querySelectorAll("section.ci-section")].map((s) => ({
      id: (s.id || "").replace(/^section-/, ""),
      title: s.querySelector(".ci-h2")?.textContent?.trim() || "",
      skipped: !!s.querySelector(".ci-skip"),
      questions: s.querySelectorAll("li.ci-q").length,
    }));
    return { questions: out, sections };
  });
}

const DOM_KIND_FOR = {
  short: ["short"],
  long: ["textarea"],
  upload_note: ["textarea"],
  number: ["numeric"],
  currency: ["numeric"],
  percent: ["numeric"],
  single: ["single"],
  multi: ["multi"],
};

async function checkMode(token, run) {
  const { browser, context } = await openBrowser();
  try {
    const page = await openIntake(context, token, run);
    const title = (await page.locator("h1.ci-title").first().textContent()) || "";
    log(`page title: ${title.trim()}`);
    if (title.trim() !== SCHEMA.title) {
      run.err("open", `form did not load — title was ${JSON.stringify(title.trim())}`);
      return;
    }
    await waitForHydration(page);
    const dom = await readDom(page);
    const domIds = dom.questions.map((q) => q.id);
    const eShown = !dom.sections.find((s) => s.id === "e")?.skipped;

    log("\nsections:");
    for (const s of dom.sections)
      log(`  ${s.id.padEnd(3)} ${String(s.questions).padStart(2)} q  ${s.skipped ? "[skipped]" : ""}  ${s.title}`);

    const expected = SCHEMA.questions.filter((q) => q.section !== "e" || eShown);
    const missing = expected.map((q) => q.id).filter((id) => !domIds.includes(id));
    const extra = domIds.filter((id) => !Q_BY_ID[id]);
    log(`\nschema ids: ${SCHEMA.questions.length}  dom ids: ${domIds.length}  ` +
      `module E ${eShown ? "shown" : "hidden (q3 has no transition objective)"}`);
    if (missing.length) run.err("check", "in schema but not in DOM: " + missing.join(", "));
    if (extra.length) run.err("check", "in DOM but not in schema: " + extra.join(", "));

    log("\nper question (id · schema type → dom kind · notes):");
    for (const d of dom.questions) {
      const q = Q_BY_ID[d.id];
      if (!q) continue;
      const notes = [];
      const want =
        q.type === "table"
          ? q.rows
            ? ["table-fixed"]
            : ["table-free"]
          : DOM_KIND_FOR[q.type] || [];
      if (d.kind !== "unknown-selected" && want.length && !want.includes(d.kind))
        notes.push(`TYPE MISMATCH expected ${want.join("/")}`);
      if (d.prompt !== q.prompt) notes.push(`PROMPT differs: dom=${JSON.stringify(d.prompt)}`);
      if (d.allowUnknown !== !!q.allowUnknown)
        notes.push(`allowUnknown dom=${d.allowUnknown} schema=${!!q.allowUnknown}`);
      if (d.required !== !!q.required)
        notes.push(`required dom=${d.required} schema=${!!q.required}`);
      if (q.options) {
        const miss = q.options.filter((o) => exactIndex(d.options, o) === -1);
        if (miss.length) notes.push("OPTIONS missing: " + JSON.stringify(miss));
      }
      if (q.rows) {
        const miss = q.rows.filter((r) => exactIndex(d.rowLabels, r) === -1);
        if (miss.length) notes.push("ROWS missing: " + JSON.stringify(miss));
        const dupes = [...duplicateLabels(q)];
        if (dupes.length)
          notes.push(
            "DUPLICATE ROW LABEL " +
              JSON.stringify(dupes) +
              " — one storage slot per label, so only the first can hold an answer (FORM BUG)"
          );
      }
      if (q.type === "table" && !q.rows) {
        const want2 = (q.columns || []).map((c) => c.label);
        if (JSON.stringify(want2) !== JSON.stringify(d.colLabels))
          notes.push(`COLUMN headers dom=${JSON.stringify(d.colLabels)} schema=${JSON.stringify(want2)}`);
      }
      for (const n of notes) run.errors.push(`${d.id}: ${n}`);
      log(
        `  ${d.id.padEnd(4)} ${String(q.type).padEnd(11)} → ${d.kind.padEnd(11)} ` +
          (notes.length ? "  " + notes.join(" | ") : "ok")
      );
    }

    const outDir = ensureDir(path.join(HERE, "results"));
    const file = path.join(outDir, `check-${token.slice(0, 8)}.json`);
    fs.writeFileSync(file, JSON.stringify({ token, dom, mismatches: run.errors }, null, 2));
    log("\nwrote " + file);
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// full run
// ─────────────────────────────────────────────────────────────────────────────

async function fillMode(token, persona, dry, run) {
  const shots = ensureDir(path.join(HERE, "shots"));
  const n = run.label;
  const { browser, context } = await openBrowser();
  try {
    const page = await openIntake(context, token, run);

    // 1. assert the form actually loaded
    const title = ((await page.locator("h1.ci-title").first().textContent()) || "").trim();
    await page.screenshot({ path: path.join(shots, `${n}-open.png`), fullPage: true });
    run.shots.push(`${n}-open.png`);
    log(`opened ${BASE}/intake/${token} — "${title}"`);
    if (title !== SCHEMA.title) {
      run.err("open", `expected title ${JSON.stringify(SCHEMA.title)}, got ${JSON.stringify(title)}`);
      return;
    }
    await waitForHydration(page);

    // 2. walk every section in schema order (q3 first, so module E can appear)
    const intake = persona.intake || {};
    for (const q of SCHEMA.questions) {
      const value = intake[q.id];
      if (value === undefined || value === null || value === "") {
        run.skipped.push(q.id);
        continue;
      }
      if (!(await qRoot(page, q.id).count())) {
        if (q.section === "e") {
          run.skipped.push(q.id);
          run.err(q.id, "module E is not shown — q3 named no transition objective, but the persona answers it");
        } else {
          run.err(q.id, `li#q-${q.id} is not in the DOM`);
        }
        continue;
      }
      let ok = await fillQuestion(page, q, value, run);
      let saved = await settle(page, run, q.id);
      if (!saved && ok) {
        // one retry: a lost first keystroke (late hydration) looks exactly like this
        ok = await fillQuestion(page, q, value, run);
        saved = await settle(page, run, q.id + " (retry)");
      }
      if (ok) run.filled.push(q.id);
      const st = await saveState(page);
      if (st.state === "closed") {
        run.err(q.id, "the server closed the link mid-fill");
        return;
      }
      log(`  ${q.id.padEnd(4)} ${q.type.padEnd(11)} ${ok ? "filled" : "FAILED"}  (save: ${st.state})`);
    }

    // 3. read every answer back out of the DOM
    log("verifying read-back…");
    for (const q of SCHEMA.questions) {
      const value = intake[q.id];
      if (value === undefined || value === null || value === "") continue;
      if (!(await qRoot(page, q.id).count())) continue;
      await verifyQuestion(page, q, value, run);
    }

    if (dry) {
      await page.screenshot({ path: path.join(shots, `${n}-dry.png`), fullPage: true });
      run.shots.push(`${n}-dry.png`);
      log("--dry: not submitting.");
      return;
    }

    // 4. submit
    await run.pace();
    const submit = page.locator("button.ci-submit");
    await submit.scrollIntoViewIfNeeded();
    await submit.click();
    try {
      await page.waitForFunction(
        () => {
          const done = document.querySelector("section.ci-done h2.ci-h2");
          if (done) return true;
          return !!document.querySelector("p.ci-alert");
        },
        null,
        { timeout: 60_000 }
      );
    } catch {
      run.err("submit", "neither the completion page nor an error appeared within 60s");
    }
    const doneHeading = await page
      .locator("section.ci-done h2.ci-h2")
      .first()
      .textContent()
      .catch(() => null);
    if (doneHeading && doneHeading.trim() === "Your responses are in") {
      const body = (await page.locator("section.ci-done p.ci-p").first().textContent()) || "";
      if (body.trim() !== SCHEMA.completion.trim())
        run.err("submit", "completion copy did not match INTAKE_COMPLETION");
      run.submitted = true;
    } else {
      const alert = await page.locator("p.ci-alert").first().textContent().catch(() => "");
      run.err("submit", "did not reach the completion page. Alert: " + String(alert).trim().slice(0, 300));
    }
    await page.screenshot({ path: path.join(shots, `${n}-done.png`), fullPage: true });
    run.shots.push(`${n}-done.png`);

    // 5. the token is single-use — reload and expect the closed page
    await page.goto(`${BASE}/intake/${token}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector("h1.ci-title", { timeout: 60_000 });
    const after = ((await page.locator("h1.ci-title").first().textContent()) || "").trim();
    run.closedAfter = after === "This link is closed";
    if (!run.closedAfter)
      run.err("reload", `expected "This link is closed" after submit, got ${JSON.stringify(after)}`);
    await page.screenshot({ path: path.join(shots, `${n}-closed.png`), fullPage: true });
    run.shots.push(`${n}-closed.png`);
    log(`reload after submit: "${after}"`);
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes("--dry");
  const check = argv.includes("--check");
  const positional = argv.filter((a) => !a.startsWith("--"));
  const token = positional[0];
  const personaPath = positional[1];

  if (!token || (!check && !personaPath)) {
    log("usage: node intake-driver.js <token> <persona.json> [--dry]");
    log("       node intake-driver.js <token> --check");
    process.exit(2);
  }
  if (!UUID_RE.test(token)) {
    log(`token ${JSON.stringify(token)} is not a UUID — the route only accepts UUIDs ` +
      "(lib/intake-server.ts isIntakeToken).");
    process.exit(2);
  }

  let persona = null;
  if (personaPath) persona = JSON.parse(fs.readFileSync(personaPath, "utf8"));
  const label = check
    ? token.slice(0, 8)
    : String(persona?.n ?? path.basename(personaPath, ".json"));
  const run = new Run(token, label);

  try {
    if (check) await checkMode(token, run);
    else await fillMode(token, persona, dry, run);
  } catch (e) {
    run.err("fatal", String(e && e.stack ? e.stack.split("\n")[0] : e));
  }

  const result = {
    token,
    persona: personaPath ? path.basename(personaPath) : null,
    mode: check ? "check" : dry ? "dry" : "submit",
    filled: run.filled,
    skipped: run.skipped,
    unknownSelected: run.unknownSelected,
    counts: {
      filled: run.filled.length,
      skipped: run.skipped.length,
      unknownSelected: run.unknownSelected.length,
    },
    errors: run.errors,
    consoleErrors: run.consoleErrors,
    durationMs: Date.now() - run.startedAt,
    submitted: run.submitted,
    closedAfter: run.closedAfter,
    screenshots: run.shots,
  };
  if (!check) {
    const dir = ensureDir(path.join(HERE, "results"));
    const file = path.join(dir, `intake-${label}.json`);
    fs.writeFileSync(file, JSON.stringify(result, null, 2));
    log("wrote " + file);
  }
  log(
    `\nfilled ${result.counts.filled} · skipped ${result.counts.skipped} · ` +
      `unknown ${result.counts.unknownSelected} · errors ${run.errors.length} · ` +
      `consoleErrors ${run.consoleErrors.length} · submitted ${run.submitted} · ` +
      `closedAfter ${run.closedAfter} · ${Math.round(result.durationMs / 1000)}s`
  );
  const failed =
    run.errors.length > 0 ||
    (!check && !dry && (!run.submitted || !run.closedAfter));
  process.exit(failed ? 1 : 0);
}

main();
