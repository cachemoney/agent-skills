## Agent skills

### Issue tracker

Issues and specs are tracked in GitHub Issues using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default five canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context documentation layout (`CONTEXT.md` and `docs/adr/` at repo root). See `docs/agents/domain.md`.

### Polyglot skills testing

Browser-based skills (`wayfinder-ui`, `grill-with-docs-ui`) use Playwright for E2E testing. While workspace tools and Python packages use `uv`, Node dependencies for browser testing are managed via `npm test` at the workspace root. See `docs/adr/0003-centralized-playwright-e2e-testing-for-polyglot-skills.md`.
