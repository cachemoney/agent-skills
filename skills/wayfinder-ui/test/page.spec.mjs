import { test as base, expect } from "@playwright/test";
import { createServerRunner } from "../../../test/skill-fixture.mjs";

const now = new Date().toISOString();

const wayfinderFixture = (baseState) => ({
  ...baseState,
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
      thread: [
        { who: "user", text: "Why not B?", at: now },
        { who: "agent", text: "B cannot sustain writes.", at: now },
      ],
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

const test = base.extend({
  server: createServerRunner({
    skillName: "wayfinder-ui",
    homeEnvVar: "WAYFINDER_HOME",
    newArgs: ["--destination", "E2E Distributed Storage", "--doc", "docs/e2e-roadmap.md"],
    fixtureFactory: wayfinderFixture,
  }),
});

test.describe("wayfinder-ui frontend", () => {
  test("loads destination and renders stats counters", async ({ page, server }) => {
    await page.goto(server.url);
    await expect(page.locator("#dest-display")).toHaveText("E2E Distributed Storage");
    await expect(page.locator("#frontier-count")).toHaveText("2");
    await expect(page.locator("#resolved-count")).toHaveText("1");
    await expect(page.locator("#fog-count")).toHaveText("1");
  });

  test("renders topological SVG DAG nodes", async ({ page, server }) => {
    await page.goto(server.url);
    const nodes = page.locator("#dag-view g");
    await expect(nodes).toHaveCount(3);
  });

  test("switches to Decision Card view", async ({ page, server }) => {
    await page.goto(server.url);
    await page.click("#toggle-card");
    const title = page.locator("#c-title");
    await expect(title).toBeVisible();
    await expect(title).toContainText(/(Storage Engine Selection|Replication Protocol)/);
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

  test("opens and closes domain terms modal", async ({ page, server }) => {
    await page.goto(server.url);
    await page.click("#terms-btn");
    await expect(page.locator("#terms-modal")).toBeVisible();
    await expect(page.locator("#terms-list")).toContainText("Frontier");
    await page.locator("#terms-modal button", { hasText: "Close" }).click();
    await expect(page.locator("#terms-modal")).toBeHidden();
  });

  test("opens and validates finish map confirmation modal", async ({ page, server }) => {
    await page.goto(server.url);
    await page.click("#finish-btn");
    await expect(page.locator("#finish-modal")).toBeVisible();
    await expect(page.locator("#finish-frontier-count")).toHaveText("2");
    await page.locator("#finish-modal button", { hasText: "Cancel" }).click();
    await expect(page.locator("#finish-modal")).toBeHidden();
  });
});
