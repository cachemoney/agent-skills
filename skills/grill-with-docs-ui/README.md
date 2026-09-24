# grill-with-docs-ui

An interactive design interview and domain modeling skill for AI coding assistants. Conducts relentless design grilling interviews on a local browser dashboard while actively producing Architecture Decision Records (ADRs) and domain glossary (`CONTEXT.md`) in real time.

## Key Features

- **Interactive Decision DAG:** Visualizes the full dependency tree between design and architectural decisions.
- **Living Domain Glossary (`CONTEXT.md`):** Tracks domain terms with definitions and avoid lists, updating `CONTEXT.md` inline as vocabulary crystallizes.
- **Automated ADR Production:** Identifies decisions meeting the three ADR criteria (hard to reverse, surprising without context, real trade-off) and drafts ADRs in `docs/adr/<NNNN>-<slug>.md`.
- **Dynamic Frontier Tracking:** Automatically advances downstream decisions as prerequisites are resolved.
- **Card-Based Decision Staging:** Pick recommendations, explore pros/cons comparison tables, write custom answers, and stage actions with full `localStorage` crash persistence.
- **Visual Prototypes & Architecture Diagrams:** Background subagent generates interactive visual mockups or system diagrams without polluting main conversation tokens.
- **Zero Dependencies:** Pure Node.js runtime (`node:http`, `node:fs`) and vanilla HTML/SVG/CSS with zero install steps.
- **Universal Multi-Agent Compatibility:** Supports both persistent Monitor mode (Claude Code) and foreground Wait mode loop (Antigravity / Gemini CLI, Codex, Cursor, GitHub Copilot).

## Usage

Start a design interview on any architectural topic or feature proposal:

```
/grill-with-docs-ui <topic or architectural decision>
```

Resume an ongoing session:

```
/grill-with-docs-ui resume
```

## Running Tests

```sh
node --test skills/grill-with-docs-ui/test/server.test.mjs
```
