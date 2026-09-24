# Research Report: Skill Discovery Paths, Symlink Handling, and Specification Conventions Across AI Agent CLIs

**Date:** 2026-09-23  
**Status:** Completed  
**Ticket:** Wayfinder Map #1, Research Ticket #2 ("Research skill discovery paths and conventions across agent CLIs")  
**Target Repository:** [`cachemoney/agent-skills`](file:///home/mezmo/Work/vibe/agent-skills)  

---

## Executive Summary

Agent skills extend AI coding assistants with specialized, procedural capabilities following the open [Agent Skills specification](https://agentskills.io/specification). However, across modern agent CLIs—including **Anthropic Claude Code**, **Cursor IDE / Agent CLI**, **Google Antigravity / Gemini CLI**, and **OpenCode**—the conventions for discovering skills, resolving filesystem symlinks, handling frontmatter, and enforcing tool execution boundaries diverge significantly.

This research report investigates high-trust primary sources (official documentation, specification documents, runtime schemas, and local execution environments) to answer five foundational questions:
1. **Claude Code:** Where does it discover skills, does it follow symlinks, and how does it handle frontmatter fields?
2. **Cursor:** How does it discover skills vs. rules, does it support `.cursor/skills` or `.cursor/rules`, and how does it handle symlinks?
3. **Gemini CLI / Antigravity:** Where does it discover workspace and user skills, and does it resolve symlinks?
4. **OpenCode:** Where does OpenCode look for skills (including legacy `.opencode/skill`), and what are its schema constraints?
5. **Agent Skills Specification Compatibility:** How do optional fields (`compatibility`, `metadata`, `license`, `allowed-tools`) behave across all engines, and what is the optimal repository distribution strategy?

### Cross-Tool Discovery & Compatibility Matrix

| Feature / Capability | Anthropic Claude Code | Cursor IDE / Agent CLI | Google Antigravity / Gemini CLI | OpenCode |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Project Path** | `.claude/skills/` | `.cursor/skills/` & `.agents/skills/` | `.agents/skills/` & `.gemini/skills/` | `.opencode/skills/` (and `.opencode/skill/`) |
| **Compatibility Paths** | None (does *not* read `.agents/` or `skills/`) | `.agents/skills/`, `.claude/skills/`, `.codex/skills/` | `.agent/`, `_agents/`, `_agent/` | `.agents/skills/`, `.claude/skills/` |
| **User Scope Path** | `~/.claude/skills/` | `~/.cursor/skills/`, `~/.agents/skills/` | `~/.agents/skills/`, `~/.gemini/skills/` | `~/.config/opencode/skills/` |
| **Enterprise / System Path** | `/etc/claude-code/.claude/skills/` | Custom enterprise configs | Installation builtin (`builtin/skills/`) | Managed runtime config |
| **Directory Symlinks** | **Supported** (followed & deduplicated by realpath) | **Inconsistent** (indexing misses out-of-tree symlinks) | **Supported** (followed & deduplicated by realpath) | **Supported** (native traversal; symlinks redundant) |
| **Required Frontmatter** | `name`, `description` | `name`, `description` | `name`, `description` | `name`, `description` |
| **Optional Frontmatter Supported** | `allowed-tools`, `license`, `compatibility`, `metadata` | `paths`, `disable-model-invocation`, `icon`, `color`, `metadata` | `license`, `compatibility`, `metadata`, `allowed-tools` | `license`, `compatibility`, `metadata` (`map[string]string]`) |
| **`allowed-tools` Enforcement** | **Actively Enforced** (restricts tool access) | **Ignored** (managed by Cursor Settings) | **Ignored** (managed by runtime profiles) | **Ignored** (governed by `opencode.json`) |
| **Variable Expansion** | `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}` | None documented | Antigravity runtime context | None documented |

---

## 1. Anthropic Claude Code

### Primary Sources
- [Claude Code Official Documentation: Skills](https://code.claude.com/docs/en/skills.md)
- [Claude Code Settings & Configuration](https://code.claude.com/docs/en/settings.md)
- Claude Code CLI distribution inspection & runtime experiments

### 1.1 Discovery Locations & Search Precedence
Claude Code implements a strict multi-tier hierarchy for discovering skills. When invoked within a workspace, Claude Code discovers skills in the following order:

1. **Managed / Enterprise Level:**  
   - Path: `/etc/claude-code/.claude/skills/<skill-name>/SKILL.md` (or single-file `<skill-name>.md`)
   - Precedence: Highest priority for centralized policy deployment; cannot be overridden by user configuration if flagged as mandatory.
2. **Personal / User Level:**  
   - Path: `~/.claude/skills/<skill-name>/SKILL.md` (or `~/.claude/skills/<skill-name>.md`)
   - Available across all projects on the developer's machine.
3. **Project / Workspace Level:**  
   - Path: `.claude/skills/<skill-name>/SKILL.md` (or `.claude/skills/<skill-name>.md`)
   - Traversed starting from the current working directory upward to the Git project root.
4. **Nested / Subdirectory Level:**  
   - Path: `<subdirectory>/.claude/skills/<skill-name>/SKILL.md`
   - Discovered dynamically if Claude Code is executed within a nested project subfolder.
5. **Manually Added Directories:**  
   - Configured via CLI flag: `claude --add-dir <path>`
   - Enables loading skills from external repositories or monorepo packages outside the immediate Git tree.
6. **Installed Plugins:**  
   - Path: `<plugin-install-path>/skills/<skill-name>/SKILL.md`
7. **Synced Skills:**  
   - Path: `~/.claude/skills/synced/` (used by Claude sync features).

> [!WARNING]
> **Critical Discovery Gap:** Claude Code does **not** natively scan `.agents/skills/`, `.cursor/skills/`, or the repository root `skills/` folder. For Claude Code to discover skills in a shared repository, they **must** be located in, or symlinked into, `.claude/skills/`.

### 1.2 Symlink Resolution Behavior
- Claude Code explicitly follows directory symlinks and file symlinks.
- When `.claude/skills/<skill-name>` is a symbolic link pointing to `../../skills/<skill-name>`, Claude Code follows the symlink, reads `SKILL.md`, and indexes the skill without issue.
- **Deduplication:** Claude Code resolves target paths via canonical realpath. If a skill is accessible via both a symlink and an alias, Claude Code deduplicates them by target path, preventing multiple registrations of the same skill.

### 1.3 Frontmatter Support & `allowed-tools` Enforcement
Claude Code parses YAML frontmatter at the top of `SKILL.md`. It supports:
- `name` (required): Identifier matching the directory name.
- `description` (required): Summary text used by Claude Code for progressive disclosure (indexing skills in the system prompt so the model knows when to invoke them).
- `allowed-tools` (**Actively Enforced**): Claude Code is unique among major agent CLIs in enforcing `allowed-tools`. If a skill defines `allowed-tools: Bash Read Edit`, Claude Code strictly limits available tool calls to that whitelist while executing within that skill's context.
- `license` & `compatibility`: Supported as informational metadata.
- `metadata`: Arbitrary key-value mappings.

#### Environment Variable Expansion
Claude Code expands the following dynamic variables within `SKILL.md` content:
- `${CLAUDE_SKILL_DIR}`: The absolute path to the skill's containing directory (useful for invoking accompanying scripts, e.g., `${CLAUDE_SKILL_DIR}/scripts/run.sh`).
- `${CLAUDE_PROJECT_DIR}`: The absolute path to the project root directory.

#### CLI vs. Web Upload (`claude.ai`) Boundary
While the Claude Code CLI is permissive of additional frontmatter fields, uploading packaged skills to the Claude Web UI (`claude.ai`) or running the Anthropic `package_skill.py` utility applies rigid schema validation. Unrecognized keys will trigger packaging errors. Therefore, custom frontmatter should be namespaced under `metadata:`.

---

## 2. Cursor IDE & Agent CLI

### Primary Sources
- [Cursor Documentation: Context Skills](https://cursor.com/docs/context/skills)
- [Cursor Documentation: Rules Architecture](https://cursor.com/docs/rules)
- Cursor IDE runtime configuration inspection (`.cursorrules`, `.cursor/rules`, `.agents/skills`)

### 2.1 Discovery Locations & Compatibility Scanning
Cursor has unified its agent capabilities around the open Agent Skills standard while maintaining backwards compatibility:

1. **Project Scope:**  
   - Native Skills Paths: `.cursor/skills/<name>/SKILL.md` and `.agents/skills/<name>/SKILL.md`.
   - Compatibility Fallbacks: Cursor automatically scans `.claude/skills/` and `.codex/skills/` at the project root.
2. **User Scope:**  
   - `~/.cursor/skills/` and `~/.agents/skills/` (and fallback `~/.claude/skills/`).
3. **Category Nesting:**  
   - Cursor supports nested subdirectories under the skills root, such as `.cursor/skills/<category>/<skill-name>/SKILL.md`.

### 2.2 Skills vs. Rules Architecture
Cursor draws a sharp distinction between **Rules** and **Skills**:

- **Rules (`.cursor/rules/*.mdc`, `.cursorrules`, `AGENTS.md`):**  
  - Purpose: Persistent system instructions, project-wide conventions, and file-pattern-triggered constraints.
  - Activation: Can be configured with `alwaysApply: true` or scoped to specific files via glob matching frontmatter (`globs: ["*.ts", "src/**/*.py"]`).
  - Lifecycle: Injected into model context whenever target files are referenced.
- **Skills (`SKILL.md`):**  
  - Purpose: Procedural workflows, interactive tools, and multi-step tasks.
  - Activation: Progressive disclosure. Cursor indexes only the `name` and `description` in its catalog. The full instructions are pulled into context only when the agent decides to invoke the skill.
  - Migration Tooling: Cursor provides a built-in `/migrate-to-skills` command to help developers refactor procedural rules into on-demand skills.

### 2.3 Symlink Resolution & Known Pitfalls
- **Filesystem Watcher Inconsistencies:** Cursor's file indexing engine (built on Ripgrep and native filesystem watchers) has documented issues with directory symlinks, particularly when symlinks target locations outside the workspace folder or cross filesystem boundaries.
- In some workspace configurations, symlinked directories under `.cursor/skills/` fail to trigger live-reloading or are skipped by the background indexer.
- **Architectural Recommendation:** Because Cursor **natively discovers `.agents/skills/`**, projects should place or distribute skills directly into `.agents/skills/`. This avoids relying on `.cursor/skills/` symlinks entirely.

### 2.4 Frontmatter Support
- Supported fields: `name`, `description`, `paths`, `disable-model-invocation`, `icon`, `color`, `metadata`.
- Specification fields: `license`, `compatibility`, and `allowed-tools` are accepted without syntax errors. However, Cursor does **not** enforce `allowed-tools` via frontmatter; tool permissions are governed globally via Cursor Settings / Agent permissions.

---

## 3. Google Antigravity / Gemini CLI

### Primary Sources
- Antigravity Customization System Specification (`~/.gemini/antigravity-cli/builtin/skills/agy-customizations/SKILL.md`)
- [Gemini CLI Documentation: Skills](https://geminicli.com/docs/cli/skills/)
- Built-in Antigravity runtime environment (`builtin/skills/`, `.agents/skills/`)

### 3.1 Discovery Locations & Search Precedence
Antigravity and Gemini CLI implement native support for the universal `.agents/` convention:

1. **Workspace Scope:**  
   - Primary: `.agents/skills/<name>/SKILL.md`  
   - Directory Aliases: Antigravity checks `.agent/skills/`, `_agents/skills/`, and `_agent/skills/`.
   - Tool-Specific Path: `.gemini/skills/<name>/SKILL.md`.
   - Traversal: Ascends from current working directory upward to the Git root.
2. **User Scope:**  
   - `~/.agents/skills/<name>/SKILL.md`
   - `~/.gemini/skills/<name>/SKILL.md`
   - `~/.gemini/config/skills/`
3. **Built-in Scope:**  
   - Built-in system skills provided with the Antigravity installation (e.g., `~/.gemini/antigravity-cli/builtin/skills/`).
4. **Manifest Declarations:**  
   - Supports explicit skill registration manifests defined in `.agents/skills.json` or `.gemini/skills.json`.

### 3.2 Symlink Resolution Behavior
- Antigravity and Gemini CLI have full, native support for directory and file symlinks.
- All candidate skill paths are resolved to their canonical target paths using `realpath`.
- **Deduplication:** When `.agents/skills/<name>` is discovered alongside a symlinked or aliased directory, Antigravity identifies them as identical via inode/realpath resolution and loads only a single instance into the skill catalog.

### 3.3 Frontmatter Support
- Required: `name` and `description` to build the progressive disclosure catalog.
- Tolerated: `license`, `compatibility`, `metadata`, and `allowed-tools`.
- Tool permissions are handled at the Antigravity session and subagent configuration level rather than restricted per skill via `allowed-tools`.

---

## 4. OpenCode

### Primary Sources
- [OpenCode Skills Documentation](https://opencode.ai/docs/skills/)
- [OpenCode Commands & Configuration Guide](https://opencode.ai/docs/commands/)
- OpenCode core repository source code & Go struct schema definitions

### 4.1 Discovery Locations & Search Precedence
OpenCode provides robust multi-standard discovery:

1. **Project Scope:**  
   - Primary: `.opencode/skills/<name>/SKILL.md`
   - Legacy Singular Path: `.opencode/skill/<name>/SKILL.md` (supported for backwards compatibility with earlier versions).
2. **Compatibility Paths:**  
   - OpenCode automatically traverses `.agents/skills/<name>/SKILL.md` and `.claude/skills/<name>/SKILL.md` up to the Git worktree root.
3. **User Scope:**  
   - `~/.config/opencode/skills/<name>/SKILL.md`
4. **Configuration Manifest:**  
   - Can declare explicit skill locations or remote URLs in `opencode.json` under `skills: []`.

### 4.2 Symlink Resolution Behavior
- OpenCode resolves symbolic links during standard directory tree traversal.
- However, because OpenCode natively searches `.agents/skills/` and `.claude/skills/`, creating symlinks in `.opencode/skill/` is only required when targeting older OpenCode releases that lack the universal compatibility scanner.

### 4.3 Strict Frontmatter Schema Constraints
OpenCode parses frontmatter using strongly typed Go structs. It enforces specific rules:
- `name`: Required string. Must match regex `^[a-z0-9]+(-[a-z0-9]+)*$` (lowercase alphanumeric with single hyphens, 1-64 chars). Must match the directory name.
- `description`: Required string (1-1024 characters).
- `license`: Optional string.
- `compatibility`: Optional string (maximum 500 characters).
- `metadata`: Optional map of string keys to string values (`map[string]string`). Note: Complex nested YAML structures in `metadata` will fail deserialization in OpenCode; all values should be strings.
- `allowed-tools`: Not parsed or recognized. OpenCode manages tool execution permissions through `opencode.json` under `permission.skill` configuration blocks.

---

## 5. Agent Skills Specification Analysis & Cross-Tool Compatibility

The [Agent Skills specification](https://agentskills.io/specification) standardizes portable agent capabilities. Below is an audit of each specification field against the four CLI tools:

### 5.1 Field-by-Field Compatibility Matrix

```yaml
---
name: my-skill               # Required (1-64 chars, a-z, 0-9, hyphens)
description: Demonstrates... # Required (1-1024 chars)
license: Apache-2.0          # Optional
compatibility: Requires uv   # Optional (max 500 chars)
metadata:                    # Optional key-value dictionary
  version: "1.0.0"
  author: "team"
allowed-tools: Bash Read     # Optional space-delimited string
---
```

1. **`name` (Mandatory):**  
   - Spec: 1–64 characters, lowercase alphanumeric and hyphens (`^[a-z0-9]+(-[a-z0-9]+)*$`). Must match directory name.
   - Claude Code, Cursor, Antigravity, OpenCode: **100% Compatible and Enforced**.
2. **`description` (Mandatory):**  
   - Spec: 1–1024 characters describing what the skill does and when the agent should select it.
   - Claude Code, Cursor, Antigravity, OpenCode: **100% Compatible and Enforced**. Essential for progressive disclosure across all models.
3. **`license` (Optional):**  
   - Spec: Valid SPDX license identifier or proprietary notice.
   - Compatibility: Parsed by OpenCode and Claude Code; safely tolerated as metadata by Cursor and Antigravity.
4. **`compatibility` (Optional):**  
   - Spec: String up to 500 characters describing environment prerequisites (e.g. required CLI tools, OS limitations).
   - Compatibility: Parsed by OpenCode; tolerated by Claude Code, Cursor, and Antigravity.
5. **`metadata` (Optional):**  
   - Spec: Arbitrary key-value dictionary.
   - Compatibility: Universally supported. **Caution:** OpenCode requires string-to-string mappings (`map[string]string`). Do not use nested arrays or objects in `metadata` if OpenCode compatibility is required.
6. **`allowed-tools` (Optional):**  
   - Spec: Space-delimited string of tool names (e.g., `Bash Read Edit`).
   - Claude Code: **Actively Enforced**. Restricts tool execution to the specified whitelist.
   - Cursor, Antigravity, OpenCode: **Ignored / Tolerated**. No errors, but tool restrictions are managed through their respective client security policies.

---

## 6. Architectural Recommendations for `ai-workspace.toml`

Based on the empirical findings, this section outlines the optimal strategy for the `cachemoney/agent-skills` workspace and related meta-repositories.

### 6.1 Recommended Directory Distribution

```
project-root/
├── skills/                     # Canonical Source of Truth
│   ├── code-review/
│   │   └── SKILL.md
│   └── research/
│       └── SKILL.md
│
├── .agents/skills/             # Universal Target (Symlinks)
│   ├── code-review -> ../../skills/code-review
│   └── research -> ../../skills/research
│
├── .claude/skills/             # Claude Code Target (Symlinks)
│   ├── code-review -> ../../skills/code-review
│   └── research -> ../../skills/research
│
└── .opencode/skill/            # Legacy OpenCode Target (Symlinks)
    ├── code-review -> ../../skills/code-review
    └── research -> ../../skills/research
```

### 6.2 Why Not Symlink `.cursor/skills`?
1. Cursor **natively discovers `.agents/skills/`**.
2. Creating an additional symlink target at `.cursor/skills/` is redundant.
3. More importantly, symlinking directories in `.cursor/` can cause indexing and file-watching anomalies in Cursor's background daemon. Serving Cursor via `.agents/skills/` is the cleanest, most reliable approach.

### 6.3 Recommended `ai-workspace.toml` Configuration
Update `ai-workspace.toml` to distribute skills to the three essential targets:

```toml
[distribution]
# Target directories for skills symlinks
skills_paths = [
    ".agents/skills",     # Universal standard: Cursor, Antigravity / Gemini CLI, OpenCode
    ".claude/skills",     # Anthropic Claude Code (exclusive requirement)
    ".opencode/skill",    # OpenCode backwards compatibility
]
```

### 6.4 Recommended Validation Updates for `transpile-skills.py`
The workspace validation script (`.ai-workspace/scripts/transpile-skills.py`) currently validates only `name` and `description`. To align with Ticket #1 and the Agent Skills specification:
1. **Permit Optional Spec Fields:** Ensure `extract_frontmatter` and `parse_skill` do not flag or reject `license`, `compatibility`, `metadata`, or `allowed-tools`.
2. **Validate OpenCode Metadata Types:** If `metadata` is present, warn if values are non-scalar (nested dictionaries/lists).
3. **Validate `allowed-tools` Syntax:** Ensure `allowed-tools` is a string of space-delimited tool identifiers when provided.
4. **Symlink Generation:** Ensure `create_symlink` continues creating relative symlinks so that repository clones across different machines resolve cleanly.
