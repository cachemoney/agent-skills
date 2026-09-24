# 0003: Centralized Playwright E2E Testing for Polyglot Agent Skills

## Context & Decision

Our meta-repository operates under a workspace convention that exclusively uses `uv` for Python package and environment management. However, several agent skills (`wayfinder-ui`, `grill-with-docs-ui`) are polyglot skills whose runtime daemons and interactive user interfaces are built in JavaScript and Node.js (`server.mjs`, `page.html`).

Previously, end-to-end browser testing was performed via hand-rolled Node automation scripts (`test/page.e2e.mjs`) importing `{ chromium }` directly. These scripts lacked auto-waiting assertions, parallel execution, isolated fixture lifecycles, and HTML report generation. Additionally, strict string equality checks on dynamic cache-busting URLs (`frame.src = '/visual?t=' + Date.now()`) resulted in fragile test failures.

We decided to adopt a **hybrid testing architecture**:
1. **Centralized Root Playwright Configuration:**
   - Introduce a root `package.json` with `"type": "module"` and `@playwright/test` under `devDependencies`.
   - Configure a centralized `playwright.config.mjs` targeting all skill test specs (`skills/*/test/*.spec.mjs`).
   - Amend workspace documentation (`agent-docs/workspace-development.md` and `AGENTS.md`) to explicitly clarify that while Python dependencies are strictly managed by `uv`, JavaScript/Node tooling for skill development and E2E browser tests is managed via `npm`.
2. **Zero-Dependency Skill Portability:**
   - Skills remain completely zero-dependency runtimes when consumed in target repositories (`node $SKILL/scripts/server.mjs`).
   - The distributed skill directories (`skills/wayfinder-ui`, `skills/grill-with-docs-ui`) do not contain `package.json` or `node_modules` folders, preventing dependency pollution when transpiled and symlinked.
   - Retain the standalone `test/page.e2e.mjs` scripts with fixed regex assertions as zero-install fallbacks for minimal agent environments lacking `@playwright/test`.
3. **Isolated Test Server Fixture (`test/skill-fixture.mjs`):**
   - Provide a shared Playwright test fixture (`test.extend<{ skillServer }>`) that provisions temporary directories, generates dynamic sessions, binds to ephemeral ports (`--port 0`), and cleanly handles process teardown on exit.

## Consequences

- End-to-end browser testing across all interactive UI skills can be executed in parallel using modern web-first assertions (`await expect(locator).toHaveText(...)`, auto-waiting, trace viewers).
- Distributed agent skills maintain zero-dependency portability without bloating consumer repositories.
- The `uv` exclusivity rule remains preserved for all Python scripts, CLI tools, and workspace infrastructure, with Node.js explicitly authorized for skill UI testing.
