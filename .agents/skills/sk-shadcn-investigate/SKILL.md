---
name: sk-shadcn-investigate
description:
    'Research shadcn-svelte and Bits UI source code and docs to inform decisions, debug issues, or
    understand component APIs. Use when: "shadcn", "shadcn-svelte", "bits-ui"'
argument-hint: '<topic or question>'
allowed-tools:
    Read, Grep, Glob, Agent, mcp__context7__resolve-library-id, mcp__context7__query-docs,
    mcp__svelte__get-documentation, mcp__svelte__svelte-autofixer
metadata:
    author: MartinoPolo
    version: '0.1'
    category: research
---

# Research shadcn-svelte & Bits UI

Use the upstream shadcn-svelte and Bits UI source code and documentation as a reference when making
decisions, debugging issues, or learning how a component API works. This is a general research tool
— not limited to comparison or gap analysis.

## Sources

### Local Cloned Repositories

Both libraries are cloned locally for source-level exploration:

- **shadcn-svelte**: `C:\_MP_github_cloned\shadcn-svelte\`
    - Registry components: `docs/src/lib/registry/ui/`
    - Style-specific overrides: `docs/src/lib/registry/styles/`
    - CLI template CSS (keyframes, custom variants): `packages/cli/src/tailwind.css`
    - Demos/examples: `docs/src/lib/registry/examples/`

- **Bits UI**: `C:\_MP_github_cloned\bits-ui\`
    - Component source: `packages/bits-ui/src/lib/bits/`
    - Each component has: root `.svelte`, state logic `.svelte.ts`, sub-components in `components/`,
      and `types.ts`
    - Shared utilities: `packages/bits-ui/src/lib/internal/`

Always explore the local cloned repos in a **sub-agent** to avoid flooding context.

### Context7 MCP Documentation

Query Context7 MCP for up-to-date docs — especially useful for API surface, prop types, and usage
patterns:

- shadcn-svelte: resolve library ID for `huntabyte/shadcn-svelte`, then query docs
- Bits UI: resolve library ID for `huntabyte/bits-ui`, then query docs

Use Context7 when you need the documented API contract. Use the local clones when you need
implementation details, internal state management, CSS custom properties, or runtime behavior.

## When to Use This Skill

- **Debugging**: a component isn't behaving as expected — check how the upstream implements it (CSS,
  data attributes, runtime properties)
- **Decision-making**: choosing between approaches — look at how shadcn-svelte or Bits UI solved a
  similar problem
- **API discovery**: what props, slots, snippets, or events does a component support?
- **Implementation guidance**: building a new component or feature — reference upstream patterns,
  demos, and examples
- **CSS/animation issues**: checking what keyframes, custom variants, or theme tokens a component
  expects

## Process

1. **Clarify the question** — what specifically needs to be understood or resolved?
2. **Choose the right source** — Context7 for API docs, local clones for internals
3. **Explore in a sub-agent** — delegate repo exploration to keep context clean. Ask for concise
   findings and file paths.
4. **Report findings** — answer the original question with specific references (file paths, line
   numbers). Apply fixes if the question was about a bug.
