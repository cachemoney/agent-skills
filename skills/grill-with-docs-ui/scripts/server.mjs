#!/usr/bin/env node
// grill-with-docs-ui server. Plain Node, zero dependencies, no build step.
//
// Commands:
//   new           --topic T [--destination D] [--notes N] [--doc P]
//   serve         --session DIR [--port N]
//   sessions      [--all]
//   pending       --session DIR
//   wait          --session DIR [--after N] [--timeout S]
//   url           --session DIR [--timeout S]
//   patch         --session DIR [--file P]
//
// Files per session:
//   state.json    — written only by the agent, through `patch`
//   events.jsonl  — appended only by this server, one line per Send
//   server.json   — url, port, pid of the running server
//   visual.html   — optional prototype or architecture diagram
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import tty from "node:tty";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME =
  process.env.GRILL_WITH_DOCS_UI_HOME ||
  process.env.GRILL_DOCS_UI_HOME ||
  path.join(os.homedir(), ".grill-with-docs-ui");

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      o._.push(a);
      continue;
    }
    const k = a.slice(2),
      v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) {
      o[k] = true;
    } else {
      o[k] = v;
      i++;
    }
  }
  return o;
}

const print = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");
const die = (msg, code = 2) => {
  process.stderr.write(`grill-with-docs-ui: ${msg}\n`);
  process.exit(code);
};

function writeJson(file, obj) {
  const text = JSON.stringify(obj, null, 2) + "\n";
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
  return Buffer.byteLength(text);
}

function mustSession(o) {
  if (!o.session || o.session === true) die("--session <dir> is required");
  const dir = path.resolve(o.session);
  if (!fs.existsSync(dir)) die(`no such session folder: ${dir}`);
  return dir;
}

// Session key: git common root (all worktrees share it), or cwd outside git
function projectRoot(cwd) {
  try {
    const common = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    return fs.realpathSync(path.dirname(common));
  } catch {
    return fs.realpathSync(cwd);
  }
}

const keyOf = (root) => root.replace(/^[\\/]+/, "").replace(/[\\/:]+/g, "-");

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function cmdNew(o) {
  const project = projectRoot(process.cwd());
  const key = keyOf(project);
  const dir = path.join(HOME, "sessions", key);
  fs.mkdirSync(dir, { recursive: true });

  const id = stamp();
  let session = path.join(dir, id);
  for (let n = 2; fs.existsSync(session); n++) session = path.join(dir, `${id}-${n}`);
  fs.mkdirSync(session);

  const topic = typeof o.topic === "string" ? o.topic : typeof o.destination === "string" ? o.destination : "";
  const notes = typeof o.notes === "string" ? o.notes : "";
  const slug = topic ? topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "design";
  const doc = typeof o.doc === "string" ? o.doc : `docs/${slug}-design.md`;
  const now = new Date().toISOString();

  writeJson(path.join(session, "state.json"), {
    topic,
    destination: topic,
    notes,
    doc,
    project,
    created: now,
    agent: { status: "working", since: now, handled: 0 },
    active_ticket_id: null,
    tickets: [],
    fog: [],
    out_of_scope: [],
    terms: [],
    adrs: [],
    finished: null,
  });

  fs.writeFileSync(path.join(session, "events.jsonl"), "");
  print({ session, key, project, id: path.basename(session), topic, doc });
}

function readEvents(file) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push({ line, ev: JSON.parse(line) });
    } catch {
      // ignore partial or corrupt lines
    }
  }
  return out;
}

const lastSeq = (file) =>
  readEvents(file).reduce((m, { ev }) => Math.max(m, Number(ev.seq) || 0), 0);

function readState(session) {
  try {
    return JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  } catch {
    return null;
  }
}

