# Installing Agent Skills

The skills in [`skills/`](file:///home/mezmo/Work/vibe/agent-skills/skills) follow the [Agent Skills specification](https://agentskills.io/specification). Each skill is a self-contained directory containing a `SKILL.md` (metadata frontmatter and instructions), executable scripts, and web dashboard assets.

Because they adhere to the standard specification, they install the same way everywhere: place or symlink the skill directory where your AI coding assistant looks for skills. Symlinking keeps `git pull` as your update path, though copying the folder also works. Node 18 or newer (Node 20+ recommended) is the only runtime requirement.

---

## Skills Included

- **`grill-with-docs-ui`** — Interactive design and architecture interview on a local browser page. Stages decisions into an interactive DAG, updates a living domain glossary ([`CONTEXT.md`](file:///home/mezmo/Work/vibe/agent-skills/CONTEXT.md)), produces Architecture Decision Records (ADRs in `docs/adr/`), and generates background visual prototypes.
- **`wayfinder-ui`** — Large-scale architectural wayfinding and decision planning. Visualizes epics as an interactive Directed Acyclic Graph (DAG) with frontier tracking, ticket cards, and fog-of-war management.

Both skills run on plain Node.js standard libraries (`node:http`, `node:fs`) with **zero external dependencies** and no build step.

---

## Quick Install (Symlinks)

Clone this repository and symlink the skills into your agent's skills directory:

```sh
# Clone this repository
git clone https://github.com/cachemoney/agent-skills.git ~/Projects/agent-skills

# Option A: User-level (available across all your projects)
# Claude Code (Cursor also reads this directory)
mkdir -p ~/.claude/skills
ln -s ~/Projects/agent-skills/skills/grill-with-docs-ui ~/.claude/skills/grill-with-docs-ui
ln -s ~/Projects/agent-skills/skills/wayfinder-ui ~/.claude/skills/wayfinder-ui

# Codex, Gemini CLI / Antigravity, Cursor, GitHub Copilot
mkdir -p ~/.agents/skills
ln -s ~/Projects/agent-skills/skills/grill-with-docs-ui ~/.agents/skills/grill-with-docs-ui
ln -s ~/Projects/agent-skills/skills/wayfinder-ui ~/.agents/skills/wayfinder-ui

# OpenCode
mkdir -p ~/.opencode/skill
ln -s ~/Projects/agent-skills/skills/grill-with-docs-ui ~/.opencode/skill/grill-with-docs-ui
ln -s ~/Projects/agent-skills/skills/wayfinder-ui ~/.opencode/skill/wayfinder-ui
```

```sh
# Option B: Project-level (available only in a specific repository)
cd /path/to/your/project

# Standard Agent Skills path (.agents/skills)
mkdir -p .agents/skills
ln -s ~/Projects/agent-skills/skills/grill-with-docs-ui .agents/skills/grill-with-docs-ui
ln -s ~/Projects/agent-skills/skills/wayfinder-ui .agents/skills/wayfinder-ui

# Claude Code (.claude/skills)
mkdir -p .claude/skills
ln -s ~/Projects/agent-skills/skills/grill-with-docs-ui .claude/skills/grill-with-docs-ui
ln -s ~/Projects/agent-skills/skills/wayfinder-ui .claude/skills/wayfinder-ui
```

---

## Agent Directory Reference & Invocation

Where each agent looks for skills, and how to start each skill once installed:

| Agent | User-level folder | Project-level folder | Start `grill-with-docs-ui` | Start `wayfinder-ui` |
|---|---|---|---|---|
| **Claude Code** | `~/.claude/skills/` | `.claude/skills/` | `/grill-with-docs-ui <topic>` | `/wayfinder-ui <destination>` |
| **Codex** (CLI, IDE) | `~/.agents/skills/` | `.agents/skills/` | `$grill-with-docs-ui <topic>` | `$wayfinder-ui <destination>` |
| **Gemini CLI / Antigravity** | `~/.gemini/skills/` or `~/.agents/skills/` | `.gemini/skills/` or `.agents/skills/` | Say "grill with docs ui: \<topic\>" or `/grill-with-docs-ui <topic>` | Say "wayfinder with ui: \<destination\>" or `/wayfinder-ui <destination>` |
| **Cursor** | `~/.cursor/skills/` or `~/.agents/skills/` (also `~/.claude/skills/`) | `.cursor/skills/` or `.agents/skills/` | `/grill-with-docs-ui <topic>` in Agent chat | `/wayfinder-ui <destination>` in Agent chat |
| **OpenCode** | `~/.opencode/skill/` or `~/.agents/skills/` | `.opencode/skill/` or `.agents/skills/` | Say "grill with docs ui: \<topic\>" | Say "wayfinder with ui: \<destination\>" |
| **GitHub Copilot** (CLI, VS Code, JetBrains) | `~/.copilot/skills/` or `~/.agents/skills/` | `.github/skills/`, `.claude/skills/`, or `.agents/skills/` | Say "grill with docs ui: \<topic\>" | Say "wayfinder with ui: \<destination\>" |
| **Any other agent** reading `SKILL.md` | Its configured skills directory | Its configured skills directory | Say "grill with docs ui: \<topic\>" | Say "wayfinder with ui: \<destination\>" |

> [!NOTE]
> Directory paths reflect documentation as of late 2026. Typing `/skills` (Codex, Gemini CLI, Claude Code) or opening the agent's skill picker will verify that the skill was successfully discovered. Because the skill descriptions include natural trigger phrases (`"grill with docs ui"`, `"wayfinder with ui"`), plain language requests will activate the skills across all assistants.

---

## Resuming Sessions

Both skills support resuming an in-progress or interrupted session:

```sh
# For grill-with-docs-ui
/grill-with-docs-ui resume   # or: "resume the grill session"

# For wayfinder-ui
/wayfinder-ui resume         # or: "resume wayfinder"
```

Session state is persisted in user-level state folders (`~/.grill-with-docs-ui/` and `~/.wayfinder-ui/`), leaving target codebases clean of git artifacts.

---

## Runtime Requirements

When an agent executes these skills, it needs:

1. **Node.js 18+ (Node 20+ recommended)** and a shell execution tool.
   No `npm install` is required for running skills; the servers use built-in Node modules (`node:http`, `node:fs`).

2. **Harness Execution Mode:**
   - **Persistent Monitor Mode:** In harnesses that stream background process stdout to wake the agent (e.g. Claude Code's Monitor tool), the server runs under the monitor and automatically wakes the agent upon browser **Send**.
   - **Wait Mode Loop (Universal):** In harnesses without persistent process wakeups (Gemini CLI / Antigravity, Codex, Cursor, GitHub Copilot, OpenCode), the agent starts the server detached (`nohup ... &`) and maintains an active foreground wait loop:
     ```sh
     node scripts/server.mjs wait --session <dir> --after <handled> --timeout 480
     ```
     When you click **Send to Agent** in your browser, `wait` unblocks, prints the new events, and exits 0 for the agent to process before looping again.

3. **Optional Subagent Support:**
   Both skills can brief subagents in the background to render interactive HTML prototypes or architecture diagrams (`visual.html`) without filling the main conversation's context window. If the agent does not support subagents, visuals are generated inline.

---

## Workspace-Native Distribution

If you are developing inside this meta-workspace repository, skills can be automatically validated and distributed to your local tool directories (`.agents/skills`, `.claude/skills`, `.opencode/skill`) using the workspace alignment tooling:

```sh
# Validate skill schemas and update all workspace symlinks
uv run .ai-workspace/scripts/transpile-skills.py

# Or validate without creating links
uv run .ai-workspace/scripts/transpile-skills.py --validate
```
