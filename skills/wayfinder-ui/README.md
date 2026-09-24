# wayfinder-ui

A skill for AI coding assistants that moves large-scale architectural wayfinding and decision planning out of the terminal and onto an interactive local browser dashboard.

Instead of losing context in long terminal chats or wrestling with complex issue tracker dependencies, `wayfinder-ui` renders your planning effort as an interactive Directed Acyclic Graph (DAG) with explicit frontier highlights, ticket cards, and fog of war management.

## Key Features

- **Interactive Decision DAG:** Visualizes the full dependency tree between architectural decisions.
- **Dynamic Frontier Tracking:** Automatically surfaces open, unblocked tickets ready for immediate resolution.
- **Card-Based Decision Staging:** Pick recommendations, write custom rationales, carry out contextual discussions, and stage all actions locally before sending.
- **Fog of War Management:** Keep track of vague, in-scope unknowns that are not yet sharp enough to ticket, and graduate them into live tickets as the frontier advances.
- **Zero-Dependency Architecture:** Pure Node.js runtime (`node:http`, `node:fs`) and vanilla HTML/SVG/CSS with no npm install or build step required.
- **Universal Multi-Agent Compatibility:** Seamlessly operates across Claude Code (persistent Monitor), Gemini CLI, Codex, Cursor, and GitHub Copilot (wait mode loop).

## Installation

Install as an Agent Skill by cloning or symlinking into your agent's skills directory:

```sh
# Clone or copy into your local skills path
ln -s /path/to/repositories/wayfinder-ui ~/.claude/skills/wayfinder-ui   # Claude Code
ln -s /path/to/repositories/wayfinder-ui ~/.agents/skills/wayfinder-ui   # Codex, Gemini CLI, Cursor
```

## Usage

Start a wayfinding effort on any complex, foggy initiative:

```
/wayfinder-ui <destination or architectural epic>
```

The agent initializes the session and outputs a local URL (e.g. `http://127.0.0.1:45123/`).

Open the URL in any browser:
1. **Explore the Graph:** Inspect the DAG view to understand dependencies and the edge of the frontier.
2. **Review & Stage Decisions:** Click on any ticket to view the question, recommendations, and trade-offs.
3. **Graduate Fog:** Promote emerging discoveries into sharp tickets.
4. **Send to Agent (⌘↩):** Press **Send to Agent** to ship all staged decisions in a single atomic turn.
5. **Finish:** When all decisions are locked, the agent synthesizes an exhaustive roadmap document in `docs/<epic>-roadmap.md`.

To resume an ongoing session:
```
/wayfinder-ui resume
```

## Running Tests

```sh
node --test test/server.test.mjs
```
