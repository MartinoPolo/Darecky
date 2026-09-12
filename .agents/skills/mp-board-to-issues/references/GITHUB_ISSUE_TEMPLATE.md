# GitHub issue template

For AFK issues:

```markdown
## Description

[What needs to happen and why. Use durable domain language; do not use file paths or line numbers.]

## Requirements

- REQ-1: [Imperative requirement]

## Acceptance Criteria

- [ ] [Independently testable observable condition]

## Notes

[Relevant screenshots, constraints, patterns, or implementation hints]
```

For HITL issues, prepend only this block:

```markdown
> **Unanswered questions:**
>
> - [Specific question that needs answering before or during implementation]
```

Omit optional sections when they add no value. Acceptance criteria must describe observable
behavior, not implementation details. All created issues are assigned to `@me`.
