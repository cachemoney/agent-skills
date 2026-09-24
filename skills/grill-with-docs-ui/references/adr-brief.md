# ADR Brief: Architecture Decision Records in `grill-with-docs-ui`

An Architecture Decision Record (ADR) captures an important architectural or domain decision, its context, and its consequences. In `grill-with-docs-ui`, ADRs are recorded inline the moment a critical decision is locked.

## The Three Gates

Offer or produce an ADR **only** when all three conditions are met:

1. **Hard to reverse:** The cost of changing your mind later is significant (e.g. storage engine choice, data protocol, sync model).
2. **Surprising without context:** A future developer or reviewer will wonder: *"Why did they do it this way instead of the obvious alternative?"*
3. **The result of a real trade-off:** There were genuine, viable alternatives and one was chosen for explicit, defensible reasons.

If any of the three is missing, record it as a routine choice in the final design doc, not an ADR.

## Storage and Numbering

- ADRs live in `docs/adr/` under the repository root (or context root if using a multi-context layout).
- Filename pattern: `docs/adr/<NNNN>-<slug>.md` (e.g. `docs/adr/0001-event-storage-engine.md`).
- Numbers are sequential 4-digit integers (`0001`, `0002`, ...). Inspect existing files in `docs/adr/` to find the next available sequence number.

## ADR Template

```markdown
# <NNNN>: <Title in Title Case>

## Context & Decision

<Provide the concise context: the problem being solved, the alternatives evaluated, and the rationale for the selected solution. State clearly what was chosen and why competing options were rejected.>

## Consequences

<Enumerate the concrete positive and negative consequences, operational commitments, invariants, and trade-offs accepted by this decision.>

- <Positive outcome / guarantee>
- <Operational constraint or requirement>
- <Downside or accepted limitation>
```