function cmdSessions(o) {
  const dir = path.join(HOME, "sessions", keyOf(projectRoot(process.cwd())));
  if (!fs.existsSync(dir)) return;
  const rows = [];
  for (const id of fs.readdirSync(dir)) {
    const session = path.join(dir, id);
    const st = readState(session);
    if (!st) continue;
    const ts = Array.isArray(st.tickets) ? st.tickets : [];
    rows.push({
      session,
      id,
      topic: st.topic || st.destination || "",
      created: st.created || "",
      finished: st.finished || null,
      frontier: ts.filter((t) => t.status === "frontier").length,
      resolved: ts.filter((t) => t.status === "resolved").length,
      blocked: ts.filter((t) => t.status === "blocked").length,
      fog: Array.isArray(st.fog) ? st.fog.length : 0,
      terms: Array.isArray(st.terms) ? st.terms.length : 0,
      adrs: Array.isArray(st.adrs) ? st.adrs.length : 0,
      handled: Number(st.agent && st.agent.handled) || 0,
      lastSeq: lastSeq(path.join(session, "events.jsonl")),
    });
  }
  rows.sort((a, b) => (b.created < a.created ? -1 : b.created > a.created ? 1 : b.id.localeCompare(a.id)));
  for (const r of rows) if (o.all || !r.finished) print(r);
}

function cmdPending(o) {
  const session = mustSession(o);
  const st = readState(session);
  const handled = Number(st && st.agent && st.agent.handled) || 0;
  for (const { line, ev } of readEvents(path.join(session, "events.jsonl"))) {
    if ((Number(ev.seq) || 0) > handled) process.stdout.write(line + "\n");
  }
}

function rememberedPort(serverFile) {
  try {
    const p = Number(JSON.parse(fs.readFileSync(serverFile, "utf8")).port);
    return Number.isInteger(p) && p > 0 ? p : 0;
  } catch {
    return 0;
  }
}

function cmdServe(o) {
  const session = mustSession(o);
  const events = path.join(session, "events.jsonl");
  const stateFile = path.join(session, "state.json");
  const serverFile = path.join(session, "server.json");
  const pageCandidates = [
    path.join(HERE, "..", "assets", "page.html"),
    path.join(HERE, "assets", "page.html"),
    path.join(HERE, "page.html"),
  ];
  const page = pageCandidates.find((p) => fs.existsSync(p)) || path.join(HERE, "page.html");
  let seq = lastSeq(events);
  let lastGoodState = null;
  let selfOrigins = [];

  const send = (res, code, body, type) => {
    res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
    res.end(body);
  };
  const json = (res, code, obj) => send(res, code, JSON.stringify(obj), "application/json");
  const readBody = (req) =>
    new Promise((resolve) => {
      let b = "";
      req.on("data", (c) => {
        b += c;
      });
      req.on("end", () => resolve(b));
    });

  const srv = http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, "http://x");
    if (req.method === "GET" && pathname === "/") {
      if (!fs.existsSync(page))
        return send(res, 200, "<!doctype html><title>grill-with-docs-ui</title><p>page.html not found</p>", "text/html; charset=utf-8");
      return send(res, 200, fs.readFileSync(page), "text/html; charset=utf-8");
    }
    if (req.method === "GET" && pathname === "/state") {
      try {
        const raw = fs.readFileSync(stateFile, "utf8");
        JSON.parse(raw);
        lastGoodState = raw;
      } catch {
        // preserve lastGoodState if mid-write
      }
      if (lastGoodState === null) return json(res, 404, { error: "no state" });
      return send(res, 200, lastGoodState, "application/json");
    }
    if (req.method === "GET" && pathname === "/events") {
      return send(res, 200, fs.existsSync(events) ? fs.readFileSync(events) : "", "application/x-ndjson");
    }
    if (req.method === "GET" && pathname === "/visual") {
      const visual = path.join(session, "visual.html");
      if (!fs.existsSync(visual)) return json(res, 404, { error: "no visual" });
      return send(res, 200, fs.readFileSync(visual), "text/html; charset=utf-8");
    }
    if (req.method === "POST" && pathname === "/send") {
      const origin = req.headers.origin;
      if (origin !== undefined && !selfOrigins.includes(origin)) {
        return json(res, 403, { error: "cross-origin request rejected" });
      }
      let parsed;
      try {
        parsed = JSON.parse(await readBody(req));
      } catch {
        return json(res, 400, { error: "body must be JSON" });
      }
      if (!parsed || !Array.isArray(parsed.actions) || parsed.actions.length === 0) {
        return json(res, 400, { error: "actions must be a non-empty array" });
      }
      const line = JSON.stringify({
        type: "send",
        seq: ++seq,
        at: new Date().toISOString(),
        session,
        actions: parsed.actions,
      });
      fs.appendFileSync(events, line + "\n");
      process.stdout.write(line + "\n"); // Wakes persistent monitor
      return json(res, 200, { ok: true, seq });
    }
    json(res, 404, { error: "not found" });
  });

  const explicit = o.port !== undefined && o.port !== true;
  let attempt = explicit ? Number(o.port) : rememberedPort(serverFile);
  srv.on("error", (e) => {
    if (!srv.listening && !explicit && attempt !== 0 && e.code === "EADDRINUSE") {
      attempt = 0;
      srv.listen(0, "127.0.0.1");
      return;
    }
    die(`server error: ${e.message}`, 1);
  });
  srv.on("listening", () => {
    const { port } = srv.address();
    const url = `http://127.0.0.1:${port}/`;
    selfOrigins = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
    writeJson(serverFile, { url, port, pid: process.pid, started: new Date().toISOString() });
    print({ type: "ready", url, session });
  });
  srv.listen(attempt, "127.0.0.1");

  const bye = () => process.exit(0);
  process.on("SIGINT", bye);
  process.on("SIGTERM", bye);
  process.on("SIGHUP", bye);
}

