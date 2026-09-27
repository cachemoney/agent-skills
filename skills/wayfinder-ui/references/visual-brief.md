# Visual Brief: Wayfinder UI

You are drawing the **visual map or architecture prototype** for a Wayfinder planning effort: one self-contained HTML file (`<session>/visual.html`) showing the architectural roadmap or prototype of the system being planned.

The orchestrating agent has provided the session folder, project root, and the questions/decisions made so far in `state.json`.

## Guidelines

1. **Self-Contained File:**
   - `<session>/visual.html` must be completely self-contained.
   - Inline CSS and JavaScript; system fonts only (`sans-serif`, `serif`, `monospace`).
   - No external CDN stylesheets or remote script tags (except optional CDN Mermaid if diagram has > 20 nodes).
   - Rendered inside a sandboxed iframe with `sandbox="allow-scripts"`.

2. **Types of Visuals:**
   - **Roadmap / DAG Topology:** Visualizing the dependency graph of decisions and milestone gates.
   - **Architecture Diagram:** SVG-based data-flow, component diagram, or state machine representing the destination system.
   - **UI Prototype:** When the destination is a software interface, render an interactive mockup with realistic mock data and styling that matches the target application.

3. **Source of Truth:**
   - Decisions recorded in `state.json` (under `tickets` with `status: "resolved"`) are locked truth.
   - Frontier or open tickets are marked as **assumed / open** (e.g. dashed borders, tags).

4. **Reply:**
   - Reply with ONE concise summary line describing what the visual illustrates or what changed.
