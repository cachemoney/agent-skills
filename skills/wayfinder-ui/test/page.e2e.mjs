// End-to-end check of wayfinder-ui page.html against a real `serve`. Needs Playwright with Chromium:
//   PLAYWRIGHT_PKG=/path/to/node_modules/@playwright/test/index.mjs node test/page.e2e.mjs
// or, with @playwright/test installed next to this repo, just `node test/page.e2e.mjs`.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

let chromium;
try {
  const pw = await import(process.env.PLAYWRIGHT_PKG || "@playwright/test");
  chromium = pw.chromium;
} catch (e) {
  console.log("Playwright not installed; skipping browser E2E tests. To run: npm install -D @playwright/test");
  process.exit(0);
}

const here = dirname(fileURLToPath(import.meta.url));
const serverCandidates = [
  join(here, "..", "scripts", "server.mjs"),
  join(here, "..", "server.mjs"),
];
const SERVER = serverCandidates.find((s) => existsSync(s)) || join(here, "..", "scripts", "server.mjs");
const home = mkdtempSync(join(tmpdir(), "wf-e2e-home-"));
const env = { ...process.env, WAYFINDER_HOME: home };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { session } = JSON.parse(
  execFileSync(
    process.execPath,
    [SERVER, "new", "--destination", "E2E Distributed Storage", "--doc", "docs/e2e-roadmap.md"],
    { encoding: "utf8", env, cwd: mkdtempSync(join(tmpdir(), "wf-e2e-proj-")) }
  )
);
const stateFile = join(session, "state.json");
const base = JSON.parse(readFileSync(stateFile, "utf8"));
const now = new Date().toISOString();

const fixture = () => ({
  ...base,
  destination: "E2E Distributed Storage",
  agent: { status: "waiting", since: now, handled: 0 },
  terms: [{ term: "Frontier", def: "Unblocked actionable tickets.", avoid: ["backlog"] }],
  tickets: [
    {
      id: "t1",
      title: "Storage Engine Selection",
      type: "grilling",
      status: "resolved",
      blocked_by: [],
      blocks: ["t2", "t3"],
      question: "Which storage engine fits our scale?",
      options: [
        { k: "A", text: "LSM Tree (RocksDB)" },
        { k: "B", text: "B-Tree (SQLite)" },
      ],
      rec: { option: "A", why: "LSM optimizes for heavy write throughput." },
      answer: { summary: "Adopted RocksDB", option: "A" },
      thread: [{ who: "user", text: "Why not B?", at: now }, { who: "agent", text: "B cannot sustain writes.", at: now }],
    },
    {
      id: "t2",
      title: "Replication Protocol",
      type: "grilling",
      status: "frontier",
      blocked_by: ["t1"],
      blocks: [],
      question: "Choose replication model",
      options: [
        { k: "A", text: "Raft consensus" },
        { k: "B", text: "Primary-backup" },
      ],
      rec: { option: "A", why: "Raft guarantees strong consistency across partitions." },
      thread: [],
    },
    {
      id: "t3",
      title: "Benchmarking IOPS",
      type: "research",
      status: "frontier",
      blocked_by: ["t1"],
      blocks: [],
      question: "Validate throughput against NVMe disks",
      options: [],
      rec: null,
      thread: [],
    },
  ],
  fog: [{ id: "fog-1", notes: "Network partition healing strategy" }],
  visual: {
    kind: "diagram",
    version: 1,
    at: now,
    stale: false,
    thread: [],
  },
});

writeFileSync(stateFile, JSON.stringify(fixture(), null, 2));
writeFileSync(join(session, "visual.html"), "<!doctype html><title>Visual</title><h1>Architecture Graph</h1>");

function startServe() {
  const child = spawn(process.execPath, [SERVER, "serve", "--session", session], {
    env,
    stdio: ["ignore", "pipe", "inherit"],
  });
  let buf = "";
  const lines = [];
  const waiters = [];
  child.stdout.on("data", (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      lines.push(buf.slice(0, i));
      buf = buf.slice(i + 1);
      waiters.splice(0).forEach((w) => w());
    }
  });
  const nth = (n) =>
    new Promise((res) => {
      const c = () => (lines.length >= n ? res(lines[n - 1]) : waiters.push(c));
      c();
    });
  const stop = () =>
    new Promise((res) => {
      if (child.exitCode !== null) return res();
      child.on("exit", res);
      child.kill();
    });
  return { child, lines, nth, stop };
}

const srv = startServe();
const ready = JSON.parse(await srv.nth(1));

console.log("Starting browser check against", ready.url);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(ready.url);

  // 1. Title and Frontier check
  assert.equal(await page.textContent("#dest-display"), "E2E Distributed Storage");
  assert.equal(await page.textContent("#frontier-count"), "2");
  assert.equal(await page.textContent("#resolved-count"), "1");
  assert.equal(await page.textContent("#fog-count"), "1");

  // 2. SVG DAG Render check
  const nodes = await page.$$("g");
  assert.ok(nodes.length >= 3, "SVG contains rendered ticket nodes");

  // 3. Switch to Card View and verify Decision Card
  await page.click("#toggle-card");
  assert.ok((await page.textContent("#c-title")).includes("Storage Engine Selection") || (await page.textContent("#c-title")).includes("Replication Protocol"));

  // 4. Staging an action and verifying localStorage persistence
  await page.click(".nav-item:has-text('Replication Protocol')");
  await page.click(".opt-item:has-text('Raft consensus')");
  assert.equal(await page.textContent("#staged-count"), "1");

  // Reload page to verify persistence
  await page.reload();
  assert.equal(await page.textContent("#staged-count"), "1", "Staged action survived page reload via localStorage");

  // 5. Test Visual Tab
  await page.click("#toggle-visual");
  assert.equal(await page.getAttribute("#visual-frame", "src"), "/visual");

  // 6. Test Terms Modal
  await page.click("#terms-btn");
  assert.ok((await page.textContent("#terms-list")).includes("Frontier"));
  await page.click("#terms-modal button:has-text('Close')");

  // 7. Test Finish Modal
  await page.click("#finish-btn");
  assert.ok(await page.isVisible("#finish-modal"));
  assert.equal(await page.textContent("#finish-frontier-count"), "2");
  await page.click("#finish-modal button:has-text('Cancel')");

  console.log("All wayfinder-ui E2E browser checks passed successfully!");
} finally {
  await page.close();
  await browser.close();
  await srv.stop();
}