function cmdWait(o) {
  const session = mustSession(o);
  const events = path.join(session, "events.jsonl");
  const after = o.after !== undefined && o.after !== true ? Number(o.after) : lastSeq(events);
  const deadline = Date.now() + Number(o.timeout !== undefined && o.timeout !== true ? o.timeout : 480) * 1000;
  const tick = () => {
    for (const { line, ev } of readEvents(events)) {
      if ((Number(ev.seq) || 0) > after) {
        process.stdout.write(line + "\n");
        process.exit(0);
      }
    }
    if (Date.now() >= deadline) process.exit(3);
    setTimeout(tick, 250);
  };
  tick();
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function cmdUrl(o) {
  const session = mustSession(o);
  const serverFile = path.join(session, "server.json");
  const deadline = Date.now() + Number(o.timeout !== undefined && o.timeout !== true ? o.timeout : 5) * 1000;
  const tick = () => {
    try {
      const { url, pid } = JSON.parse(fs.readFileSync(serverFile, "utf8"));
      if (url && (!pid || alive(pid))) {
        process.stdout.write(url + "\n");
        process.exit(0);
      }
    } catch {}
    if (Date.now() >= deadline) die(`no running server for ${session}`, 1);
    setTimeout(tick, 100);
  };
  tick();
}

// ---- Patching and Validation Engine ----
class PatchError extends Error {}
const bad = (msg) => {
  throw new PatchError(msg);
};
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const oneLine = (s) => String(s).replace(/\s+/g, " ").trim();
const fieldsOf = (p, where) => {
  if (Object.hasOwn(p, "__proto__")) bad(`"__proto__" in ${where} is forbidden`);
  return Object.entries(p);
};

const clean = (v) =>
  Array.isArray(v)
    ? v.map(clean)
    : isObj(v)
    ? Object.fromEntries(
        Object.entries(v)
          .filter(([, x]) => x !== null)
          .map(([k, x]) => [k, clean(x)])
      )
    : v;

const TICKET_TYPES = ["grilling", "research", "prototype", "task"];
const TICKET_STATUSES = ["frontier", "blocked", "in_progress", "resolved", "out_of_scope"];

function defaultTicket(id) {
  return {
    id,
    type: "grilling",
    status: "frontier",
    assignee: null,
    durable: false,
    adr_file: null,
    blocked_by: [],
    blocks: [],
    question: "",
    options: [],
    rec: null,
    thread: [],
  };
}

function stampTimes(p, state, now) {
  const fill = (o, k) => (isObj(o) && o[k] == null ? { ...o, [k]: now } : o);
  const messages = (list) => (Array.isArray(list) ? list.map((m) => fill(m, "at")) : list);
  const out = { ...p };
  if (isObj(out.agent) && out.agent.status != null) out.agent = fill(out.agent, "since");
  if (isObj(out.finished)) out.finished = fill(out.finished, "at");
  if (Array.isArray(out.tickets)) {
    out.tickets = out.tickets.map((t) => {
      if (!isObj(t)) return t;
      const s = { ...t };
      if (isObj(s.answer)) s.answer = fill(s.answer, "resolved_at");
      if ("thread" in s) s.thread = messages(s.thread);
      return s;
    });
  }
  if (isObj(out.visual)) {
    let v = { ...out.visual };
    const current = isObj(state) && isObj(state.visual) ? state.visual.version : undefined;
    if (v.version != null && v.version !== current) v = fill(v, "at");
    if (isObj(v.drawing)) v.drawing = fill(v.drawing, "since");
    if ("thread" in v) v.thread = messages(v.thread);
    out.visual = v;
  }
  return out;
}

function appendTo(current, added, where) {
  if (!Array.isArray(added)) bad(`${where} in patch must be an array`);
  return [...(current || []), ...added.map(clean)];
}

function mergeOne(current, p, where, appends = []) {
  if (!isObj(p)) bad(`${where} in patch must be an object`);
  const out = isObj(current) ? { ...current } : {};
  for (const [k, v] of fieldsOf(p, where)) {
    if (v === null) delete out[k];
    else if (appends.includes(k)) out[k] = appendTo(out[k], v, `${where}.${k}`);
    else out[k] = clean(v);
  }
  return out;
}

function patchTickets(current, list) {
  if (!Array.isArray(list)) bad("tickets in a patch must be an array of ticket objects");
  const ts = (current || []).slice();
  for (const p of list) {
    if (!isObj(p) || typeof p.id !== "string" || !p.id) bad("every ticket entry in a patch needs a string id");
    const i = ts.findIndex((t) => isObj(t) && t.id === p.id);
    if (i >= 0) {
      ts[i] = mergeOne(ts[i], p, p.id, ["thread"]);
    } else {
      if (!p.title) bad(`new ticket ${JSON.stringify(p.id)} requires a string title`);
      const def = defaultTicket(p.id);
      const created = mergeOne(def, p, p.id, ["thread"]);
      ts.push(created);
    }
  }

  // Update reverse dependency edges: if t.blocked_by has X, X.blocks must have t.id
  for (const t of ts) {
    if (Array.isArray(t.blocked_by)) {
      for (const blockerId of t.blocked_by) {
        const blocker = ts.find((x) => x && x.id === blockerId);
        if (blocker) {
          blocker.blocks = Array.isArray(blocker.blocks) ? blocker.blocks : [];
          if (!blocker.blocks.includes(t.id)) blocker.blocks.push(t.id);
        }
      }
    }
  }

  // Auto-recalculate frontier/blocked statuses for tickets not in terminal or active states
  for (const t of ts) {
    if (t.status === "frontier" || t.status === "blocked") {
      const blockers = Array.isArray(t.blocked_by) ? t.blocked_by : [];
      const allResolved = blockers.every((bid) => {
        const b = ts.find((x) => x && x.id === bid);
        return b && b.status === "resolved";
      });
      t.status = allResolved ? "frontier" : "blocked";
    }
  }

  return ts;
}

function patchFog(current, list) {
  if (!Array.isArray(list)) bad("fog in a patch must be an array of entries");
  const fsList = (current || []).slice();
  for (const item of list) {
    if (!isObj(item)) bad("fog entry must be an object");
    if (item.id) {
      const i = fsList.findIndex((f) => isObj(f) && f.id === item.id);
      if (i >= 0) fsList[i] = clean(item);
      else fsList.push(clean(item));
    } else {
      const id = `fog-${fsList.length + 1}`;
      fsList.push(clean({ id, ...item }));
    }
  }
  return fsList;
}

function patchTerms(current, list) {
  if (!Array.isArray(list)) bad("terms in a patch must be an array of entries");
  const ts = (current || []).slice();
  for (const t of list) {
    if (!isObj(t) || typeof t.term !== "string") bad("term entry needs a string term");
    const i = ts.findIndex((x) => isObj(x) && x.term === t.term);
    if (i >= 0) ts[i] = clean(t);
    else ts.push(clean(t));
  }
  return ts;
}

function patchAdrs(current, list) {
  if (!Array.isArray(list)) bad("adrs in a patch must be an array of entries");
  const asList = (current || []).slice();
  for (const item of list) {
    if (typeof item === "string") {
      if (!asList.includes(item)) asList.push(item);
    } else if (isObj(item) && item.file) {
      const i = asList.findIndex((x) => isObj(x) && x.file === item.file);
      if (i >= 0) asList[i] = clean(item);
      else asList.push(clean(item));
    } else {
      bad("adr entry must be a file path string or object with file property");
    }
  }
  return asList;
}

function applyPatch(state, p, now) {
  if (!isObj(p)) bad("the patch must be a JSON object");
  const out = { ...state };
  for (const [k, v] of fieldsOf(stampTimes(p, state, now), "the patch")) {
    if (v === null) delete out[k];
    else if (k === "agent") out.agent = mergeOne(out.agent, v, "agent");
    else if (k === "visual") out.visual = mergeOne(out.visual, v, "visual", ["thread", "queued"]);
    else if (k === "tickets") out.tickets = patchTickets(out.tickets, v);
    else if (k === "fog") out.fog = patchFog(out.fog, v);
    else if (k === "terms") out.terms = patchTerms(out.terms, v);
    else if (k === "adrs") out.adrs = patchAdrs(out.adrs, v);
    else out[k] = clean(v);
  }
  return out;
}

function validateDAG(tickets) {
  const graph = new Map();
  for (const t of tickets) {
    graph.set(t.id, Array.isArray(t.blocked_by) ? t.blocked_by : []);
  }
  const visited = new Set();
  const recStack = new Set();

  function hasCycle(id) {
    visited.add(id);
    recStack.add(id);
    const neighbors = graph.get(id) || [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        if (hasCycle(n)) return true;
      } else if (recStack.has(n)) {
        return true;
      }
    }
    recStack.delete(id);
    return false;
  }

  for (const id of graph.keys()) {
    if (!visited.has(id) && hasCycle(id)) {
      bad(`dependency cycle detected in tickets involving ${id}`);
    }
  }
}

