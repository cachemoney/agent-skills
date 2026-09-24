# wayfinder-ui — Design Document

## Core Concepts & Terms

- **Destination:** The overarching outcome or deliverable this effort is finding its way toward (e.g. an architectural spec, migration strategy, or system design).
- **Frontier:** The set of open, unblocked decision tickets whose prerequisites are completely settled and are actionable right now.
- **Decision Ticket:** A scoped question whose answer represents an architectural commitment or fork-in-the-road choice, rather than a slice of code execution.
- **Fog of War:** In-scope decisions and investigations recognized as upcoming, but not yet sharp or bounded enough to formulate as an actionable ticket.
- **Out of Scope:** Ideas or tangents consciously ruled out of the current effort.

## Architectural Decisions

1. **Split-Ownership IPC:**
   - `state.json` is modified solely by the agent through `node server.mjs patch`.
   - `events.jsonl` is written solely by `server.mjs` upon receiving client `POST /send` batches.
   - Eliminates distributed race conditions and allows persistent crash-resilient resumes.

2. **Topological Frontier Propagation:**
   - Dependency relationships (`blocked_by` / `blocks`) form a strict Directed Acyclic Graph (DAG).
   - Resolving ticket $A$ automatically updates downstream ticket $B$'s status from `blocked` to `frontier` without requiring manual status edits.

3. **Context Frugality:**
   - Instead of streaming the entire state back and forth, the agent emits minimal JSON patches containing only mutated fields.
   - Subagents handle heavy HTML rendering for visuals (`visual.html`) and research legwork (`research/*.md`), preventing markup bloat in the main planning context.
