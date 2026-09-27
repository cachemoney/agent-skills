---
name: grill-with-docs-ui
description: Relentless design and architecture interview on a local browser UI that sharpens decisions and produces ADRs and domain glossary (CONTEXT.md) in real time. Use when the user says "grill with docs ui", invokes /grill-with-docs-ui, or asks to grill/architect a design with docs and UI.
compatibility: Requires Node.js >= 18
license: MIT
metadata:
  author: cachemoney
---

# grill-with-docs-ui

`$SKILL` below refers to this skill's root directory. Everything runs on plain Node.js with zero install steps: `node $SKILL/scripts/server.mjs <command>`.

Two files coordinate the session:
1. `state.json` is **yours alone**: Topic, Notes, Ticket DAG, Fog of War, Decisions So Far, Terms, ADRs, Out of Scope, and Agent Status. You modify it **exclusively** via `node $SKILL/scripts/server.mjs patch`.
2. `events.jsonl` is **the browser page's alone**: an append-only log of user interactions and staged actions, written one line per Send.

Living repository documentation is maintained **during** the interview:
- `CONTEXT.md` at repo root: updated inline as glossary terms settle.
- `docs/adr/<NNNN>-<slug>.md`: created inline when a decision meets the ADR criteria.

---

## Listening Mode and Turn Boundaries

Detect your listening mode from the tools available in your harness:

- **Persistent Monitor Mode:** If your harness delivers stdout events to the agent even after a turn ends (e.g. Claude Code's persistent Monitor tool), launch the server under Monitor and end the turn. The next browser Send will wake you automatically.
- **Wait Mode (Universal Loop):** In harnesses without persistent process wakeups (Antigravity / Gemini CLI, Codex, Cursor, GitHub Copilot), a running background server will **not** wake an ended turn. You must run the server detached (`nohup ... &`) and keep a foreground loop active calling `node $SKILL/scripts/server.mjs wait --session <dir> --after <handled> --timeout 480`. When a send arrives, `wait` prints it and exits 0; handle the turn and loop again.

**Return to listening** means re-entering the appropriate mode above. Do not exit or conclude the session merely because one decision was answered or a round of decisions was charted.

---

## Patching state.json

You change `state.json` **only through `patch`**, never by writing the whole file directly.

```sh
node $SKILL/scripts/server.mjs patch --session <session> <<'GDU_PATCH'
{
  "agent": { "status": "waiting", "handled": 3 },
  "tickets": [
    {
      "id": "t1",
      "status": "resolved",
      "answer": { "kind": "option", "option": "A", "summary": "Adopt LSM Tree (RocksDB) for write throughput." }
    },
    {
      "id": "t2",
      "title": "Replication protocol",
      "type": "grilling",
      "durable": true,
      "blocked_by": ["t1"],
      "question": "Which consensus algorithm ensures partition tolerance?",
      "options": [
        { "k": "A", "text": "Raft consensus" },
        { "k": "B", "text": "Primary-backup with sync replication" }
      ],
      "rec": { "option": "A", "why": "Raft provides strict linearizability and automated leader election." }
    }
  ],
  "terms": [
    { "term": "LogEntry", "def": "An immutable command appended to the Raft log.", "avoid": ["record", "event"] }
  ],
  "fog": [
    { "id": "fog-1", "title": "Snapshot compaction schedule", "notes": "Depends on write volume." }
  ]
}
GDU_PATCH
```

### Patch Rules
- `null` deletes a key: `"active_ticket_id": null`.
- `agent`, `tracker`, and `visual` merge one level.
- `tickets` is keyed by `id`. Existing IDs merge fields. New IDs require `title` and `type` (`grilling`, `research`, `prototype`, `task`). Status defaults to `frontier` (or `blocked` if `blocked_by` is provided).
- Reverse dependency edges (`blocks`) and frontier recalculations are computed automatically by the server during patch validation.
- `thread` messages append: include only new entries; timestamps are auto-filled if omitted.
- `terms` merges by `term`.
- `fog` merges by `id` (or appends new item if `id` is omitted).

---

## Start (`/grill-with-docs-ui <topic>`)

1. From the project root, create a new session:
   ```sh
   node $SKILL/scripts/server.mjs new --topic "<topic>"
   ```
   Save the returned JSON output (`session`).
2. Chart the initial map via `patch`:
   - Set `"topic"` and `"notes"`.
   - Specify 1 to 3 initial independent frontier decision tickets (`status: "frontier"`). Each with lettered options, a recommendation with trade-off rationale (`rec: { option, why }`).
   - Add initial in-scope unknowns into `"fog"`.
   - Set `"agent": { "status": "waiting" }`.
3. Launch the server:
   - *Monitor Mode:* Open persistent Monitor with command `node $SKILL/scripts/server.mjs serve --session <session>`.
   - *Wait Mode:* Run `nohup node $SKILL/scripts/server.mjs serve --session <session> > <session>/serve.log 2>&1 &`.
4. Fetch the running server URL:
   ```sh
   node $SKILL/scripts/server.mjs url --session <session>
   ```
5. Print ONE clean message to the terminal with the URL and a brief summary of the frontier decisions ready for review.
6. **Return to listening.**

---

## Resume (`/grill-with-docs-ui resume`)

1. Discover existing sessions:
   ```sh
   node $SKILL/scripts/server.mjs sessions
   ```
2. Select the session (or ask user if multiple exist).
3. Drain queued sends made while offline:
   ```sh
   node $SKILL/scripts/server.mjs pending --session <session>
   ```
   Apply all pending sends in order, finishing with a single patch whose `agent.handled` is the latest seq.
4. Ensure the server is serving (`serve` reuses previous port), retrieve the URL with `url`, and return to listening.

---

## Handling a Send

When a line arrives with `"type":"send"`, it contains an array of `actions` staged by the user in the web UI.

1. Immediately patch `{ "agent": { "status": "working" } }`.
2. Process the `actions` in order:
   - `answer_ticket` $\rightarrow$ Set ticket's `status: "resolved"`, record `answer: { kind, option, text, summary }`.
     Downstream blocked tickets automatically promote to `frontier`!
     **ADR Check:** If the decision is durable (marked `durable: true` or passes the 3 ADR gates), generate or update `docs/adr/<NNNN>-<slug>.md` immediately and link `adr_file` in the ticket patch.
   - `thread_message` $\rightarrow$ Append `{ who: "user", text, at }` to ticket's `thread`, followed by your reply `{ who: "agent", text }`.
   - `toggle_adr` $\rightarrow$ Toggle ticket's `durable` boolean.
   - `add_term` $\rightarrow$ Add or update `terms` entry `{ term, def, avoid }`.
     **Glossary Check:** Update `CONTEXT.md` inline in the repository with the new canonical term.
   - `explore` $\rightarrow$ Research and populate `ticket.explore: { rows: [{ option, pros: [...], cons: [...] }] }`. Be honest about pros and cons for each option.
   - `graduate_fog` $\rightarrow$ Remove the item from `fog` and create a new ticket entry in `tickets` with the specified dependencies.
   - `rule_out_of_scope` $\rightarrow$ Set ticket's `status: "out_of_scope"` and record reason in `out_of_scope`.
   - `trigger_research` $\rightarrow$ Launch a background research subagent (see below).
   - `visualize` / `visual-feedback` $\rightarrow$ Trigger visual subagent redraw (see below).
   - `finish` $\rightarrow$ Transition to Finish workflow.
3. Ordinary turns do not redraw visuals: if decisions affect what an existing visual shows, set `"visual": { "stale": true }`.
4. Commit all state changes in **ONE single patch** together with:
   `"agent": { "status": "waiting", "handled": <seq> }`
5. Print one line to stdout:
   `grill-with-docs: handled send #<seq>; <frontier_count> frontier decisions remain.`
6. **Return to listening.**

---

## Living Documentation System

### 1. Glossary (`CONTEXT.md`)
- Maintain `state.terms` in every session.
- Update `CONTEXT.md` inline at the project root the moment terms settle.
- Rules:
  - `CONTEXT.md` is strictly a domain glossary—it contains **zero** implementation details.
  - Format per term:
    ```markdown
    ## <Term>
    <Single sentence definition describing what it is in the domain.>

    **Avoid:** <word1>, <word2>
    ```

### 2. Architecture Decision Records (`docs/adr/`)
Produce an ADR in `docs/adr/<NNNN>-<slug>.md` when all three gates pass:
1. **Hard to reverse:** The cost of changing your mind later is significant.
2. **Surprising without context:** A future reader will wonder why this approach was picked.
3. **Real trade-off:** Viable alternatives existed and one was chosen for specific reasons.

Number ADRs sequentially (`0001`, `0002`, ...). Format:
```markdown
# <NNNN>: <Title>

## Context & Decision
<Problem, alternatives considered, chosen path, trade-offs>

## Consequences
- <Positive consequence>
- <Negative consequence / constraint>
```

---

## Background Research & Visuals

### Research Subagents
When a ticket of type `research` is claimed or triggered:
1. Spin up a background research subagent with codebase and doc inspection tools.
2. The subagent writes findings to `<session>/research/<ticket-id>.md`.
3. When complete, patch the ticket with `status: "resolved"`, link the asset, and promote downstream tickets.

### Visual Architecture & Prototypes
When user triggers `visualize` or sends `visual-feedback`:
1. Launch a subagent with `$SKILL/references/visual-brief.md`.
2. Subagent renders `<session>/visual.html`.
3. When the subagent completes, patch `"visual": { "version": <v+1>, "note": "...", "drawing": null }`.

---

## Finish

When the user clicks Finish or triggers `finish`:
1. Compile the comprehensive Design Document to `doc` (default: `docs/<topic>-design.md`):
   - **Summary & Purpose** (linking visual and all generated ADRs)
   - **Glossary** (table of defined terms and avoid lists)
   - **Architecture Decisions Locked** (all resolved tickets, rationale, trade-offs)
   - **Routine Choices** (non-durable choices)
   - **Dependency Graph** (topological order)
   - **Risks & Invariants**
   - **Out of Scope Boundaries**
2. Ensure `CONTEXT.md` contains all settled terms.
3. If a visual exists, copy `<session>/visual.html` to `docs/<topic>-visual.html`.
4. Patch `"finished": { "doc": "<path>", "at": "ISO" }` and `"agent": { "status": "waiting" }`.
5. Stop the server daemon.
6. Print the generated document path and conclude.

---

## Wait Mode Reference Loop

```sh
# Ensure server is running detached
nohup node $SKILL/scripts/server.mjs serve --session <session> > <session>/serve.log 2>&1 &

# Agent foreground execution loop
while true; do
  PENDING=$(node $SKILL/scripts/server.mjs pending --session <session>)
  if [ -n "$PENDING" ]; then
    # Handle pending lines...
    continue
  fi

  SEND=$(node $SKILL/scripts/server.mjs wait --session <session> --after <handled> --timeout 480)
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 0 ]; then
    # Parse SEND JSON, process actions, patch state.json with handled=seq
    continue
  elif [ $EXIT_CODE -eq 3 ]; then
    # Idle timeout: loop and wait again
    continue
  else
    break
  fi
done
```