function validateState(s) {
  const need = (ok, msg) => {
    if (!ok) bad(msg);
  };
  const str = (v) => typeof v === "string";
  const strs = (v) => Array.isArray(v) && v.every(str);
  const count = (v) => Number.isInteger(v) && v >= 0;

  for (const k of ["topic", "destination", "notes", "doc", "project", "created"]) {
    if (k in s) need(str(s[k]), `${k} must be a string`);
  }
  if ("agent" in s) {
    need(isObj(s.agent), "agent must be an object");
    if ("status" in s.agent)
      need(s.agent.status === "waiting" || s.agent.status === "working", 'agent.status must be "waiting" or "working"');
    if ("handled" in s.agent) need(count(s.agent.handled), "agent.handled must be a positive integer");
  }
  if ("tickets" in s) {
    need(Array.isArray(s.tickets), "tickets must be an array");
    const ids = new Set();
    for (const t of s.tickets) {
      need(isObj(t) && str(t.id) && t.id, "each ticket needs a string id");
      need(!ids.has(t.id), `duplicate ticket id: ${t.id}`);
      ids.add(t.id);
      need(str(t.title), `ticket ${t.id} must have a title`);
      if ("type" in t) need(TICKET_TYPES.includes(t.type), `ticket ${t.id} type must be one of: ${TICKET_TYPES.join(", ")}`);
      if ("status" in t) need(TICKET_STATUSES.includes(t.status), `ticket ${t.id} status must be one of: ${TICKET_STATUSES.join(", ")}`);
      if ("blocked_by" in t) need(strs(t.blocked_by), `ticket ${t.id} blocked_by must be array of strings`);
      if ("blocks" in t) need(strs(t.blocks), `ticket ${t.id} blocks must be array of strings`);
    }
    validateDAG(s.tickets);
  }
}

