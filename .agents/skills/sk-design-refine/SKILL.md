---
name: sk-design-refine
description: 'Apply refinement requirements to a chosen variant, produce refined.html + SUMMARY.md, update brief, link to GitHub issue. Use when: "refine design", "accept variant", "polish design", "select variant", "apply refinements", "refine variant B", "refine all"'
argument-hint: 'all | <variant-letter> [refinement requirements...]'
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(mkdir *), Bash(pnpm dlx shadcn-svelte*), Bash(gh *), Agent
metadata:
    author: MartinoPolo
    version: '0.1'
    category: design
---

# Design Refinement

Apply refinement requirements to a chosen variant. Produces `refined.html` and `SUMMARY.md`, updates the design brief, and links to the GitHub issue.

Supports two modes:

- **Single**: refine a specific variant for the active design folder
- **Batch (`all`)**: scan every design subfolder for unprocessed DECISION.md files and refine each one in sequence

## Process

### Step 0: Read Current Design Authority

First read `designs/README.md` and the current `.mpx/DECISIONS.md`. Later decisions override earlier approved scope and artifacts. Exclude `archive/designs/` and folders marked historical by `designs/README.md` from discovery. Missing variants or `refined.html` alone is not proof that refinement is pending. If the active folder, chosen variant, or applicable decision is ambiguous, ask the user; never guess from recency or the latest-mentioned variant.

### Step 1: Parse Arguments

