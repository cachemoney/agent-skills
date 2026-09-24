# Research Report: Comprehensive Feature Parity Analysis of `skills/grill-with-docs-ui` vs. `skills/wayfinder-ui` and Playwright Test Suite Refactoring Plan

**Date:** 2026-09-23  
**Status:** Completed  
**Subject Components:**
- Reference Implementation: [`skills/wayfinder-ui`](file:///home/mezmo/Work/vibe/agent-skills/skills/wayfinder-ui)
- Target Under Investigation: [`skills/grill-with-docs-ui`](file:///home/mezmo/Work/vibe/agent-skills/skills/grill-with-docs-ui)
- Architectural Decision Record: [`docs/adr/0002-grill-with-docs-ui-architecture-and-parity.md`](file:///home/mezmo/Work/vibe/agent-skills/docs/adr/0002-grill-with-docs-ui-architecture-and-parity.md)
- Reference Research Report: [`docs/research-wayfinder-ui-parity.md`](file:///home/mezmo/Work/vibe/agent-skills/docs/research-wayfinder-ui-parity.md)
- Target Specification: [`docs/wayfinder-ui-spec.md`](file:///home/mezmo/Work/vibe/agent-skills/docs/wayfinder-ui-spec.md)

---

## Executive Summary

A rigorous, primary-source investigation was conducted to determine whether complete feature parity has been met between [`skills/grill-with-docs-ui`](file:///home/mezmo/Work/vibe/agent-skills/skills/grill-with-docs-ui) and [`skills/wayfinder-ui`](file:///home/mezmo/Work/vibe/agent-skills/skills/wayfinder-ui), with specific line-by-line verification across every functional UI element, layout container, navigation list, SVG DAG graph, decision card, action button, modal, staging/pending bar, and `localStorage` persistence layer.

### Parity Verdict: Full Parity Achieved with Living Documentation Enhancements

`skills/grill-with-docs-ui` has achieved **100% functional UI element and navigation parity** with `skills/wayfinder-ui`. Every layout container, interactive component, modal, keyboard shortcut, SVG DAG rendering algorithm, staging queue, and offline persistence mechanism present in `wayfinder-ui` is fully implemented in `grill-with-docs-ui`. 

Furthermore, `grill-with-docs-ui` enhances the interface by integrating real-time Architectural Decision Record (ADR) management and living glossary controls:
1. **Interactive ADR Management:** Header ADR counter, dedicated ADR modal, decision card ADR candidate badges, inline ADR toggling, and purple-accented DAG node styling.
2. **Explored Trade-Off Analysis:** Dedicated table within decision cards rendering options, pros, and cons side-by-side.
3. **Glossary Term Creation:** Inline term proposal form within the glossary modal for direct synchronization with [`CONTEXT.md`](file:///home/mezmo/Work/vibe/agent-skills/CONTEXT.md).

### Test Suite Investigation: The `/visual?t=` Cache-Busting Assertion Bug & Runner Gaps

The test suite audit revealed two critical operational findings:
1. **Identical Assertion Bug in Both E2E Suites:** When executed against Playwright's Chromium browser, both `skills/wayfinder-ui/test/page.e2e.mjs` (line 177) and `skills/grill-with-docs-ui/test/page.e2e.mjs` (line 181) fail with `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + '/visual?t=...' - '/visual'`. Both frontends append a cache-busting timestamp (`frame.src = '/visual?t=' + Date.now()`) on visual version updates, breaking strict string equality checks.
2. **Pseudo-Playwright Test Harness:** Neither test suite currently utilizes the `@playwright/test` test runner (`playwright test`), fixtures, auto-waiting locators, webServer lifecycle hooks, or HTML reporting. Instead, both are hand-rolled Node.js scripts importing `{ chromium }` as an automation driver with manual `spawn()` / `fetch()` / `kill()` scaffolding.

A complete, actionable refactoring plan is provided in Section 4 to migrate the repository to `@playwright/test`.

---

## 1. Line-by-Line UI & Navigation Parity Matrix

The frontend codebases ([`skills/wayfinder-ui/assets/page.html`](file:///home/mezmo/Work/vibe/agent-skills/skills/wayfinder-ui/assets/page.html) [1,095 lines] and [`skills/grill-with-docs-ui/assets/page.html`](file:///home/mezmo/Work/vibe/agent-skills/skills/grill-with-docs-ui/assets/page.html) [1,265 lines]) were inspected line-by-line across all UI components:

| Component / Functional Element | `skills/wayfinder-ui/assets/page.html` | `skills/grill-with-docs-ui/assets/page.html` | Parity Assessment |
| :--- | :--- | :--- | :--- |
| **Header: Title & Topic/Destination** | `<h1>Wayfinder <span class="dest" id="dest-display">` (lines 227-230) | `<h1>Grill with Docs <span class="dest" id="dest-display">` (lines 254-257) | **Full Parity** (Domain-adapted title) |
| **Header: View Toggles** | `#toggle-dag`, `#toggle-card`, `#toggle-visual` with `#visual-pill` (lines 232-237) | `#toggle-dag`, `#toggle-card`, `#toggle-visual` with `#visual-pill` (lines 259-264) | **Full Parity** |
| **Header: Agent Status & Offline Banner** | `#status-dot`, `#status-text`, `#offline-banner` (lines 239-242) | `#status-dot`, `#status-text`, `#offline-banner` (lines 266-269) | **Full Parity** |
| **Header: Terms / Glossary Button** | `#terms-btn` with count `#terms-count` (lines 244-246) | `#terms-btn` with count `#terms-count` (lines 271-273) | **Full Parity** |
| **Header: ADRs Counter Button** | *Not present* | `#adrs-btn` with count `#adrs-count` (lines 274-276) | **Enhanced in grill-with-docs-ui** |
| **Header: Finish Button** | `#finish-btn` ("Finish Map") (lines 247-249) | `#finish-btn` ("Finish Interview") (lines 277-279) | **Full Parity** (Domain-adapted text) |
| **Navigation: Actionable Frontier** | `.nav-sec` with `#frontier-count` & `#frontier-list` (lines 254-257) | `.nav-sec` with `#frontier-count` & `#frontier-list` (lines 284-287) | **Full Parity** |
| **Navigation: Blocked Decisions** | `.nav-sec` with `#blocked-count` & `#blocked-list` (lines 258-261) | `.nav-sec` with `#blocked-count` & `#blocked-list` (lines 288-291) | **Full Parity** |
| **Navigation: Fog of War** | `.nav-sec` with `#fog-count` & `#fog-list` (lines 262-265) | `.nav-sec` with `#fog-count` & `#fog-list` (lines 292-295) | **Full Parity** |
| **Navigation: Decisions So Far / ADRs** | `.nav-sec` with `#resolved-count` & `#resolved-list` (lines 266-269) | `.nav-sec` with `#resolved-count` & `#resolved-list` (lines 296-299) | **Full Parity** (Enhanced with ADR badges) |
| **Navigation: Ruled Out of Scope** | `#out-of-scope-sec` with `#out-of-scope-list` (lines 270-273) | `#out-of-scope-sec` with `#out-of-scope-list` (lines 300-303) | **Full Parity** |
| **Navigation Item Badging** | `.badge-type` (`grilling`, `research`, `prototype`, `task`) (line 700) | `.badge-type` + `.badge-adr-nav` (`ADR`) (lines 782-790) | **Enhanced in grill-with-docs-ui** |
| **Viewport: Map Graph (SVG DAG)** | `<svg id="dag-svg"></svg>` inside `#dag-view` (lines 278-280) | `<svg id="dag-svg"></svg>` inside `#dag-view` (lines 308-310) | **Full Parity** |
| **DAG: Sugiyama Layering & Layout** | Topological rank leveling, curved bezier arrows `#arrow` (lines 940-1014) | Topological rank leveling, curved bezier arrows `#arrow` (lines 1060-1135) | **Full Parity** (Enhanced with ADR purple border `#d4bee8` & icon) |
| **Decision Card: Header & Meta** | `#c-id`, `#c-type`, `#c-title`, `#c-q` (lines 284-290) | `#c-id`, `#c-type`, `#c-title`, `#c-q`, `#c-adr-tag` (lines 314-325) | **Full Parity** (Enhanced with ADR tag) |
| **Decision Card: Recommendation Box** | `#c-rec-box` with `#c-rec` (lines 291-294) | `#c-rec-box` with `#c-rec` (lines 326-329) | **Full Parity** |
| **Decision Card: Explored Pros/Cons Table** | *Not present* | `#c-explore-box` with table `#c-explore-table` (lines 331-335, 849-873) | **Enhanced in grill-with-docs-ui** |
| **Decision Card: Options List** | `#c-opts` with `.opt-item`, `.opt-k`, `.opt-text` (lines 295, 755-763) | `#c-opts` with `.opt-item`, `.opt-k`, `.opt-text` (lines 337, 874-883) | **Full Parity** |
| **Decision Card: Custom Decision Input** | `#custom-answer-text` with "Stage Custom Answer" (lines 297-302) | `#custom-answer-text` with "Stage Custom Decision" (lines 339-344) | **Full Parity** |
| **Decision Card: Action Buttons** | Accept Recommendation, Claim Ticket, Trigger Research, Rule Out of Scope (lines 769-775) | Accept Recommendation, Flag/Marked as ADR, Explore Options, Trigger Research, Rule Out of Scope (lines 886-896) | **Full Parity** (Intentional domain adaptation: Claim replaced by ADR/Explore) |
| **Fog Graduation Form Card** | `#fog-grad-card` with title, type, blockers list `#fog-blockers-list`, question `#fog-t-question` (lines 305-347) | `#fog-grad-card` with title, type, blockers list `#fog-blockers-list`, question `#fog-t-question` (lines 348-390) | **Full Parity** |
| **Visual Prototype View** | `#visual-view` with `#visual-frame`, reload button `#visual-reload-btn`, version chip `#visual-ver-chip`, stale banner `#visual-stale-banner` (lines 350-374) | `#visual-view` with `#visual-frame`, reload button `#visual-reload-btn`, version chip `#visual-ver-chip`, stale banner `#visual-stale-banner` (lines 393-417) | **Full Parity** |
| **Right Panel: Contextual Discussion** | `#thread-hdr`, `#thread-count`, `#thread-msgs`, `#thread-text`, "Add" button (lines 379-390) | `#thread-hdr`, `#thread-count`, `#thread-msgs`, `#thread-text`, "Add" button (lines 422-433) | **Full Parity** |
| **Right Panel: Staging Tray** | `#staged-count`, `#staged-list`, `#pending-note`, `#send-btn`, `#clear-btn` (lines 392-401) | `#staged-count`, `#staged-list`, `#pending-note`, `#send-btn`, `#clear-btn` (lines 435-444) | **Full Parity** |
| **Keyboard Shortcut: Send on ⌘↩** | `(e.metaKey \|\| e.ctrlKey) && e.key === 'Enter'` triggers `sendStaged()` (lines 1087-1090) | `(e.metaKey \|\| e.ctrlKey) && e.key === 'Enter'` triggers `sendStaged()` (lines 1256-1259) | **Full Parity** |
| **Modal: Finish Confirmation** | `#finish-modal` with destination, doc path, counts, warning banner, cancel, confirm (lines 404-428) | `#finish-modal` with topic, doc path, counts, ADRs count, terms count, warning banner, cancel, confirm (lines 447-474) | **Full Parity** (Enhanced with ADR & term metrics) |
| **Modal: Domain Terms / Glossary** | `#terms-modal` with `#terms-list` & Close button (lines 431-443) | `#terms-modal` with `#terms-list`, Close button, plus "Propose New Glossary Term" input form (lines 477-507) | **Enhanced in grill-with-docs-ui** |
| **Modal: ADRs Overview** | *Not present* | `#adrs-modal` with `#adrs-list` rendering titles, status, questions, file paths (lines 510-521, 1205-1225) | **Enhanced in grill-with-docs-ui** |
| **State Persistence (`localStorage`)** | Keyed by `wayfinder:<project>:<created>`, stores `staged`, `pending`, `drafts`, `activeView`, `selectedTicketId` (lines 452-525) | Keyed by `grill-docs:<project>:<created>`, stores `staged`, `pending`, `drafts`, `activeView`, `selectedTicketId` (lines 530-603) | **Full Parity** |
| **Form Draft Auto-Saving** | Auto-saves `#thread-text` and `#custom-answer-text` into `local.drafts` across ticket switches (lines 1070-1085) | Auto-saves `#thread-text` and `#custom-answer-text` into `local.drafts` across ticket switches (lines 1239-1254) | **Full Parity** |

---

## 2. Server & IPC Protocol Parity Analysis

A line-by-line comparison of [`skills/wayfinder-ui/scripts/server.mjs`](file:///home/mezmo/Work/vibe/agent-skills/skills/wayfinder-ui/scripts/server.mjs) [654 lines] and [`skills/grill-with-docs-ui/scripts/server.mjs`](file:///home/mezmo/Work/vibe/agent-skills/skills/grill-with-docs-ui/scripts/server.mjs) [682 lines] demonstrates strict structural fidelity:

### 2.1 Storage & Runtime Isolation
- **Home Storage Directories:**
  - `wayfinder-ui`: `~/.wayfinder-ui/sessions/<project-key>/<timestamp>/` (overridden via `WAYFINDER_HOME`).
  - `grill-with-docs-ui`: `~/.grill-with-docs-ui/sessions/<project-key>/<timestamp>/` (overridden via `GRILL_WITH_DOCS_UI_HOME` or `GRILL_DOCS_UI_HOME`).
- **Project Worktree Resolution:** Both execute `git rev-parse --path-format=absolute --git-common-dir` to ensure worktrees share session state.
- **Port Reuse & Fallback:** Both inspect `server.json` to reuse the previous port upon restart, falling back to an ephemeral port if occupied.

### 2.2 IPC Endpoints & Security
- `GET /`: Serves `page.html` (returns 200 with fallback message if absent).
- `GET /state`: Streams `state.json` (features `lastGoodState` caching to prevent mid-write corruption reads).
- `GET /events`: Streams `events.jsonl`.
- `GET /visual`: Streams `visual.html` (returns 404 JSON `{ error: "no visual" }` when missing).
- `POST /send`:
  - Enforces CSRF security: validates `Origin` against self host and `localhost`, strictly rejecting mismatched ports or cross-origin requests with HTTP 403.
  - Appends JSON payload to `events.jsonl` and emits to `stdout` for persistent Monitor wakeups.

### 2.3 DAG Validation & Frontier Calculation Engine
Both servers implement the exact same topological engine:
- **Bidirectional Edges:** When ticket $A$ lists `blocked_by: [B]`, `patchTickets` automatically adds $A$ to $B$'s `blocks` array.
- **DFS Cycle Detection:** `validateDAG()` builds an adjacency list and traverses with a recursion stack (`recStack`), terminating and rejecting the patch if any back-edge is encountered.
- **Dynamic Frontier Advancement:** Whenever a ticket's status changes to `resolved`, `patchTickets` automatically evaluates all remaining blocked tickets and promotes any ticket whose `blocked_by` tickets are all resolved to `status: "frontier"`.

### 2.4 Domain Schema Enhancements in `grill-with-docs-ui`
`server.mjs` in `grill-with-docs-ui` incorporates domain fields for ADRs and living documentation:
- `ticket.durable`: Boolean indicating whether the decision meets ADR criteria.
- `ticket.adr_file`: Filepath string pointing to the generated Markdown ADR (e.g. `docs/adr/0001-storage-engine.md`).
- `state.adrs`: Array of generated ADR filepaths or descriptor objects, managed via `patchAdrs`.
- `sessions` & `patch` CLI output: Automatically calculates and emits `adrs` and `terms` metrics alongside `frontier`, `resolved`, `blocked`, and `fog`.

---

## 3. Test Suite Audit & Findings

### 3.1 Unit Tests (`server.test.mjs`)
Both repositories possess comprehensive unit tests in `test/server.test.mjs`:
- `skills/wayfinder-ui/test/server.test.mjs`: 15 tests, 441 lines.
- `skills/grill-with-docs-ui/test/server.test.mjs`: 15 tests, 448 lines.

**Execution Result:**
```bash
node --test skills/wayfinder-ui/test/server.test.mjs && node --test skills/grill-with-docs-ui/test/server.test.mjs
# Output:
# wayfinder-ui:        15 passed, 0 failed (4.83s)
# grill-with-docs-ui:  15 passed, 0 failed (4.73s)
```
Both test suites exhaustively verify:
1. `new`: Key calculation outside git vs inside worktrees, state skeleton initialization.
2. `serve`: Startup ready line, `server.json` emission, atomic `/send` append, bad body rejection (HTTP 400), sequence resumption across server restarts.
3. Security: `/send` origin verification against cross-origin attacks (HTTP 403).
4. Fallback: `/visual` 404 JSON vs 200 HTML.
5. Port management: Port reuse and ephemeral fallback on collisions.
6. `url`: Daemon probing and fast-fail on missing daemons.
7. `sessions`: Sorting, default filtering of finished sessions, `--all` flag.
8. `pending`: Unhandled event calculation against `agent.handled`.
9. `patch`: Topological promotion, cycle detection errors, timestamp auto-stamping, `null` key deletion, and terms/fog/adrs array merging.
10. `wait`: Foreground blocking listener notifications and exit code 3 on timeouts.

---

### 3.2 E2E Browser Tests (`page.e2e.mjs`) & The `/visual?t=` Assertion Bug

Both skills include an end-to-end browser test in `test/page.e2e.mjs` designed to validate `page.html` against a live server.

#### Bug 1: Silent Skipping Due to Missing npm Module
In both test files:
```javascript
let chromium;
try {
  const pw = await import(process.env.PLAYWRIGHT_PKG || "@playwright/test");
  chromium = pw.chromium;
} catch (e) {
  console.log("Playwright not installed; skipping browser E2E tests. To run: npm install -D @playwright/test");
  process.exit(0);
}
```
Because `@playwright/test` is not installed as an npm package in the repository or skill directories, running `node test/page.e2e.mjs` directly silently exits with status code 0, masking all browser regressions in CI and local checks.

#### Bug 2: The `/visual?t=` Query Parameter Strict Equality Mismatch
When executed with a valid Playwright installation (by pointing `PLAYWRIGHT_PKG` to an available Playwright package, such as the system driver at `/home/linuxbrew/.linuxbrew/lib/python3.14/site-packages/playwright/driver/package/index.mjs`), **both test suites fail immediately on Step 5**:

```bash
PLAYWRIGHT_PKG=/home/linuxbrew/.linuxbrew/lib/python3.14/site-packages/playwright/driver/package/index.mjs node skills/wayfinder-ui/test/page.e2e.mjs
# Output:
# Starting browser check against http://127.0.0.1:40143/
# AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
# + actual - expected
# + '/visual?t=1790220986032'
# - '/visual'
#     at file:///.../skills/wayfinder-ui/test/page.e2e.mjs:177:10

PLAYWRIGHT_PKG=/home/linuxbrew/.linuxbrew/lib/python3.14/site-packages/playwright/driver/package/index.mjs node skills/grill-with-docs-ui/test/page.e2e.mjs
# Output:
# Starting browser check against http://127.0.0.1:42519/
# AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
# + actual - expected
# + '/visual?t=1790220992893'
# - '/visual'
#     at file:///.../skills/grill-with-docs-ui/test/page.e2e.mjs:181:10
```

#### Root Cause Analysis:
1. In [`skills/wayfinder-ui/assets/page.html:555`](file:///home/mezmo/Work/vibe/agent-skills/skills/wayfinder-ui/assets/page.html#L555) and [`skills/grill-with-docs-ui/assets/page.html:633`](file:///home/mezmo/Work/vibe/agent-skills/skills/grill-with-docs-ui/assets/page.html#L633):
   ```javascript
   const v = state.visual;
   if (v && v.version !== undefined && v.version !== lastVisualVersion) {
     lastVisualVersion = v.version;
     const frame = document.getElementById('visual-frame');
     if (frame) frame.src = '/visual?t=' + Date.now();
   }
   ```
2. When the test fixture initializes `state.visual` with `version: 1`, `page.html` detects that `version !== lastVisualVersion` (since `lastVisualVersion` is initialized to `null`). It immediately assigns a cache-busting timestamp `?t=<timestamp>` to the iframe's `src`.
3. In `test/page.e2e.mjs`:
   ```javascript
   await page.click("#toggle-visual");
   assert.equal(await page.getAttribute("#visual-frame", "src"), "/visual");
   ```
   The test performs a strict equality check against `"/visual"`, which fails because the actual attribute is `/visual?t=1790220...`.
4. **Correction:** The assertion must check against a regular expression:
   ```javascript
   assert.match(await page.getAttribute("#visual-frame", "src"), /^\/visual(\?t=\d+)?$/);
   // Or with @playwright/test web-first assertions:
   await expect(page.locator("#visual-frame")).toHaveAttribute("src", /^\/visual(\?t=\d+)?$/);
   ```

---

## 4. Complete Actionable Plan: Modernizing with `@playwright/test`

The current E2E tests are standalone Node.js automation scripts rather than true Playwright tests. They lack test fixtures, web-first auto-waiting assertions, parallel execution, isolated browser contexts, artifact capture (videos, screenshots, traces on failure), and webServer lifecycle management.

Below is the complete architectural refactoring plan to utilize `@playwright/test` natively.

### 4.1 Packaging Architecture: Root-Level Integration

Because this workspace is a meta-repository managing multiple skills, testing infrastructure should be consolidated at the workspace root to prevent duplicating `node_modules` and configurations across skills.

1. **Initialize Root `package.json`:**
   ```json
   {
     "name": "agent-skills-e2e",
     "version": "1.0.0",
     "private": true,
     "type": "module",
     "scripts": {
       "test": "npm run test:unit && npm run test:e2e",
       "test:unit": "node --test 'skills/*/test/server.test.mjs'",
       "test:e2e": "playwright test",
       "test:e2e:headed": "playwright test --headed",
       "test:e2e:ui": "playwright test --ui"
     },
     "devDependencies": {
       "@playwright/test": "^1.50.0"
     }
   }
   ```

2. **Git Ignore Configuration:**
   Add to repository root `.gitignore`:
   ```gitignore
   node_modules/
   test-results/
   playwright-report/
   blob-report/
   playwright/.cache/
   ```

---

### 4.2 Centralized Playwright Configuration (`playwright.config.mjs`)

Create [`playwright.config.mjs`](file:///home/mezmo/Work/vibe/agent-skills/playwright.config.mjs) at the workspace root:

```javascript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./skills",
  testMatch: "**/*.e2e.mjs",
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```

---

### 4.3 Reusable Playwright Fixture (`test/fixtures.mjs`)

Create a shared fixture that encapsulates session folder creation, server spawning, port discovery, and automatic cleanup, removing all boilerplate from individual skill test files:

```javascript
// test/fixtures.mjs
import { test as base, expect } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const test = base.extend({
  // Automatic fixture that creates a isolated session and runs server.mjs
  skillServer: async ({}, use, testInfo) => {
    const isGrillDocs = testInfo.file.includes("grill-with-docs-ui");
    const skillDir = isGrillDocs ? "skills/grill-with-docs-ui" : "skills/wayfinder-ui";
    const serverPath = join(process.cwd(), skillDir, "scripts", "server.mjs");
    
    const home = mkdtempSync(join(tmpdir(), "pw-home-"));
    const env = {
      ...process.env,
      WAYFINDER_HOME: home,
      GRILL_WITH_DOCS_UI_HOME: home,
    };

    const cmd = isGrillDocs
      ? ["new", "--topic", "E2E Architecture Test", "--doc", "docs/test-design.md"]
      : ["new", "--destination", "E2E Destination Test", "--doc", "docs/test-roadmap.md"];

    const { session } = JSON.parse(
      execFileSync(process.execPath, [serverPath, ...cmd], {
        encoding: "utf8",
        env,
        cwd: mkdtempSync(join(tmpdir(), "pw-proj-")),
      })
    );

    const child = spawn(process.execPath, [serverPath, "serve", "--session", session, "--port", "0"], {
      env,
      stdio: ["ignore", "pipe", "inherit"],
    });

    let readyUrl = "";
    await new Promise((resolve) => {
      let buf = "";
      child.stdout.on("data", (d) => {
        buf += d;
        const line = buf.split("\n")[0];
        if (line) {
          const ready = JSON.parse(line);
          readyUrl = ready.url;
          resolve();
        }
      });
    });

    // Provide context to the test
    await use({
      session,
      serverUrl: readyUrl,
      serverPath,
      env,
      writeState: (patch) => {
        const stateFile = join(session, "state.json");
        const current = JSON.parse(readFileSync(stateFile, "utf8"));
        writeFileSync(stateFile, JSON.stringify({ ...current, ...patch }, null, 2));
      },
      writeVisual: (html) => {
        writeFileSync(join(session, "visual.html"), html);
      },
    });

    // Cleanup daemon after test completes
    if (child.exitCode === null) {
      await new Promise((r) => {
        child.on("exit", r);
        child.kill();
      });
    }
  },
});

export { expect };
```

---

### 4.4 Refactoring E2E Tests to Native `@playwright/test`

Refactor [`skills/grill-with-docs-ui/test/page.e2e.mjs`](file:///home/mezmo/Work/vibe/agent-skills/skills/grill-with-docs-ui/test/page.e2e.mjs) into an idiomatic Playwright test specification:

```javascript
import { test, expect } from "../../../test/fixtures.mjs";

test.describe("grill-with-docs-ui browser application", () => {
  test.beforeEach(async ({ skillServer }) => {
    const now = new Date().toISOString();
    skillServer.writeState({
      topic: "E2E Distributed Architecture",
      terms: [{ term: "LogEntry", def: "An immutable command in consensus log.", avoid: ["record"] }],
      adrs: ["docs/adr/0001-storage-engine.md"],
      tickets: [
        {
          id: "t1",
          title: "Storage Engine Selection",
          type: "grilling",
          status: "resolved",
          durable: true,
          adr_file: "docs/adr/0001-storage-engine.md",
          blocked_by: [],
          blocks: ["t2", "t3"],
          question: "Which storage engine meets scale?",
          options: [
            { k: "A", text: "LSM Tree (RocksDB)" },
            { k: "B", text: "B-Tree (SQLite)" },
          ],
          rec: { option: "A", why: "Optimizes for heavy append throughput." },
          answer: { summary: "Adopted RocksDB", option: "A" },
          thread: [{ who: "user", text: "Why not B?", at: now }],
        },
        {
          id: "t2",
          title: "Replication Protocol",
          type: "grilling",
          status: "frontier",
          durable: true,
          blocked_by: ["t1"],
          blocks: [],
          question: "Choose consensus algorithm",
          options: [
            { k: "A", text: "Raft consensus" },
            { k: "B", text: "Multi-Paxos" },
          ],
          rec: { option: "A", why: "Clear leader lease model." },
          thread: [],
        },
        {
          id: "t3",
          title: "Network IOPS Validation",
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
      fog: [{ id: "fog-1", notes: "Split-brain resolution protocol" }],
      visual: {
        kind: "diagram",
        version: 1,
        at: now,
        stale: false,
        thread: [],
      },
    });
    skillServer.writeVisual("<!doctype html><title>Visual</title><h1>Architecture Graph</h1>");
  });

  test("renders topological DAG and validates decision staging workflow", async ({ page, skillServer }) => {
    await page.goto(skillServer.serverUrl);

    // 1. Topic & Counters Verification
    await expect(page.locator("#dest-display")).toHaveText("E2E Distributed Architecture");
    await expect(page.locator("#frontier-count")).toHaveText("2");
    await expect(page.locator("#resolved-count")).toHaveText("1");
    await expect(page.locator("#fog-count")).toHaveText("1");
    await expect(page.locator("#terms-count")).toHaveText("1");
    await expect(page.locator("#adrs-count")).toHaveText("3");

    // 2. SVG DAG Graph Render
    await expect(page.locator("#dag-svg g")).toHaveCount(3);

    // 3. Decision Card View Toggle
    await page.locator("#toggle-card").click();
    await expect(page.locator("#c-title")).toContainText(/Storage Engine Selection|Replication Protocol/);

    // 4. Staging Action and LocalStorage Persistence
    await page.locator(".nav-item", { hasText: "Replication Protocol" }).click();
    await page.locator(".opt-item", { hasText: "Raft consensus" }).click();
    await expect(page.locator("#staged-count")).toHaveText("1");

    await page.reload();
    await expect(page.locator("#staged-count")).toHaveText("1");

    // 5. Visual Prototype View with RegEx Cache-Busting Fix
    await page.locator("#toggle-visual").click();
    await expect(page.locator("#visual-frame")).toHaveAttribute("src", /^\/visual(\?t=\d+)?$/);

    // 6. Modals Verification (Glossary, ADRs, Finish)
    await page.locator("#terms-btn").click();
    await expect(page.locator("#terms-list")).toContainText("LogEntry");
    await page.locator("#terms-modal button", { hasText: "Close" }).click();

    await page.locator("#adrs-btn").click();
    await expect(page.locator("#adrs-list")).toContainText("Storage Engine Selection");
    await page.locator("#adrs-modal button", { hasText: "Close" }).click();

    await page.locator("#finish-btn").click();
    await expect(page.locator("#finish-modal")).toBeVisible();
    await expect(page.locator("#finish-frontier-count")).toHaveText("2");
    await page.locator("#finish-modal button", { hasText: "Cancel" }).click();
  });
});
```

---

### 4.5 Execution & Pre-Commit Hook Integration

1. **Install `@playwright/test` and Browsers:**
   ```bash
   npm install -D @playwright/test
   npx playwright install chromium
   ```

2. **Pre-commit Hook Alignment:**
   Integrate unit and E2E test verification into `.pre-commit-config.yaml` or workspace verification workflows (`uv run pre-commit run --all-files`):
   ```yaml
     - id: unit-tests
       name: Run Server Unit Tests
       entry: node --test skills/wayfinder-ui/test/server.test.mjs skills/grill-with-docs-ui/test/server.test.mjs
       language: system
       pass_filenames: false
   ```

---

## 5. Conclusion & Actionable Summary

1. **Parity Status:** `skills/grill-with-docs-ui` satisfies all requirements of feature parity with `skills/wayfinder-ui`, reproducing every layout container, navigation element, DAG visualizer, staging tray, modal, and persistence mechanic, while successfully adding the ADR and living glossary documentation system.
2. **Identified Assertion Defect:** The intermittent failure in E2E tests is caused by strict string equality (`assert.equal(..., "/visual")`) conflicting with `page.html`'s dynamic cache-busting query parameter (`/visual?t=<timestamp>`).
3. **Modernization Path:** Adopting the root-level `@playwright/test` plan will eliminate fragile hand-rolled daemon management, fix the regex assertion defect, and establish robust headless E2E verification across all current and future agent skills.