function cmdPatch(o) {
  const session = mustSession(o);
  const file = path.join(session, "state.json");
  let text;
  if (o.file !== undefined) {
    if (o.file === true) die("--file needs a path");
    try {
      text = fs.readFileSync(path.resolve(o.file), "utf8");
    } catch (e) {
      die(`cannot read patch file ${o.file}: ${e.code || oneLine(e.message)}`);
    }
  } else {
    if (tty.isatty(0)) die("no patch: pipe a JSON patch on stdin or pass --file <path>");
    try {
      text = fs.readFileSync(0, "utf8");
    } catch (e) {
      die(`cannot read patch from stdin: ${e.code || oneLine(e.message)}`);
    }
  }
  if (!text.trim()) die("empty patch: send a JSON object");
  let p;
  try {
    p = JSON.parse(text);
  } catch (e) {
    die(`patch is not valid JSON (state.json unchanged): ${oneLine(e.message)}`);
  }
  if (!fs.existsSync(file)) die(`no state.json in ${session}`);
  let state;
  try {
    state = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    die(`state.json is corrupt (unchanged): ${oneLine(e.message)}`);
  }
  let next;
  try {
    next = applyPatch(state, p, new Date().toISOString());
    validateState(next);
  } catch (e) {
    die(
      e instanceof PatchError
        ? `patch rejected (state.json unchanged): ${oneLine(e.message)}`
        : `could not apply patch (state.json unchanged): ${oneLine(e.message)}`
    );
  }
  let bytes;
  try {
    bytes = writeJson(file, next);
  } catch (e) {
    die(`could not write state.json: ${e.code || oneLine(e.message)}`, 1);
  }

  const ts = Array.isArray(next.tickets) ? next.tickets : [];
  print({
    ok: true,
    tickets: ts.length,
    frontier: ts.filter((t) => t.status === "frontier").length,
    resolved: ts.filter((t) => t.status === "resolved").length,
    fog: Array.isArray(next.fog) ? next.fog.length : 0,
    terms: Array.isArray(next.terms) ? next.terms.length : 0,
    adrs: Array.isArray(next.adrs) ? next.adrs.length : 0,
    handled: Number(next.agent && next.agent.handled) || 0,
    bytes,
  });
}

const o = parseArgs(process.argv.slice(2));
const cmds = {
  new: cmdNew,
  serve: cmdServe,
  sessions: cmdSessions,
  pending: cmdPending,
  wait: cmdWait,
  url: cmdUrl,
  patch: cmdPatch,
};

if (Object.hasOwn(cmds, o._[0] ?? "")) {
  cmds[o._[0]](o);
} else {
  die("usage: server.mjs new|serve|sessions|pending|wait|url|patch [--session DIR] ...");
}
