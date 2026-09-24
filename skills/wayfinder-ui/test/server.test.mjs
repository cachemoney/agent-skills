// Tests for wayfinder-ui server.mjs: session creation, serve (page/state/send), wait, url, sessions, pending, patch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync, existsSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const serverCandidates = [
  join(here, "..", "scripts", "server.mjs"),
  join(here, "..", "server.mjs"),
];
const SERVER = serverCandidates.find((s) => existsSync(s)) || join(here, "..", "scripts", "server.mjs");
const home = mkdtempSync(join(tmpdir(), "wayfinder-home-"));
const env = { ...process.env, WAYFINDER_HOME: home };
const tmp = (p) => mkdtempSync(join(tmpdir(), p));
const run = (args, opts = {}) =>
  execFileSync(process.execPath, [SERVER, ...args], { encoding: "utf8", env, ...opts }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (url, body) =>
  fetch(url + "send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

function lineReader(stream) {
  const lines = [];
  const waiters = [];
  let buf = "";
  stream.on("data", (d) => {
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
      const check = () => (lines.length >= n ? res(lines[n - 1]) : waiters.push(check));
      check();
    });
  return { lines, nth };
}

async function startServe(session, extra = []) {
  const child = spawn(process.execPath, [SERVER, "serve", "--session", session, ...extra], {
    env,
    stdio: ["ignore", "pipe", "inherit"],
  });
  const out = lineReader(child.stdout);
  const ready = JSON.parse(await out.nth(1));
  const stop = () =>
    new Promise((res) => {
      if (child.exitCode !== null) return res();
      child.on("exit", res);
      child.kill();
    });
  return { child, ready, out, stop };
}

const newSession = (cwd, destination = "Database Sharding") =>
  JSON.parse(run(["new", "--destination", destination], { cwd }));

test("new: outside git the key comes from the cwd; state.json skeleton is written", () => {
  const cwd = tmp("wf-nogit-");
  const out = newSession(cwd, "Core Infrastructure");
  const real = realpathSync(cwd);
  assert.equal(out.project, real);
  assert.equal(out.destination, "Core Infrastructure");
  assert.equal(out.key, real.replace(/^\//, "").replace(/\//g, "-"));
  assert.ok(out.session.startsWith(join(home, "sessions", out.key) + "/"), out.session);

  const state = JSON.parse(readFileSync(join(out.session, "state.json"), "utf8"));
  assert.equal(state.destination, "Core Infrastructure");
  assert.deepEqual(state.tickets, []);
  assert.deepEqual(state.fog, []);
  assert.deepEqual(state.out_of_scope, []);
  assert.deepEqual(state.terms, []);
  assert.equal(state.agent.status, "working");
  assert.match(state.created, /^\d{4}-\d{2}-\d{2}T/);
});

test("new: a git repo and one of its worktrees share one key; two sessions never collide", () => {
  const repo = tmp("wf-repo-");
  const git = (args, cwd) =>
    execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, stdio: "pipe" });
  git(["init", "-q", "-b", "main"], repo);
  git(["commit", "-q", "--allow-empty", "-m", "init"], repo);
  const wt = join(tmp("wf-wt-"), "wt");
  git(["worktree", "add", "-q", wt, "-b", "side"], repo);

  const a = newSession(repo, "Repo Epic"),
    b = newSession(wt, "Worktree Epic"),
    c = newSession(repo, "Another Epic");
  assert.equal(a.key, b.key);
  assert.equal(a.project, realpathSync(repo));
  assert.equal(b.project, realpathSync(repo));
  assert.notEqual(a.session, c.session);
});

test("serve: ready line + server.json, page, state, send appends same line it prints, bad bodies are 400, seq survives restart", async (t) => {
  const { session } = newSession(tmp("wf-s-"));
  const s = await startServe(session);
  t.after(s.stop);
  assert.equal(s.ready.type, "ready");
  assert.match(s.ready.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  assert.equal(s.ready.session, session);
  assert.equal(JSON.parse(readFileSync(join(session, "server.json"), "utf8")).url, s.ready.url);

  const html = await (await fetch(s.ready.url)).text();
  assert.match(html, /<textarea/);
  const state = await (await fetch(s.ready.url + "state")).json();
  assert.equal(state.destination, "Database Sharding");

  const actions = [{ type: "claim_ticket", ticket_id: "t1" }];
  const r1 = await post(s.ready.url, { actions });
  assert.equal(r1.status, 200);
  assert.deepEqual(await r1.json(), { ok: true, seq: 1 });

  const ev = JSON.parse(await s.out.nth(2));
  assert.equal(ev.type, "send");
  assert.equal(ev.seq, 1);
  assert.equal(ev.session, session);
  assert.deepEqual(ev.actions, actions);
  assert.match(ev.at, /^\d{4}-\d{2}-\d{2}T/);

  const fileLines = readFileSync(join(session, "events.jsonl"), "utf8").trim().split("\n");
  assert.equal(fileLines.length, 1);
  assert.equal(fileLines[0], s.out.lines[1]);

  assert.equal((await post(s.ready.url, "not-json")).status, 400);
  assert.equal((await post(s.ready.url, { actions: [] })).status, 400);
  assert.equal((await post(s.ready.url, { actions: "invalid" })).status, 400);
  await sleep(100);
  assert.equal(s.out.lines.length, 2, "bad bodies do not print or append");
  assert.equal(readFileSync(join(session, "events.jsonl"), "utf8").trim().split("\n").length, 1);

  await s.stop();
  const s2 = await startServe(session);
  t.after(s2.stop);
  const r2 = await post(s2.ready.url, { actions: [{ type: "thread_message", ticket_id: "t1", text: "hello" }] });
  assert.deepEqual(await r2.json(), { ok: true, seq: 2 });
  assert.equal(JSON.parse(await s2.out.nth(2)).seq, 2);
});

test("serve: /send rejects mismatched Origin, allows same-origin and no-Origin requests", async (t) => {
  const { session } = newSession(tmp("wf-o-"));
  const s = await startServe(session);
  t.after(s.stop);
  const actions = [{ type: "claim_ticket", ticket_id: "t1" }];
  const withOrigin = (origin, contentType = "application/json") =>
    fetch(s.ready.url + "send", {
      method: "POST",
      headers: { "content-type": contentType, origin },
      body: JSON.stringify({ actions }),
    });

  assert.equal((await post(s.ready.url, { actions })).status, 200, "no Origin allowed");
  assert.equal((await withOrigin(s.ready.url.slice(0, -1))).status, 200, "self origin allowed");
  const port = Number(new URL(s.ready.url).port);
  assert.equal((await withOrigin(`http://localhost:${port}`)).status, 200, "localhost allowed");
  assert.equal((await withOrigin(`http://localhost:${port + 1}`)).status, 403, "other port rejected");
  assert.equal((await withOrigin("https://evil.com")).status, 403, "external origin rejected");
  assert.equal((await withOrigin("null")).status, 403, "sandboxed null origin rejected");
});

test("serve: /visual serves session visual.html, 404 JSON when absent", async (t) => {
  const { session } = newSession(tmp("wf-v-"));
  const s = await startServe(session);
  t.after(s.stop);

  const miss = await fetch(s.ready.url + "visual");
  assert.equal(miss.status, 404);
  assert.deepEqual(await miss.json(), { error: "no visual" });

  const html = "<!doctype html><title>Visual</title><h1>Roadmap Architecture</h1>";
  writeFileSync(join(session, "visual.html"), html);
  const hit = await fetch(s.ready.url + "visual?v=1");
  assert.equal(hit.status, 200);
  assert.match(hit.headers.get("content-type"), /^text\/html/);
  assert.equal(hit.headers.get("cache-control"), "no-store");
  assert.equal(await hit.text(), html);
});

test("serve: reuses last port from server.json, falls back to ephemeral when taken; --port wins", async (t) => {
  const { session } = newSession(tmp("wf-p-"));
  const s1 = await startServe(session);
  t.after(s1.stop);
  const port = Number(new URL(s1.ready.url).port);
  assert.equal(JSON.parse(readFileSync(join(session, "server.json"), "utf8")).port, port);
  await s1.stop();

  const s2 = await startServe(session);
  t.after(s2.stop);
  assert.equal(s2.ready.url, s1.ready.url, "same port after restart");
  await s2.stop();

  const blocker = createServer();
  await new Promise((r) => blocker.listen(port, "127.0.0.1", r));
  t.after(() => blocker.close());

  const s3 = await startServe(session);
  t.after(s3.stop);
  assert.notEqual(new URL(s3.ready.url).port, String(port), "fallback to ephemeral when taken");
  assert.equal((await fetch(s3.ready.url + "state")).status, 200);
  await s3.stop();
  await new Promise((r) => blocker.close(r));

  const s4 = await startServe(session, ["--port", "0"]);
  t.after(s4.stop);
  assert.notEqual(new URL(s4.ready.url).port, String(port), "--port 0 skips reuse");
});

test("url: prints running server url; fails fast when there is none", async (t) => {
  const { session } = newSession(tmp("wf-u-"));
  assert.throws(() => run(["url", "--session", session, "--timeout", "0.3"]));
  const s = await startServe(session);
  t.after(s.stop);
  assert.equal(run(["url", "--session", session]), s.ready.url);
});

test("sessions: lists this project's sessions newest first, unfinished by default, --all includes finished", async () => {
  const cwd = tmp("wf-ls-");
  const a = newSession(cwd, "First Epic");
  await sleep(20);
  const b = newSession(cwd, "Second Epic");
  await sleep(20);
  const c = newSession(cwd, "Finished Epic");

  const stateOf = (dir) => JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  const write = (dir, st) => writeFileSync(join(dir, "state.json"), JSON.stringify(st));

  const sb = stateOf(b.session);
  sb.agent = { status: "waiting", since: "2026-09-01T10:00:00Z", handled: 2 };
  sb.tickets = [
    { id: "t1", status: "resolved" },
    { id: "t2", status: "frontier" },
    { id: "t3", status: "blocked" },
  ];
  sb.fog = [{ id: "fog-1", notes: "Unknown" }];
  write(b.session, sb);
  writeFileSync(join(b.session, "events.jsonl"), '{"seq":1}\n{"seq":2}\n{"seq":3}\n');

  const sc = stateOf(c.session);
  sc.finished = { doc: "docs/roadmap.md", at: "2026-09-01T11:00:00Z" };
  write(c.session, sc);

  const lines = run(["sessions"], { cwd }).split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.session), [b.session, a.session]);
  assert.deepEqual(lines[0], {
    session: b.session,
    id: b.id,
    destination: "Second Epic",
    created: sb.created,
    finished: null,
    frontier: 1,
    resolved: 1,
    blocked: 1,
    fog: 1,
    handled: 2,
    lastSeq: 3,
  });

  const all = run(["sessions", "--all"], { cwd }).split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(all.map((l) => l.session), [c.session, b.session, a.session]);
  assert.deepEqual(all[0].finished, { doc: "docs/roadmap.md", at: "2026-09-01T11:00:00Z" });
  assert.equal(run(["sessions"], { cwd: tmp("wf-empty-") }), "");
});

test("pending: prints events past agent.handled, nothing when caught up", async (t) => {
  const { session } = newSession(tmp("wf-pd-"));
  const s = await startServe(session);
  t.after(s.stop);
  for (const tid of ["t1", "t2", "t3"]) {
    await post(s.ready.url, { actions: [{ type: "claim_ticket", ticket_id: tid }] });
  }
  await s.out.nth(4);

  const st = JSON.parse(readFileSync(join(session, "state.json"), "utf8"));
  st.agent.handled = 1;
  writeFileSync(join(session, "state.json"), JSON.stringify(st));

  const out = run(["pending", "--session", session]).split("\n");
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((l) => JSON.parse(l).seq), [2, 3]);

  st.agent.handled = 3;
  writeFileSync(join(session, "state.json"), JSON.stringify(st));
  assert.equal(run(["pending", "--session", session]), "");
});

