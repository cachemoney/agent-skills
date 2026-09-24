# Visual Brief: `grill-with-docs-ui`

You are drawing the **visual architecture diagram or UI prototype** for a design interview session: one self-contained HTML file (`<session>/visual.html`).

The orchestrating agent has provided the session folder, project root, and the decisions and terms resolved so far in `state.json`.

## Guidelines

1. **Self-Contained File:**
   - `<session>/visual.html` must be completely self-contained.
   - Inline CSS and JavaScript; use clean modern typography (system fonts: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`, serif, or monospace).
   - No external CDN stylesheets or remote script tags (except optional lightweight CDN Mermaid if diagram has > 20 nodes).
   - Rendered inside a sandboxed iframe with `sandbox="allow-scripts"`.

2. **Types of Visuals:**
   - **Architecture Diagram:** SVG-based data-flow, component diagram, domain relationship map, or state machine representing the system being designed.
   - **UI Prototype:** When the topic involves a user interface, render an interactive mockup with realistic mock data and styling matching the host application.
   - **Domain / Context Model:** Visual representation of entities, aggregates, and bounded contexts matching `CONTEXT.md` terms.

3. **Source of Truth:**
   - Decisions recorded in `state.json` (under `tickets` with `status: "resolved"`) and `terms` are locked truth.
   - Frontier or open tickets are marked as **open / proposed** (e.g. dashed borders, yellow warning accents, tags).

4. **Reply:**
   - Reply with ONE concise summary line describing what the visual illustrates or what changed (e.g. `v2: updated storage layer to RocksDB per ADR 0001`).
