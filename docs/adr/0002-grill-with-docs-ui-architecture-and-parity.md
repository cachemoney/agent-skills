# 0002: Grill with Docs UI Architecture & Parity Implementation

## Context & Decision

The existing `.agents/skills/grill-with-docs` skill performed terminal-based grilling interviews while incrementally generating ADRs and glossary documentation (`CONTEXT.md`). However, complex design interviews quickly become unwieldy in terminal chats, lacking topological visualization of decision dependencies, trade-off comparisons, interactive visual prototypes, and offline persistence.

Meanwhile, `wayfinder-ui` established a robust split-ownership IPC daemon, dynamic frontier DAG propagation, and localStorage persistence, while `docs/research-wayfinder-ui-parity.md` documented critical edge cases across server daemon isolation, CSRF origin verification, race condition handling, and frontend state reconciliation.

We decided to port and elevate `grill-with-docs` into `grill-with-docs-ui` located under `skills/grill-with-docs-ui/`, combining:
1. **Interactive Decision DAG Engine:** Topological graph leveling, cycle detection via DFS recursion stack, dynamic frontier promotion when prerequisites resolve, and reverse dependency edge maintenance.
2. **Living Domain Documentation System:** Inline real-time generation of ADRs in `docs/adr/<NNNN>-<slug>.md` when decisions pass the three gates (hard to reverse, surprising without context, real trade-off), and automatic glossary synchronization in `CONTEXT.md`.
3. **Resilient Local UI Dashboard:** LocalStorage persistence keyed by `grill-docs:<project>:<created>`, in-flight pending queue tracking against `agent.handled`, form draft preservation across navigation, explore options comparison table, terms and ADR modals, and visual prototype embedding.
4. **Agent Skills Specification Compliance:** Declared metadata, compatibility (`Requires Node.js >= 18`), MIT license, zero-dependency Node daemon, and symlinked distribution to `.agents/skills/`, `.claude/skills/`, and `.opencode/skill/`.

## Consequences

- Architectural design interviews benefit from visual graph navigation, side-by-side trade-off exploration, and seamless resumption across browser reloads.
- Domain documentation (`CONTEXT.md` and `docs/adr/`) is produced continuously during the interview rather than synthesized as an afterthought.
- The skill operates model-agnostically across tools supporting persistent Monitor mode (Claude Code) and foreground Wait loops (Antigravity / Gemini CLI, Codex, Cursor, Copilot).
