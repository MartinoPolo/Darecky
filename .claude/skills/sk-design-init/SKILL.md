---
name: sk-design-init
description: 'Bootstrap the project visual identity — generate design tokens, design system docs, and font/color decisions from project context. Run once per project. Use when: "design init", "setup design", "init design system", "visual identity", "design tokens", "bootstrap design"'
argument-hint: ''
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent, mcp__context7__resolve-library-id, mcp__context7__query-docs
metadata:
    author: MartinoPolo
    version: '0.1'
    category: design
---

# Design System Initialization

Bootstrap the project's visual identity. Reads the project description and requirements, derives an opinionated visual style that matches the app's domain, grills the user on remaining taste decisions, then generates `designs/DESIGN_SYSTEM.md` and `designs/tokens.css`.

**Run once per project.** Subsequent runs overwrite the design system — confirm with user first.

## Process

### Step 1: Gather Project Context

Read these files to understand what the app is and who it's for:

1. `.mpx/CONTEXT.md` — "What This Is" section for app description, domain language, key constraints
2. `.mpx/DECISIONS.md` — any existing UI & Design decisions
3. `components.json` — shadcn-svelte configuration (style, base color, icon library)
4. `src/app.css` — current Tailwind/CSS theme variables
5. `package.json` — project name and description

If `.mpx/CONTEXT.md` doesn't exist or has no "What This Is" content, ask the user to describe the app in 2-3 sentences before proceeding.

### Step 2: Derive Visual Identity from Domain

This is the opinionated step. Based on the project description, **recommend** a complete visual direction:

**Color palette**: Match the app's domain and emotional tone.

- A wishlist app → warm yellows and golds (anticipation, joy)
- A finance tracker → deep blues and greens (trust, growth)
- A health app → soft greens and whites (calm, vitality)
- A developer tool → dark surfaces with accent highlights (focus, precision)
- A social platform → vibrant, varied palette (energy, expression)

**Font pairing**: Recommend a specific pair (heading + body) that matches the personality. Always use Google Fonts for availability. Never recommend generic system fonts unless the app demands maximum performance.

**Density**: Recommend based on content type:

- Data-heavy → dense (tight spacing, smaller type)
- Content/reading → airy (generous whitespace, larger type)
- Mixed → medium

**Motion**: Recommend based on app character:

- Professional/utility → subtle (150-200ms ease-out)
- Consumer/playful → expressive (spring animations, 300ms)
- Data dashboard → minimal (only loading states)

**Border radius**: Recommend based on personality:

- Friendly/consumer → rounded (8-12px)
- Professional/utility → slightly rounded (4-6px)
- Technical/dense → sharp (2px or 0)

**Shadow depth**: Recommend based on UI style:

- Light mode flat → minimal shadows, border-based separation
- Light mode elevated → layered shadows for depth
- Dark mode → lighter surfaces for elevation, avoid shadows

Present the full recommendation as a cohesive vision statement (3-4 sentences) followed by the specific values. Explain WHY each choice fits the app.

### Step 3: Grill on Remaining Decisions

After presenting the recommendation, grill the user on:

1. **Overall direction**: Does this feel right? Too playful? Too corporate?
2. **Light/dark/both**: Primary mode? Should tokens support both?
3. **Font overrides**: Any strong font preferences that override the recommendation?
4. **Color adjustments**: Any brand colors that must be incorporated?
5. **Anything the recommendation missed**: Specific UI patterns, density for specific views?

Iterate until the user confirms the direction.

### Step 4: Read shadcn-svelte Theme

The project uses shadcn-svelte with a configured style and base color. Read what's already set:

1. Parse `components.json` for `style` and `tailwind.baseColor`
2. Read `src/app.css` for existing CSS custom properties (shadcn-svelte generates these)
3. Spawn `mp-context7-docs-fetcher` to check shadcn-svelte theming docs if needed

The design tokens should **complement** the shadcn-svelte theme, not replace it. shadcn-svelte owns the component-level tokens (button colors, input borders, etc.). The design system tokens cover:

- App-level semantics (primary brand color, accent, semantic colors)
- Typography (font families, size scale beyond what Tailwind provides)
- Spacing philosophy and density rules
- Shadow and radius values for custom components
- Motion/transition standards

### Step 5: Generate `designs/tokens.css`

Populate the stub at `designs/tokens.css` with concrete values. Structure:

```css
:root {
	/* -- Typography -- */
	--font-sans: 'Font Name', system-ui, sans-serif;
	--font-mono: 'Mono Font', ui-monospace, monospace;

	/* -- Colors (light mode) -- */
	--color-primary: oklch(...);
	--color-secondary: oklch(...);
	/* ... all semantic colors ... */

	/* -- Spacing -- */
	--space-1: 4px;
	--space-2: 8px;
	/* ... full scale ... */

	/* -- Radii, Shadows, Motion -- */
	/* ... */
}

/* Dark mode overrides (if applicable) */
.dark {
	/* ... */
}
```

Use OKLCH color format for perceptual uniformity. Include Google Fonts `@import` at the top.

### Step 6: Generate `designs/DESIGN_SYSTEM.md`

Populate the stub at `designs/DESIGN_SYSTEM.md` with the settled design language:

- **Typography**: font families with rationale, size scale (heading 1-4, body, small, caption), weight usage, letter-spacing rules for headings
- **Color Palette**: every token with its hex/oklch value, usage guidance, and contrast notes
- **Spacing & Layout**: the spacing scale, when to use each value, grid/flex preferences, density rules
- **Component Patterns**: how to use shadcn-svelte components within this design language, variant preferences, icon sizing
- **Motion & Transitions**: timing functions, duration standards, what animates and what doesn't

This file is the reference document that `sk-design-brief`, `sk-mockup`, and `sk-design-refine` all read.

### Step 7: Update `.mpx/DECISIONS.md`

Update the existing design categories with user-confirmed, date-sorted inline decisions:

```markdown
- YYYY-MM-DD: [Decision, with material rationale and explicitly rejected alternatives inline only when needed.]
```

Replace superseded rules rather than appending contradictory versions. Do not infer rejection from choosing another option. Typical entries cover fonts, palettes, density, motion, and light/dark strategy.

### Step 8: Report

Summarize:

1. Visual identity in one sentence
2. Files generated/updated
3. Remind user that `sk-design-brief` → `sk-mockup` → `sk-design-refine` pipeline will now use these tokens
