---
name: sk-mockup
description: 'Generate HTML variant mockups from a design brief. Default: 1 mockup. Pass a number for multiple variants (e.g., sk-mockup 3). Use when: "create mockup", "design variant", "mock up", "visualize design", "mockup", "three variants"'
argument-hint: "[count] [component-name or 'all']"
allowed-tools: Read, Write, Glob, Grep, Bash(mkdir *), Agent
metadata:
    author: MartinoPolo
    version: '0.1'
    category: design
---

# Design Mockup Generation

Generate self-contained HTML mockup(s) from a design brief, using the project's design system.

**Default**: 1 mockup. Pass a number as first argument for multiple variants (e.g., `sk-mockup 3`).

## Available UI Components

!`ls src/lib/components/base/ 2>/dev/null | sort`

## Current State

!`echo "=== Component Designs ===" && for d in designs/*/; do name=$(basename "$d"); brief=$(ls "$d"DESIGN_BRIEF_*.md 2>/dev/null | wc -l); variants=$(ls "$d"variants/variant-*.html 2>/dev/null | wc -l); refined=$(ls "$d"refined.html 2>/dev/null | wc -l); echo "$name: brief=$brief variants=$variants refined=$refined"; done 2>/dev/null`

## Argument Parsing

- First token is a number N (1–5): generate N variants. Remaining tokens = component name.
- First token is NOT a number: generate 1 variant. Entire argument = component name.
- No arguments: generate 1 variant for the next brief with no variants yet.
- `all` / `N all`: generate variants for every component with a brief but no variants.

Examples:

- `sk-mockup` → 1 variant, auto-detect next
- `sk-mockup 3` → 3 variants, auto-detect next
- `sk-mockup settings-panel` → 1 variant for that component
- `sk-mockup 3 settings-panel` → 3 variants for that component

## Process

### Step 0: Read Current Design Authority

First read `designs/README.md` and current `.mpx/DECISIONS.md`. Later decisions override earlier approved scope and artifacts. Exclude `archive/designs/` and historical briefs identified by `designs/README.md` from reporting and auto-discovery. Missing refined/variants artifacts alone does not prove work pending; require a current brief and workflow conditions. Ask when target or variant intent is ambiguous.

### Step 1: Read Design System

Read `designs/DESIGN_SYSTEM.md` if it exists — available classes, component patterns, spacing.

Treat `src/app.css`, the compiled design-review CSS used for browserable mockups, and existing component APIs/stories as the active styling contract. `designs/DESIGN_SYSTEM.md` is supporting guidance subject to current decisions. `designs/tokens.css`, if present, is historical reference only; do not link it by default.

### Step 2: Identify Target Brief

- Named component: read `designs/<component-name>/DESIGN_BRIEF_<COMPONENT_NAME>.md`
- Auto-detect: find a component folder under `designs/` that has a brief but no `variants/variant-*.html`

### Step 3: Discover Reusable Components

Scan existing components: `ls src/lib/components/base/` and `ls src/lib/components/derived/`

For missing patterns, spawn `mpx-context7-docs-fetcher` to check shadcn-svelte (`/huntabyte/shadcn-svelte`) and Bits UI (`/huntabyte/bits-ui`). Defer actual installation to the refine phase.

### Step 4: Generate Mockup(s)

Output directory: `designs/<component-name>/variants/`

**N = 1**: Generate a single mockup. Output: `designs/<component-name>/variants/variant-a.html`

**N > 1**: Spawn N `mpx-ui-variant-generator` agents in parallel. Output: `designs/<component-name>/variants/variant-{a,b,c,...}.html`

Each mockup must:

- Link the current compiled design-review CSS in `<head>` (or inline the required compiled subset derived from `src/app.css` when no review stylesheet exists); do not link legacy `designs/tokens.css` by default
- Match component behavior and props to the local component APIs and stories
- Include font references matching the project's font stack (from tailwind config or app.css)
- Use Tailwind utility classes and design system classes throughout
- Only component-specific CSS in `<style>` (layout, unique styles; never token values)
- Realistic mock data (plausible content, real-looking metrics)
- Variant label at top (e.g., "VARIANT A: DENSE, COMPACT LAYOUT") styled as a small eyebrow heading
- All required elements from the brief

#### Container Context (Critical)

If the brief specifies a **Container Context**:

- Show the parent container (nav, panel chrome) at reduced opacity as non-editable context
- The designed component fills only its designated area — no duplicate headers, borders, or footers
- Standalone components own their full chrome

### Step 5: Open in Browser

Open each variant via `file:///` URL (Chrome DevTools MCP if available). Leave tabs open for comparison.

### Step 6: Report

List variants with brief descriptions and file paths. Mention that `/sk-design-refine <variant-letter> <requirements>` can be used next to produce `refined.html` and `SUMMARY.md`.