test("patch: merges tickets and auto-calculates frontier/blocked statuses", () => {
  const { session } = newSession(tmp("wf-patch-"));
  const patch1 = {
    agent: { status: "waiting", handled: 1 },
    tickets: [
      { id: "t1", title: "Evaluate Citus", type: "research", question: "Does Citus meet throughput?" },
      { id: "t2", title: "Tenant Isolation", type: "grilling", blocked_by: ["t1"], question: "Schema vs row?" },
    ],
  };
  const res1 = JSON.parse(run(["patch", "--session", session], { input: JSON.stringify(patch1) }));
  assert.equal(res1.ok, true);
  assert.equal(res1.tickets, 2);
  assert.equal(res1.frontier, 1);
  assert.equal(res1.resolved, 0);

  const state1 = JSON.parse(readFileSync(join(session, "state.json"), "utf8"));
  const t1 = state1.tickets.find((x) => x.id === "t1");
  const t2 = state1.tickets.find((x) => x.id === "t2");
  assert.equal(t1.status, "frontier");
  assert.equal(t2.status, "blocked");
  assert.deepEqual(t1.blocks, ["t2"]);

  // Now resolve t1 and observe t2 promote to frontier
  const patch2 = {
    tickets: [
      { id: "t1", status: "resolved", answer: { summary: "Citus works" } },
    ],
  };
  const res2 = JSON.parse(run(["patch", "--session", session], { input: JSON.stringify(patch2) }));
  assert.equal(res2.frontier, 1);
  assert.equal(res2.resolved, 1);

  const state2 = JSON.parse(readFileSync(join(session, "state.json"), "utf8"));
  const t2_promoted = state2.tickets.find((x) => x.id === "t2");
  assert.equal(t2_promoted.status, "frontier");
});

