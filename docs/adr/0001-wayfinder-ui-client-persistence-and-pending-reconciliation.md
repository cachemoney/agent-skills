# 0001: Wayfinder UI Client Staging Persistence and Pending Reconciliation

## Context & Decision

In `wayfinder-ui`, staged actions and form drafts were initially held in volatile JavaScript memory variables (`let staged = []`). A browser refresh, accidental navigation, or tab crash resulted in immediate data loss of uncommitted architectural decisions. Furthermore, actions were cleared immediately upon HTTP 200 without waiting for the agent process to acknowledge the turn via `agent.handled`.

We decided to persist all client staged actions, in-flight pending batches, and form drafts in browser `localStorage` keyed by `wayfinder:<project>:<created>`. Outgoing action batches move to a persistent `pending` queue upon `/send` and are only evicted when `onState()` confirms that `state.agent.handled >= seq`.

## Consequences

- Staged architectural decisions, thread messages, and ticket selections survive browser reloads and crashes.
- The UI maintains accurate loading indicators ("Agent working...") and prevents race conditions while actions are in flight.
- Session storage is strictly scoped per project and session timestamp, preventing data bleed across disparate wayfinding sessions.
