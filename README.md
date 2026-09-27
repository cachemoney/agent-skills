# Agent Skills

A collection of custom polyglot skills for AI coding agents following the [Agent Skills specification](https://agentskills.io/specification).

## Included Skills

- **[`grill-with-docs-ui`](skills/grill-with-docs-ui)**: Relentless design and architecture interview on a local browser UI that sharpens decisions and produces ADRs and domain glossary (`CONTEXT.md`) in real time.
- **[`wayfinder-ui`](skills/wayfinder-ui)**: Plan large architectural efforts too big for one session as an interactive map of decision tickets on a local browser UI. View the decision DAG, resolve frontier tickets, discuss alternatives, and push back the fog of war.

## Architecture

Skills in this repository are **polyglot skills**:
- Interactive web interfaces and local server daemons run directly on Node.js (`server.mjs`, `page.html`).
- Zero global dependencies needed by consuming agents; daemons use standard Node.js APIs.
- Self-contained test suite using Node's native test runner for units and Playwright for browser E2E tests.

## Testing

```bash
# Install test dependencies
npm install

# Run unit tests (server daemons)
npm run test:unit

# Run Playwright E2E browser tests
npm run test:e2e

# Run complete test suite
npm test
```

## License

MIT