**If the argument is `all`** → switch to [Batch Mode](#batch-mode-all) below.

Otherwise (single mode):

- **Variant**: first token — letter (A–Z) identifying the variant (case-insensitive)
- **Refinements**: everything after the variant — requirements to apply

Example: `B make header sticky, use Badge for status, add empty state`
→ Variant B + 3 refinements

Ask if the variant is missing. Ask what to change if refinements are empty.

---

## Batch Mode (all)

When the argument is `all`, run the following discovery loop **before** any refinement work, then process each eligible folder sequentially using the normal Steps 2–10.

### Batch Step A: Discover eligible design folders

Scan every direct subfolder of `designs/` (exclude `designs/DESIGN_SYSTEM.md` and `designs/tokens.css`).

For each folder, check **all three** conditions:

1. `designs/<name>/variants/DECISION.md` **exists**
2. `designs/<name>/SUMMARY.md` does **not** exist
3. `designs/<name>/refined.html` does **not** exist

Collect every folder that meets all three conditions. If none qualify, report "No unprocessed DECISION.md folders found" and stop.

### Batch Step B: Parse each DECISION.md

For each eligible folder, read its `DECISION.md` and extract:

- **Chosen variant letter** — look for explicit phrases like "Let's refine Variant E", "go with B", "I prefer C", "accept variant A", etc. (case-insensitive). If ambiguous, ask the user and do not process that folder until clarified.
- **Refinement requirements** — the full body of the DECISION.md (after any variant-selection sentence) is the refinement spec. Pass it verbatim as the refinements for that folder.

### Batch Step C: Report plan and confirm

Before processing, print a summary table:

| Folder | Variant | Refinement preview (first 80 chars) |
| ------ | ------- | ----------------------------------- |
| …      | …       | …                                   |

Ask the user: "Proceed with refining all N folders above?" — wait for confirmation before continuing.

### Batch Step D: Process sequentially via sub-agents

For each eligible folder in order, spawn a dedicated **`mpx-executor`** sub-agent to handle that folder end-to-end. Pass the sub-agent:

- The target folder path (`designs/<name>/`)
- The chosen variant letter and full refinement requirements extracted in Batch Step B
- The full text of this skill's Steps 2–10 as the task specification
- Instruction to skip Steps 8–9 (GitHub issue comment + unblock pass) — both are deferred until the user reviews the batch

Wait for each sub-agent to complete before spawning the next (sequential, not parallel) to avoid file-system conflicts and to keep token usage predictable.

After each sub-agent completes, print a one-line status: ✓ `<folder>` refined (Variant X).

If a sub-agent fails or reports an error, log the failure, skip to the next folder, and include the failure in the final summary.

At the end, print a summary table of all folders processed, any that were skipped (with reasons), and any failures. Then, if issue numbers are known, run **Steps 8–9** (GitHub comment + unblock) in one pass for each successfully refined folder.

---

### Step 2: Locate Source Files

1. Infer the active current component from explicit context and current decisions; if more than one folder qualifies, ask the user rather than selecting by modification time.
2. Read: `designs/<component-name>/variants/variant-<letter>.html` (chosen variant)
3. Read: `designs/<component-name>/DESIGN_BRIEF_<COMPONENT_NAME>.md` (full brief)
4. Read: `designs/DESIGN_SYSTEM.md` if it exists (class names and component reference)

### Step 3: Inventory Available Components

For every component referenced in the brief or refinements:

- Check `src/lib/components/base/` and `src/lib/components/derived/` for existence
- Read component files to identify available props/variants
- Note gaps

### Step 4: Adopt Missing Components (if needed, preferably from shadcn-svelte or Bits UI)

1. Spawn `mpx-context7-docs-fetcher` to look up in shadcn-svelte (`/huntabyte/shadcn-svelte`) or Bits UI (`/huntabyte/bits-ui`)
2. Inspect the local primitive/component contracts and reuse the managed primitive by default. Before any command that would overwrite a managed primitive, show the impact and obtain explicit user approval; never default to `--overwrite`.
3. If approved and genuinely missing, install with the minimum non-overwriting command supported by the local project, then record adoption in SUMMARY.md.

### Step 5: Produce `refined.html`

Create `designs/<component-name>/refined.html`.

The refined HTML must:

- Use the chosen variant as visual and structural base
- Apply **every** refinement requirement
- Cover all states from the brief (not just the happy path)
- Link the current compiled design-review CSS (or inline the required compiled subset derived from `src/app.css` when no review stylesheet exists); `designs/tokens.css` is historical reference only and is not linked by default
- Match local component APIs and stories exactly (for example, Button uses `intent` and Badge uses `tone`)
- Use Tailwind utility classes and design system classes throughout
- Only component-specific styles in `<style>`
- Realistic mock data
- Header label: `REFINED — Variant <X> + <short refinement summary>` styled as eyebrow text
- Respect Container Context from the brief — show parent chrome at reduced opacity

### Step 6: Create `SUMMARY.md`

Create `designs/<component-name>/SUMMARY.md`.

The summary must **not** duplicate content from the design brief. All design requirements, states, and layout rules live in the brief. The summary captures the implementation-relevant decisions and component map.

```markdown
# <Component Name> — Design Summary

**Base**: Variant <X> | **Refined**: <date>

## Refinements Applied

Variant <X> was chosen and refined with: [comma-separated list]. See the design brief for full
requirements. Key changes from the base variant: [1–3 concise sentences on structural differences].

## Component Map

### Codebase — Use As-Is

| Component | Path                              | Usage         | Key Props/Variants         |
| --------- | --------------------------------- | ------------- | -------------------------- |
| Button    | `src/lib/components/base/button/` | [where + how] | `intent="ghost" size="sm"` |
| Badge     | `src/lib/components/base/badge/`  | [where + how] | `tone="success"`           |

### Adopt from shadcn-svelte / Bits UI

| Component | Source        | Install command                            | Purpose          |
| --------- | ------------- | ------------------------------------------ | ---------------- |
| [name]    | shadcn-svelte | `pnpm dlx shadcn-svelte@latest add [name]` | [what it covers] |

### Build Custom

| Proposed Name | Description    | Why existing components don't cover it |
| ------------- | -------------- | -------------------------------------- |
| [name]        | [what it does] | [reason]                               |

## Implementation Notes

[Animation approach, event model, accessibility, keyboard nav, scroll behavior, edge cases to
handle in Svelte. Only things not already in the brief.]
```

### Step 7: Update Design Brief

Prepend a refinement block below the `# Title` heading:

```markdown
> **Status**: Refined (Variant <X>)
> **Refined mockup**: `designs/<component-name>/refined.html`
> **Summary**: `designs/<component-name>/SUMMARY.md`
> **Refinements**: [comma-separated short list]
```

If the refinement process revealed missing requirements or corrections, add/update them in the brief's relevant sections rather than documenting them separately in the summary.

### Step 8: Link to GitHub Issue

Ask for the associated GitHub issue number if not known (the **design issue** — the one this refinement satisfies).

Post a comment recording the refinement:

```bash
gh issue comment <number> --body "## Design Refined

Variant **<X>** refined: [comma-separated refinements]

**Artifacts:**
- \`designs/<component-name>/refined.html\` — open in browser to review
- \`designs/<component-name>/SUMMARY.md\` — component map + implementation notes
- \`designs/<component-name>/DESIGN_BRIEF_<COMPONENT_NAME>.md\` — updated brief"
```

### Step 9: Unblock Dependent Issues

Refining a design unblocks every issue that was waiting on it. Find those issues and clear the gate.

1. **Ensure the label exists**. Check if `Design needed` exists in the repo:

    ```bash
    gh label list --search "Design needed" --json name -q '.[].name'
    ```

    If not found, create it:

    ```bash
    gh label create "Design needed" --color "FBCA04" --description "Design must be completed before implementation"
    ```

2. **Find candidates**. Build a candidate list from any of these signals (use whichever yield results — they're complementary):
    - Sub-issues of the design issue: `gh issue view <design-issue> --json subIssues -q '.subIssues[].number'`
    - Issues that link to the design folder in their body: `gh issue list --search "designs/<component-name>" --state open --json number,title,labels`
    - Issues with the **`Design needed`** label that mention the component name: `gh issue list --label "Design needed" --search "<component-name>" --state open --json number,title,labels`
    - Issues that explicitly list the design issue as a `blocked-by` (parse body for `Blocked by #<design-issue>`).

3. **Filter** to issues that actually depend on this specific design (skim the body if uncertain — do not strip labels from unrelated issues).

4. **Remove the `Design needed` label** from each confirmed dependent:

    ```bash
    gh issue edit <number> --remove-label "Design needed"
    ```

    If the label name in the repo is different (e.g. `needs-design`, `blocked: design`), match the repo's actual label — discover via `gh label list --search design`.

5. **Report** which issues were unblocked.

If the user has not yet reviewed `refined.html` and approved it, **skip steps 3–4** and instead report "Pending user approval — re-run unblock pass once approved." Do not strip labels speculatively.

If no GitHub remote is configured or `gh` is unavailable, skip this step and note it in the report.

### Step 10: Open & Report

Open `refined.html` in Chrome DevTools MCP if available for the user to review.

Report (concise, in this order):

1. **Artifacts**: `refined.html` path, `SUMMARY.md` path, brief updated.
2. **Component map**: counts only — N reuse, N adopted, N custom.
3. **Unblocked issues**: bulleted list of `#<num> — <title>` for every issue whose `Design needed` label was removed.
4. **Still blocked**: any candidate issues that were intentionally left labelled (with a one-line reason).
5. **Next steps**: what implementation work follows from this design.

## Folder Layout

```
designs/
└── <component-name>/
    ├── DESIGN_BRIEF_<COMPONENT_NAME>.md   ← scoped approved reference, subject to current DECISIONS
    ├── refined.html                        ← scoped approved visual reference, subject to current DECISIONS
    ├── SUMMARY.md                          ← component map + implementation notes
    └── variants/
        ├── variant-a.html                  ← kept for reference
        ├── variant-b.html
        └── DECISION.md                     ← decision notes (for batch mode)
```
