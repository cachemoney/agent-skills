import { test as base, expect } from "@playwright/test";
import { createServerRunner } from "../../../test/skill-fixture.mjs";

const now = new Date().toISOString();

const grillFixture = (baseState) => ({
  ...baseState,
  topic: "E2E Distributed Architecture",
  agent: { status: "waiting", since: now, handled: 0 },
  terms: [{ term: "LogEntry", def: "An immutable command in the consensus log.", avoid: ["record"] }],
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
      thread: [
        { who: "user", text: "Why not B?", at: now },
        { who: "agent", text: "B cannot sustain write volume.", at: now },
      ],
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
      durable: false,
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

const test = base.extend({
  server: createServerRunner({
    skillName: "grill-with-docs-ui",
    homeEnvVar: "GRILL_WITH_DOCS_UI_HOME",
    newArgs: ["--topic", "E2E Distributed Architecture", "--doc", "docs/e2e-design.md"],
    fixtureFactory: grillFixture,
  }),
});

test.describe("grill-with-docs-ui frontend", () => {
  test("loads topic, frontier, glossary, and ADR counters", async ({ page, server }) => {
    await page.goto(server.url);
    await expect(page.locator("#dest-display")).toHaveText("E2E Distributed Architecture");
    await expect(page.locator("#frontier-count")).toHaveText("2");
    await expect(page.locator("#resolved-count")).toHaveText("1");
    await expect(page.locator("#fog-count")).toHaveText("1");
    await expect(page.locator("#terms-count")).toHaveText("1");
    await expect(page.locator("#adrs-count")).toHaveText("3"); // t1, t2, state.adrs[0]
  });

  test("renders topological SVG DAG with ADR badge styling", async ({ page, server }) => {
    await page.goto(server.url);
    const nodes = page.locator("#dag-view g");
    await expect(nodes).toHaveCount(3);
    await expect(page.locator("#dag-view")).toContainText("ADR");
  });

  test("switches to Decision Card view and verifies ADR tag", async ({ page, server }) => {
    await page.goto(server.url);
    await page.click("#toggle-card");
    const title = page.locator("#c-title");
    await expect(title).toBeVisible();
    await expect(title).toContainText(/(Storage Engine Selection|Replication Protocol)/);
    await expect(page.locator("#c-adr-tag")).toBeVisible();
  });

  test("persists staged decisions in localStorage across page reloads", async ({ page, server }) => {
    await page.goto(server.url);
    await page.click("#toggle-card");
    await page.locator(".nav-item", { hasText: "Replication Protocol" }).click();
    await page.locator(".opt-item", { hasText: "Raft consensus" }).click();
    await expect(page.locator("#staged-count")).toHaveText("1");

    await page.reload();
    await expect(page.locator("#staged-count")).toHaveText("1");
  });

  test("renders visual prototype frame with cache-busting timestamp", async ({ page, server }) => {
    await page.goto(server.url);
    await page.click("#toggle-visual");
    await expect(page.locator("#visual-frame")).toHaveAttribute("src", /^\/visual(\?t=\d+)?$/);
  });

  test("opens and validates living glossary modal", async ({ page, server }) => {
    await page.goto(server.url);
    await page.click("#terms-btn");
    await expect(page.locator("#terms-modal")).toBeVisible();
    await expect(page.locator("#terms-list")).toContainText("LogEntry");
    await page.locator("#terms-modal button", { hasText: "Close" }).click();
    await expect(page.locator("#terms-modal")).toBeHidden();
  });

  test("opens and inspects Architecture Decision Records (ADRs) modal", async ({ page, server }) => {
    await page.goto(server.url);
    await page.click("#adrs-btn");
    await expect(page.locator("#adrs-modal")).toBeVisible();
    await expect(page.locator("#adrs-list")).toContainText("Storage Engine Selection");
    await page.locator("#adrs-modal button", { hasText: "Close" }).click();
    await expect(page.locator("#adrs-modal")).toBeHidden();
  });

  test("opens and validates finish design interview confirmation modal", async ({ page, server }) => {
    await page.goto(server.url);
    await page.click("#finish-btn");
    await expect(page.locator("#finish-modal")).toBeVisible();
    await expect(page.locator("#finish-frontier-count")).toHaveText("2");
    await expect(page.locator("#finish-adr-count")).toHaveText("3");
    await page.locator("#finish-modal button", { hasText: "Cancel" }).click();
    await expect(page.locator("#finish-modal")).toBeHidden();
  });
});
