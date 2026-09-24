# grill-with-docs-ui — Design Document

## Core Concepts & Terms

- **Topic / Epic:** The subject under design or architectural inquiry.
- **Frontier:** The set of open decision tickets whose prerequisites (`blocked_by`) are completely resolved. These represent the immediate questions actionable right now.
- **Decision Ticket:** A scoped question whose resolution commits the project to a design path, technology, or trade-off. Can be flagged as `durable` to generate an ADR.
- **Durable Decisions & ADRs:** Decisions that meet the 3 ADR criteria (hard to reverse, surprising without context, real trade-off) automatically produce an Architecture Decision Record in `docs/adr/<NNNN>-<slug>.md`.
- **Glossary & Terms:** Domain vocabulary tracked in `state.terms` and synchronized inline with `CONTEXT.md` in the repository root.
- **Fog of War:** Open unknowns or broad areas known to be relevant but not yet sharp enough to frame into an actionable ticket. Can be graduated into decision tickets.
- **Out of Scope:** Boundaries and tangents consciously ruled out of the current effort.

## Architectural Foundations

1. **Split-Ownership IPC:**
   - `state.json` is modified solely by the agent through `node server.mjs patch`.
   - `events.jsonl` is written solely by `server.mjs` upon receiving client `POST /send` batches.
   - Eliminates race conditions and supports offline queuing and session resumption.

2. **Topological Frontier Propagation & Cycle Detection:**
   - Tickets declare dependencies via `blocked_by`.
   - `server.mjs` maintains reverse edges (`blocks`), detects dependency cycles via DFS, and automatically promotes `blocked` tickets to `frontier` as upstream prerequisites are resolved.

3. **Client-Side Persistence & Crash Resilience:**
   - Client state in `page.html` (staged actions, pending submissions, form drafts, active view) is persisted in browser `localStorage` keyed by `grill-docs:<project>:<created>`.
   - In-flight batches remain in a persistent `pending` queue with visual spinners until acknowledged by the agent via `agent.handled >= seq`.

4. **Living Documentation ("With Docs"):**
   - Decisions and glossary terms crystallize directly into repository artifacts (`CONTEXT.md`, `docs/adr/`, `docs/<slug>-design.md`) during the interview rather than as a post-session afterthought.
