---
name: sk-design-brief
description:
    'Guide creation of a design brief with component inventory and recommendations. Use when:
    "design brief", "create brief", "design spec", "write brief", "component spec", "UI spec"'
argument-hint: '[component-name]'
allowed-tools: Read, Write, Glob, Grep, Bash(gh *), Agent, WebFetch
metadata:
    author: MartinoPolo
    version: '0.1'
    category: design
---

# Design Brief Creation

Guide the creation of a comprehensive, standalone design brief for a UI component. The brief must be
complete enough that a designer (human or AI) can produce a pixel-accurate mockup without asking
clarifying questions.

## Philosophy

1. **Context is king** — every component lives somewhere. Show WHERE it lives, WHAT surrounds it,
   and HOW MUCH SPACE it has. The mockup must reflect actual proportions.
2. **Reuse over invention** — always specify which existing components to reuse (Button variants,
   Badge styles, etc.). Only design new primitives when no existing component fits.
3. **Requirements-driven** — scrape every source: GitHub issues, PRDs, existing implementations.
   Human decisions (from grilling sessions, issue comments, PRD text) take highest priority.
4. **Complete standalone** — the brief should be self-contained. Anyone reading it understands the
   full picture without needing to cross-reference other files.

## Available UI Components

!`ls src/lib/components/base/ 2>/dev/null | sort`

## Existing Designs

!`ls designs/ 2>/dev/null`

## Process

### Step 1: Gather ALL Requirements

Before writing anything, exhaustively research the feature:

1. **GitHub issues**: Search for related issues/PRDs via `gh issue list --search "<keywords>"`. Read
   issue bodies, comments, and linked PRDs. Human decisions in comments are highest priority.
2. **Project docs**: Read any project context or decision files if they exist.
3. **Existing implementation**: If any code exists for this feature, read it. Understand current
   state vs. desired state.
4. **Related briefs**: Read any related design briefs under `designs/`.
5. **Design system**: Read `designs/DESIGN_SYSTEM.md` if it exists, or infer the design system from
   `src/app.css` and existing components.

### Step 2: Determine Surrounding Context (Critical)

This is the MOST IMPORTANT step. Every component exists within a visual hierarchy. Determine:

#### Where does this component live?

- **Page content**: Full-width content area within a layout
- **Sidebar content**: Narrower panel, typically 240-320px
- **Modal/Dialog**: Floats above everything. Specify backdrop treatment.
- **Card/Inline**: Embedded in a grid or list. Owns its boundary.
- **Layout shell**: Navigation, headers, footers — the structural chrome
- **Other**: Describe the specific context

#### What is the current state of surrounding elements?

Identify which surrounding elements are already implemented/designed and should be faithfully
reproduced vs. which are still being designed.

#### Document context explicitly in the brief:

```markdown
## Surrounding Context

**Viewport layout** (top to bottom, left to right):

- [Exact description of what's visible at the same time as this component]
- [Proportions and dimensions]
- [What's in FINAL state vs. what's still being designed]

**Mockup rendering instructions**:

- Show full viewport with all surrounding chrome at actual proportions
- Surrounding elements at full fidelity when in final state
- [Component being designed] clearly highlighted/focused
```

### Step 3: Inventory Existing Components to Reuse

This is critical — designers must know what building blocks are available:

1. Scan `src/lib/components/base/` — all shadcn-svelte components available
2. Scan `src/lib/components/derived/` — project-specific composed components
3. Read component files to identify available props/variants

For each component relevant to the feature, document:

- **Name** and import path
- **Available variants/props**
- **Where to use it** in this design

Be specific: say "use `Button variant='ghost'` with icon-only size" NOT "add a button."

### Step 4: Research Missing Primitives

If the feature needs UI patterns not in the inventory:

- Spawn `mp-context7-docs-fetcher` to check shadcn-svelte (`/huntabyte/shadcn-svelte`) and Bits UI
  (`/huntabyte/bits-ui`)
- Include as "Components to Adopt" with rationale for why existing components don't suffice

### Step 5: Draft the Brief

**Folder**: `designs/<component-name>/` (kebab-case) **File**:
`designs/<component-name>/DESIGN_BRIEF_<COMPONENT_NAME>.md` (screaming snake case)

Use this structure (all sections mandatory unless marked optional):

