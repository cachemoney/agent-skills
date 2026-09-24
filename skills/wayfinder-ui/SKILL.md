---
name: wayfinder-ui
description: Plan large architectural efforts too big for one session as an interactive map of decision tickets on a local browser UI. View the decision DAG, resolve frontier tickets, discuss alternatives, and push back the fog of war. Use when the user says "wayfinder with ui", invokes /wayfinder-ui with a topic or destination, or says "/wayfinder-ui resume".
compatibility: Requires Node.js >= 18
license: MIT
metadata:
  author: cachemoney
---

# wayfinder-ui

`$SKILL` below refers to this skill's root directory. Everything runs on plain Node.js with zero install steps: `node $SKILL/scripts/server.mjs <command>`.

Two files coordinate the session:
1. `state.json` is **yours alone**: Destination, Notes, Ticket DAG, Fog of War, Decisions So Far, Out of Scope, and Agent Status. You modify it **exclusively** via `node $SKILL/scripts/server.mjs patch`.
2. `events.jsonl` is **the browser page's alone**: an append-only log of user interactions and staged actions, written one line per Send.

## Listening Mode and Turn Boundaries

Detect your listening mode from the tools available in your harness:

- **Persistent Monitor Mode:** If your harness delivers stdout events to the agent even after a turn ends (e.g. Claude Code's persistent Monitor tool), launch the server under Monitor and end the turn. The next browser Send will wake you automatically.
- **Wait Mode (Universal Loop):** In harnesses without persistent process wakeups (Gemini CLI, Codex, Cursor, GitHub Copilot), a running background server will **not** wake an ended turn. You must run the server detached (`nohup ... &`) and keep a foreground loop active calling `node $SKILL/scripts/server.mjs wait --session <dir> --after <handled> --timeout 480`. When a send arrives, `wait` prints it and exits 0; handle the turn and loop again.

**Return to listening** means re-entering the appropriate mode above. Do not exit or conclude the session merely because one ticket was answered or a round of tickets was charted.

## Patching state.json

You change `state.json` **only through `patch`**, never by writing the whole file. Whole-file writes blow up context token counts over multi-hour planning sessions.

```sh
node $SKILL/scripts/server.mjs patch --session <session> <<'WF_PATCH'
{
  "agent": { "status": "waiting", "handled": 3 },
  "tickets": [
    {
      "id": "t1",
      "status": "resolved",
      "answer": { "summary": "Use native declarative partitioning with pg_partman." }
    },
    {
      "id": "t3",
      "title": "Partition key distribution",
      "type": "grilling",
      "blocked_by": ["t1"],
      "question": "Should partitions partition by range or by hash?",
      "options": [
        { "k": "A", "text": "Range by event_timestamp (monthly)" },
        { "k": "B", "text": "Hash by tenant_id" }
      ],
      "rec": { "option": "A", "why": "Analytical queries always query time windows." }
    }
  ],
  "fog": [
    { "id": "fog-1", "title": "Cross-shard rollup queries", "notes": "Depends on query volume." }
  ]
}
WF_PATCH
```

### Patch Rules
- `null` deletes a key: `"active_ticket_id": null`.
- `agent`, `tracker`, and `visual` merge one level.
- `tickets` is keyed by `id`. Existing IDs merge fields. New IDs require `title` and `type` (`grilling`, `research`, `prototype`, `task`). Status defaults to `frontier` (or `blocked` if `blocked_by` is provided).
- Reverse dependency edges (`blocks`) and frontier recalculations are computed automatically by the server during patch validation.
- `thread` messages append: include only new entries; timestamps are auto-filled if omitted.

---

## Start (`/wayfinder-ui <destination>`)

1. From the project root, create a new session:
   ```sh
   node $SKILL/scripts/server.mjs new --destination "<destination>"
   ```
   Save the returned JSON output (`session`).
2. Chart the initial map via `patch`:
   - Set `"destination"` and `"notes"`.
   - Specify 1 to 3 initial independent frontier decision tickets (`status: "frontier"`).
   - Add initial in-scope unknowns into `"fog"`.
   - Set `"agent": { "status": "waiting" }`.
3. Launch the server:
   - *Monitor Mode:* Open persistent Monitor with command `node $SKILL/scripts/server.mjs serve --session <session>`.
   - *Wait Mode:* Run `nohup node $SKILL/scripts/server.mjs serve --session <session> > <session>/serve.log 2>&1 &`.
4. Fetch the running server URL:
   ```sh
   node $SKILL/scripts/server.mjs url --session <session>
   ```
5. Print ONE clean message to the terminal with the URL and a brief summary of the frontier tickets ready for review.
6. **Return to listening.**

---

## Resume (`/wayfinder-ui resume`)

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
   - `claim_ticket` $\rightarrow$ Set ticket's `assignee` to dev or agent.
   - `answer_ticket` $\rightarrow$ Set ticket's `status: "resolved"`, record `answer: { summary, option, text }`. Downstream blocked tickets automatically promote to `frontier`!
   - `thread_message` $\rightarrow$ Append `{ who: "user", text, at }` to ticket's `thread`, followed by your reply `{ who: "agent", text }`.
   - `graduate_fog` $\rightarrow$ Remove the item from `fog` and create a new ticket entry in `tickets` with the specified dependencies.
   - `rule_out_of_scope` $\rightarrow$ Set ticket's `status: "out_of_scope"` and record reason in `out_of_scope`.
   - `trigger_research` $\rightarrow$ Launch a background research subagent (see below).
   - `finish_map` $\rightarrow$ Transition to Finish workflow.
3. Commit all changes in **ONE single patch** together with:
   `"agent": { "status": "waiting", "handled": <seq> }`
4. Print one line to stdout:
   `wayfinder: handled send #<seq>; <frontier_count> frontier tickets remain.`
5. **Return to listening.**

---

## Background Research & Visuals

### Research Subagents (AFK Tickets)
When a ticket of type `research` is claimed or triggered:
1. Do not block the user conversation. Spin up a background subagent equipped with research and documentation reading tools.
2. Have the subagent capture findings in `<session>/research/<ticket-id>.md`.
3. When the subagent finishes, patch the ticket with `status: "resolved"`, link the asset, and promote downstream tickets.

### Visual Architecture & Roadmap (Visualize)
If the user requests a visual or diagram:
1. Dispatch a subagent with `$SKILL/references/visual-brief.md`.
2. The subagent generates `<session>/visual.html`.
3. When the subagent finishes, bump `visual.version` in `state.json` via patch.

---

## Finish

When the user triggers `finish_map` (or all frontier tickets are resolved and fog is clear):
1. Compile the comprehensive Roadmap & Decision Record to `doc` (default: `docs/<destination>-roadmap.md`).
   Include:
   - **Destination & Purpose**
   - **Architecture Decisions Locked** (all resolved tickets, rationale, trade-offs)
   - **Dependency Execution Graph** (topological build order)
   - **Risks & Open Invariants**
   - **Out of Scope Boundaries**
2. Patch `"finished": { "doc": "<path>", "at": "ISO" }` and `"agent": { "status": "waiting" }`.
3. Stop the server daemon.
4. Print the generated roadmap document path and conclude.

---

## Wait Mode Reference Loop

```sh
# Ensure server is running detached
nohup node $SKILL/scripts/server.mjs serve --session <session> > <session>/serve.log 2>&1 &

# Agent foreground execution loop
while true; do
  # Drain any unhandled sends first
  PENDING=$(node $SKILL/scripts/server.mjs pending --session <session>)
  if [ -n "$PENDING" ]; then
    # Handle pending lines...
    continue
  fi

  # Block until next send arrives
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