test("patch: detects cycles in ticket dependencies", () => {
  const { session } = newSession(tmp("wf-cycle-"));
  const patch = {
    tickets: [
      { id: "t1", title: "Task 1", blocked_by: ["t2"] },
      { id: "t2", title: "Task 2", blocked_by: ["t1"] },
    ],
  };
  assert.throws(() => run(["patch", "--session", session], { input: JSON.stringify(patch) }));
});

test("patch: auto-stamps timestamps on missing dates", () => {
  const { session } = newSession(tmp("wf-stamp-"));
  const patch = {
    agent: { status: "waiting" },
    tickets: [
      {
        id: "t1",
        title: "Test Stamping",
        answer: { summary: "Done" },
        thread: [{ who: "user", text: "Question?" }],
      },
    ],
    visual: { version: 1, drawing: { seq: 1 }, thread: [{ who: "agent", text: "v1 ready" }] },
    finished: { doc: "docs/out.md" },
  };
  run(["patch", "--session", session], { input: JSON.stringify(patch) });

  const state = JSON.parse(readFileSync(join(session, "state.json"), "utf8"));
  assert.match(state.agent.since, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(state.tickets[0].answer.resolved_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(state.tickets[0].thread[0].at, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(state.visual.at, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(state.visual.drawing.since, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(state.visual.thread[0].at, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(state.finished.at, /^\d{4}-\d{2}-\d{2}T/);
});

test("patch: null deletes keys", () => {
  const { session } = newSession(tmp("wf-del-"));
  const patch1 = {
    active_ticket_id: "t1",
    visual: { version: 1, note: "Draft" },
  };
  run(["patch", "--session", session], { input: JSON.stringify(patch1) });
  assert.equal(JSON.parse(readFileSync(join(session, "state.json"), "utf8")).active_ticket_id, "t1");

  const patch2 = {
    active_ticket_id: null,
    visual: null,
  };
  run(["patch", "--session", session], { input: JSON.stringify(patch2) });
  const state = JSON.parse(readFileSync(join(session, "state.json"), "utf8"));
  assert.equal(state.active_ticket_id, undefined);
  assert.equal(state.visual, undefined);
});

test("patch: merges fog and terms properly", () => {
  const { session } = newSession(tmp("wf-fog-terms-"));
  const patch = {
    fog: [
      { id: "f1", title: "Cross-shard rollups", notes: "Analyze latency" },
      { title: "Zero downtime schema migration" }, // auto-assigns fog ID
    ],
    terms: [
      { term: "Destination", def: "The epic architectural goal", avoid: ["topic"] },
    ],
  };
  run(["patch", "--session", session], { input: JSON.stringify(patch) });

  const state = JSON.parse(readFileSync(join(session, "state.json"), "utf8"));
  assert.equal(state.fog.length, 2);
  assert.equal(state.fog[0].id, "f1");
  assert.equal(state.fog[1].id, "fog-2");
  assert.equal(state.terms.length, 1);
  assert.equal(state.terms[0].term, "Destination");
});

test("wait: blocks until new send newer than --after, timeout exits 3", async (t) => {
  const { session } = newSession(tmp("wf-wait-"));
  const s = await startServe(session);
  t.after(s.stop);

  const waiter = spawn(process.execPath, [SERVER, "wait", "--session", session, "--after", "0", "--timeout", "5"], {
    env,
    stdio: ["ignore", "pipe", "inherit"],
  });
  const wo = lineReader(waiter.stdout);

  await sleep(200);
  await post(s.ready.url, { actions: [{ type: "claim_ticket", ticket_id: "t1" }] });

  const code = await new Promise((res) => waiter.on("exit", res));
  assert.equal(code, 0);
  assert.equal(wo.lines.length, 1);
  const ev = JSON.parse(wo.lines[0]);
  assert.equal(ev.seq, 1);

  // Test timeout
  const timeoutWaiter = spawn(process.execPath, [SERVER, "wait", "--session", session, "--timeout", "0.5"], {
    env,
    stdio: ["ignore", "pipe", "inherit"],
  });
  const tcode = await new Promise((res) => timeoutWaiter.on("exit", res));
  assert.equal(tcode, 3);
});

test("sync: reports local tracker status and handles dry-run plan", async () => {
  const { session } = newSession(tmp("wf-sync-"));
  const outLocal = JSON.parse(run(["sync", "--session", session]));
  assert.equal(outLocal.ok, true);
  assert.equal(outLocal.tracker, "local");
  assert.equal(outLocal.synced, 0);

  // Set tracker to github
  const patch = { tracker: { type: "github" }, destination: "Test Epic" };
  run(["patch", "--session", session], { input: JSON.stringify(patch) });
  const outGh = JSON.parse(run(["sync", "--session", session, "--dry-run"]));
  assert.equal(outGh.ok, true);
  assert.equal(outGh.tracker, "github");
  assert.equal(outGh.dryRun, true);
  assert.ok(outGh.plan.length >= 1);
  assert.equal(outGh.plan[0].action, "create_map_issue");
});

