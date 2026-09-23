# Agent Skills & Wayfinder

Architecture and planning skills for AI agent collaboration across complex codebases.

## Language

**Destination**:
The high-level architectural goal or epic boundary defining the scope of a wayfinding effort.
_Avoid_: Topic, project, goal

**Decision Ticket**:
A discrete architectural fork in the road (`grilling`, `research`, `prototype`, `task`) with options, trade-offs, and dependency edges.
_Avoid_: Task, issue, story, todo

**Frontier**:
The dynamic subset of decision tickets whose prerequisites are 100% resolved and are actionable now.
_Avoid_: Backlog, active, open questions

**Fog of War**:
Uncharted, loosely bounded in-scope unknowns that have not yet graduated into concrete tickets.
_Avoid_: Backlog, ideas, out of scope

**Staged Actions**:
User decisions and messages queued locally in the browser awaiting explicit batch transmission.
_Avoid_: Drafts, submissions, unsaved changes

**Pending Queue**:
Action batches posted to `/send` that have not yet been acknowledged by the agent via `agent.handled >= seq`.
_Avoid_: Inflight, processing, unhandled

**Split Ownership**:
The concurrency model where the agent exclusively mutates `state.json` via atomic patch renames, and the client exclusively appends to `events.jsonl`.
_Avoid_: Two-way binding, shared state