```markdown
# Component Name — Design Brief

[One-paragraph purpose statement. What it does, why it matters to the user, what problem it solves.]

**Source**: [PRD #, issue #, or feature area]

---

## 1. Purpose

[Expanded purpose. What workflow does this enable? What's the user's mental model? What question
does this UI answer at a glance?]

**Key value**: [One sentence — the elevator pitch for this component's existence]

---

## 2. Surrounding Context

The mockup **MUST** show the full viewport with all chrome elements at correct proportions.

### Full Viewport Structure (describe actual layout)

[Describe every element visible alongside this component. Be exhaustive.]

**What parent provides**: [navigation, layout shell, etc.] **What this component fills**: [e.g.,
"main content area, full width × remaining height"] **Must NOT include**: [e.g., "navigation chrome
— that belongs to the layout"]

**Mockup rendering instructions**:

- Show full viewport at ~1440×900 proportions
- [Component area] is the focus — other areas show real content but no design exploration
- [Specific proportion notes]

---

## 3. Requirements

### 3.1 [Subsection Name]

[Requirements as detailed bullet points. Include:]

- What data is shown (field names, sources, types)
- What actions are available (click targets, keyboard shortcuts)
- What happens on interaction (navigation, state changes, API calls)
- Edge cases (empty state, loading, error, overflow, truncation)

### 3.2 [Next Subsection]

[Continue with all requirement areas. Be exhaustive.]

---

## 4. States

List EVERY state this component can be in:

| State                     | Visual Treatment | Trigger |
| ------------------------- | ---------------- | ------- |
| Default                   | [description]    | [when]  |
| Loading                   | [description]    | [when]  |
| Empty                     | [description]    | [when]  |
| Error                     | [description]    | [when]  |
| Hover                     | [description]    | [when]  |
| Active/Focus              | [description]    | [when]  |
| Disabled                  | [description]    | [when]  |
| [feature-specific states] |                  |         |

---

## 5. Component Reuse Map

### Existing Components (MUST use)

| Component | Variant/Props                 | Usage in This Design   |
| --------- | ----------------------------- | ---------------------- |
| Button    | `variant="ghost"` size="icon" | Toolbar action buttons |
| Badge     | `variant="success"`           | Status indicators      |
| [etc.]    |                               |                        |

### Components to Adopt (install from shadcn-svelte)

| Component | Source        | Rationale                                  |
| --------- | ------------- | ------------------------------------------ |
| [name]    | shadcn-svelte | [why existing components don't cover this] |

### Components to Design (new)

| Component | Description    | Why New                           |
| --------- | -------------- | --------------------------------- |
| [name]    | [what it does] | [why no existing component works] |

---

## 6. Layout Constraints

- [Minimum/maximum dimensions]
- [Grid/flex behavior]
- [Responsive rules if any]
- [Spacing system]
- [Typography hierarchy]

---

## 7. Design Tokens

Reference the project's Tailwind/CSS theme from `src/app.css`:

- Font family (from tailwind config or app.css)
- [List specific tokens relevant to this component]
- [Color semantics: success/warning/danger/info uses]

---

## 8. Design Constraints (Non-Negotiable)

[Things the designer CANNOT change:]

- [Specific layout rules]
- [Component reuse requirements]
- [Accessibility requirements]
- [Consistency requirements with other components]
- [Technical constraints]

---

## 9. Design Freedom

[Areas where the designer HAS creative latitude:]

- [Layout arrangement options]
- [Animation/transition choices]
- [Visual emphasis approaches]
- [Information hierarchy within constraints]

---

## 10. Visual References

- **Internal**: [existing components to feel consistent with — list with file paths]
- **External** (optional): [inspiration links or descriptions]

---

## 11. Not Included (Scope Exclusions)

[Explicitly state what's OUT of scope to prevent scope creep:]

- [Feature X — belongs to PRD #Y]
- [Interaction Z — future iteration]
```

### Key Principles for Writing the Brief

1. **Specify components, not appearance**: Say "use `Button variant='ghost'` size='icon'" not
   "ghost-styled icon button." Reference exact variant names from the component library.
2. **Proportions matter**: The mockup must show components at their actual proportions within the
   layout.
3. **Requirements from humans beat requirements from code**: If a grilling session or issue comment
   says "do X," that overrides what the current code does.
4. **Complete state enumeration**: Every interactive element needs ALL states listed. Missing states
   = designer invents them = inconsistency.
5. **Container context is mandatory**: Always specify parent container. Show it in the mockup
   faithfully. Never let the designed component duplicate parent chrome.
6. **Match existing implementations**: If surrounding elements are in final state, the mockup should
   reproduce them accurately.
7. **Explain WHY, not just WHAT**: For every requirement, explain the user benefit.

### Step 6: Label Dependent Issues

After saving the brief, find implementation issues that depend on this design and gate them:

1. **Ensure the label exists**. Check if `Design needed` exists in the repo:

    ```bash
    gh label list --search "Design needed" --json name -q '.[].name'
    ```

    If not found, create it:

    ```bash
    gh label create "Design needed" --color "FBCA04" --description "Design must be completed before implementation"
    ```

2. **Find dependent issues**. Search for open issues that reference this component or are sub-issues
   of the design's parent PRD:
    - `gh issue list --search "<component-name>" --state open --json number,title,labels`
    - If a PRD issue number is known:
      `gh issue view <prd-number> --json subIssues -q '.subIssues[].number'`

3. **Add the label** to each implementation issue that cannot proceed without this design:

    ```bash
    gh issue edit <number> --add-label "Design needed"
    ```

4. **Report** which issues were labeled and why.

If no GitHub remote is configured or `gh` is unavailable, skip this step and note it in the report.

### Step 7: Save & Proceed

Save the brief. After saving, automatically invoke `/sk-mockup` to generate visual variant(s).
