# App Background Theme – Design Brief

> **Status**: Refined (Variant A)
> **Refined mockup**: `designs/app-background-theme/refined.html`
> **Summary**: `designs/app-background-theme/SUMMARY.md`
> **Refinements**: full three-theme coverage, both light+dark mode frames, explicit independence from color-mode control, RadioGroup aria semantics (role=radio/radiogroup/aria-checked + roving tabindex), WCAG AA focus-visible rings, all interactive states, correct data-bg-theme on app root (REQ-3), corrected CSS selectors to :not(.dark)/.dark, ../tokens.css path

A per-user **appearance preference** that recolors the app's neutral background and surface tones – `default`, `golden-hour`, or `twilight` – applied app-wide via a `data-bg-theme` attribute on the root element. It is a **separate, independent control** from the existing light/dark/system color-mode toggle, and entirely separate from per-wishlist identity themes. This brief covers the Settings → Appearance UI that exposes and persists the choice.

**Source**: GitHub issue #38 – "Add app background theme UI". Blocked by #34 (token foundation) and #35 (persisted user preference).

---

## 1. Purpose

The app already ships the background-theme CSS (`src/palette-colors.css`): three neutral palettes that subtly tint the chrome – `default` (true neutral, warm-grey), `golden-hour` (warm amber-tinted neutrals, hue ~70–85°), and `twilight` (cool blue-tinted neutrals, hue ~205–225°). Each palette is defined for **both** light and dark mode and applied by setting `data-bg-theme` on the app root/html element. What's missing is the production surface that lets a user pick one and have it persist.

This brief designs that surface: a background-theme chooser living in the Settings → Appearance card, **next to** the existing color-mode (light/dark/system) control. The two controls answer two different questions:

- **Color mode** = "Is the app bright or dark right now?" (light / dark / system)
- **Background theme** = "What tint do the neutral surfaces carry?" (default / golden-hour / twilight)

Both compose: golden-hour has a distinct look in light vs dark. The UI must make this two-axis relationship legible so users don't confuse the background theme with dark mode.

**Key value**: A one-line setting that lets users warm up or cool down the entire app's chrome to taste – independent of brightness and independent of any wishlist's festive theme.

---

## 2. Surrounding Context

The mockup **MUST** show the full Settings page viewport with the app shell chrome at correct proportions. The background-theme chooser is the focused element.

### Full Viewport Structure (top to bottom)

1. **Top navbar** (`--nav-height` = 56px, sticky): logo "prejemesi" with dimmed ".cz" TLD on the left; nav links (Moje seznamy / Spravované / Sledované); right cluster – "Vytvořit" primary button, notification bell (ghost), dark-mode cycle toggle (ghost), avatar. Reproduce faithfully but **dimmed/at-context fidelity** – it is parent chrome, not the design target. See `designs/app-shell/variant-1.html`.
2. **Settings content area**: constrained to `max-width: 48rem` (768px), left-aligned within the content column (NOT centered full-bleed). Vertical stack of setting cards with `--space-6` gap.
    - Page header: `h1` "Nastavení" (`text-2xl`, bold) + muted subtitle "Spravujte svůj profil, zabezpečení a předvolby".
    - Cards in order: **Profil**, **Zabezpečení**, **Oznámení**, **Vzhled (Appearance)** ← focus, **Nebezpečná zóna**.
3. **Appearance card** (`Vzhled`) – the design target. Card header: palette icon + "Vzhled" title + "Motiv a jazyk aplikace" description. Card content currently holds: **Color mode** (ToggleGroup: Světlý / Tmavý / Systém), a Separator, then **Language** (Čeština / English). This brief INSERTS a **Background theme** control into this card.

**What parent provides**: navbar, page header, sibling setting cards, card chrome (`Card.Root/Header/Title/Description/Content`).
**What this component fills**: a new labelled control group **inside the Appearance card content**, sitting between Color mode and Language (or grouped with Color mode under an "Appearance/Display" subgroup – designer's choice within constraints).
**Must NOT include**: navbar redesign, new page routing, wishlist theme pickers.

**Mockup rendering instructions**:

- Show full viewport at ~1440×900 proportions; navbar + page header + at least the Appearance card fully visible. Adjacent cards (Profil above, Nebezpečná zóna below) may be partially shown to establish stacking context.
- The Appearance card is the focus – render it at full fidelity. Other cards may be shown collapsed/summarized.
- Because the choice affects the **whole app background**, each variant must demonstrate the chosen background applied to the page (not just a swatch) AND show how it reads in both light and dark mode (side-by-side preview, light/dark mini-frames, or a toggle within the preview).

---

## 3. Requirements

### 3.1 The three background-theme options

Source of truth: `src/palette-colors.css` (golden-hour, twilight) + `src/app.css` (`:root` = default light, `.dark` = default dark). Tokens each theme drives:

| Token                | Role in preview                     |
| -------------------- | ----------------------------------- |
| `--background`       | Page background – the dominant tint |
| `--surface-2`        | Card / raised surface               |
| `--surface-3`        | Deeper surface (inputs, wells)      |
| `--border`           | Hairlines                           |
| `--foreground-muted` | Secondary text                      |

Option values + accurate preview colors (use these EXACT oklch values in mockups; reference, do not re-derive):

| Theme           | `data-bg-theme`      | Light `--background`        | Dark `--background`           | Character          |
| --------------- | -------------------- | --------------------------- | ----------------------------- | ------------------ |
| **Default**     | _(none / `default`)_ | `oklch(100% 0 0)`           | `oklch(15.3% 0.006 107.1deg)` | Pure neutral       |
| **Golden Hour** | `golden-hour`        | `oklch(98.5% 0.006 80deg)`  | `oklch(15.5% 0.02 60deg)`     | Warm amber neutral |
| **Twilight**    | `twilight`           | `oklch(98.5% 0.006 210deg)` | `oklch(15.5% 0.02 225deg)`    | Cool blue neutral  |

Light surface-2 values: default `oklch(96.7% 0.001 286)`, golden `oklch(96.5% 0.01 80)`, twilight `oklch(96.5% 0.01 210)`.
Dark surface-2 values: default `oklch(27.4% 0.006 286)`, golden `oklch(22.5% 0.024 60)`, twilight `oklch(22.5% 0.024 225)`.

- REQ-1: Expose all three as a single-select chooser. Exactly one is active at a time.
- Each option must show a **realistic preview** of the actual background tint, not a flat brand-color dot. The preview must convey what the app chrome looks like (a mini surface stack: background + a card + a text line + a hairline border), so the subtle neutral differences are visible – these palettes differ by a few percent chroma, so a plain dot would look identical across all three.
- Czech labels: `Výchozí` (Default), `Zlatá hodinka` (Golden Hour), `Soumrak` (Twilight). English: `Default`, `Golden hour`, `Twilight`. (New message keys: `settings_bg_theme_label`, `settings_bg_theme_default`, `settings_bg_theme_golden_hour`, `settings_bg_theme_twilight`, plus a one-line helper `settings_bg_theme_description`.)
- A short helper line under the control: CS "Zabarvení pozadí aplikace – nezávislé na světlém/tmavém režimu." EN "Tints the app background – independent of light/dark mode."

### 3.2 Independence from color mode (REQ-5)

- The background-theme control and the color-mode control are **two distinct controls** in the same card. The UI must make it obvious they are orthogonal – not a single 5-way list mixing "Light / Dark / Golden hour".
- Each background preview must reflect the **current** color mode (if app is in dark mode, previews show the dark variant of each theme) OR explicitly show both – variant-dependent. At minimum the user must understand "this tint applies in whatever brightness mode I'm in".
- Recommended: a small inline note or layout grouping that reads "Background theme works in both light and dark."

### 3.3 Independence from wishlist themes (REQ-4)

- Background theme drives only the neutral chrome tokens (`--background`, `--surface-*`, `--border`, `--foreground-muted`). It must NOT touch `--primary`, `--wishlist-*`, or any accent/identity token.
- No mockup copy should imply this changes wishlist colors. If helpful, a one-line clarifier: "Neovlivňuje barvy jednotlivých seznamů." / "Does not affect individual wishlist colors." (optional, low-emphasis).

### 3.4 Selection, persistence & application (REQ-2, REQ-3)

- Selecting an option is immediate (optimistic): the whole app background updates live by setting `data-bg-theme` on the root, AND the choice is persisted per-user (via the #35 preference mechanism) so it survives reload and crosses sessions/devices.
- Default selection when no preference stored: `default` (no attribute, or `data-bg-theme="default"`).
- A subtle "Uloženo" / "Saved" affordance is acceptable but not required to be a blocking save button – treat like the existing color-mode toggle (instant apply). No explicit Save button for this control.

### 3.5 Accessibility

- Single-select group must be keyboard operable (arrow keys move selection, Space/Enter selects) and expose `aria-checked` / `role="radio"` semantics (RadioGroup) or `aria-pressed` single ToggleGroup semantics.
- Each option needs an accessible name (the Czech/English label), not just a color swatch.
- Selected state must be conveyed by more than color alone (ring + check icon).
- Preview swatches are decorative (`aria-hidden`) – the label carries the name.

---

## 4. States

| State                | Visual Treatment                                                                | Trigger                           |
| -------------------- | ------------------------------------------------------------------------------- | --------------------------------- |
| Default (unselected) | Option card/row with neutral border, preview swatch, label                      | Not the active theme              |
| Selected             | `--primary` ring (2px) + check icon (top-right or inline), label `--foreground` | Active theme                      |
| Hover                | `--border-strong` border, slight `--surface-hover` background, subtle lift      | Pointer over an unselected option |
| Focus-visible        | `--ring` focus outline (`--focus-ring-width` 3px, offset 2px)                   | Keyboard focus                    |
| Active/press         | `scale(0.97)` on the option                                                     | Pointer down                      |
| Saving (optional)    | Brief inline "Ukládání…" → "Uloženo" text or check pulse                        | Selection sent to server          |
| Save error (rare)    | Toast (svelte-sonner) "Nepodařilo se uložit nastavení"; revert selection        | Persist request fails             |

---

## 5. Component Reuse Map

### Existing Components (MUST use)

| Component       | Variant/Props                                | Usage in This Design                                                                           |
| --------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Card.*`        | Root/Header/Title/Description/Content        | The Appearance card shell (already in place – reuse, do not re-create)                         |
| `Label`         | default                                      | "Barevný režim", "Zabarvení pozadí", "Jazyk" group labels                                      |
| `ToggleGroup.*` | `type="single"`, `Item` with `aria-label`    | Color-mode control (existing) and a candidate pattern for background theme (segmented variant) |
| `RadioGroup.*`  | `type="single"`                              | Candidate pattern for background theme as accessible card/list selection                       |
| `Separator`     | default                                      | Divides Color mode / Background theme / Language groups                                        |
| `HelpText`      | default                                      | The one-line helper under the background-theme control                                         |
| `Badge`         | `tone` (e.g. neutral/primary)                | Optional "Aktivní" / "Light · Dark" hint chips on the active option or preview                 |
| `Tooltip`       | default                                      | Optional info on the independence note                                                         |
| `Toast`         | `toast()` from svelte-sonner                 | Save-error feedback                                                                            |
| Lucide icons    | `palette`, `sun`, `moon`, `monitor`, `check` | Card header (palette), mode icons (existing), selected check                                   |

### Components to Adopt (install from shadcn-svelte)

None required – RadioGroup, ToggleGroup, Card, HelpText all exist in `base/`.

### Components to Design (new)

| Component                        | Description                                                                                                                                 | Why New                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `BackgroundThemePreview`         | Small token-driven preview tile rendering background + card + text line + border for a given `data-bg-theme` (and mode)                     | No existing component renders a live mini-surface stack from theme tokens |
| `BackgroundThemeChooser` (block) | Composes the three previews into a single-select group inside the Appearance card; wires selection to `data-bg-theme` on root + persistence | Feature-level composition specific to this setting                        |

These are thin compositions; prefer building on `RadioGroup`/`ToggleGroup` semantics rather than bespoke click handling.

---

## 6. Layout Constraints

- Lives inside the Appearance `Card.Content`, which is inside the `max-w-3xl` (48rem) settings column. Available inner width ≈ 700px.
- Control group vertical rhythm matches existing groups: `flex flex-col gap-2` for label→control, `gap-6` between groups, `Separator` between groups.
- Three options must fit in the available width: as a 3-up grid of preview cards (≈ 210px each with gaps), OR a vertical radio list with a preview thumbnail per row, OR a segmented control + one larger shared preview pane.
- Preview tiles: minimum 64px tall to legibly show the background+card+text stack. If showing both light & dark per option, split the tile or stack two mini-frames.
- Mobile (<640px): 3-up grid collapses to a single column or a horizontal scroller; segmented control wraps. Touch targets ≥ 40px.
- Typography: group `Label` uses default label size; helper text uses `HelpText` (smaller, `--foreground-muted`). Option labels `--text-sm`.

---

## 7. Design Tokens

From `src/app.css` (canonical) + `src/palette-colors.css` + `designs/tokens.css` (structural). Mockups link `../../tokens.css` and inline the **base light/dark palette** + the **three bg-theme overrides** locally (since tokens.css carries only structural tokens, not the color palette).

Relevant tokens:

- **Backgrounds/surfaces**: `--background`, `--surface` / `--card`, `--surface-2` / `--secondary`, `--surface-3` / `--muted`, `--surface-hover`, `--sidebar-bg`.
- **Borders**: `--border`, `--border-strong`.
- **Text**: `--foreground`, `--foreground-muted`, `--foreground-subtle`.
- **Selection/identity (do NOT recolor via bg-theme)**: `--primary` `oklch(52.7% 0.154 150)`, `--primary-foreground`, `--primary-soft`, `--ring`. Used for selected ring + check.
- **Radii**: `--radius-md` (8px) options, `--radius-lg` (12px) card.
- **Motion**: `--duration-normal` 150ms, `--ease-standard` for hover/selection transitions.
- **Fonts**: `--font-sans` Figtree (body/labels), `--font-heading` Noto Sans (card title).
- **Focus**: `--focus-ring-width` 3px, `--focus-ring-offset` 2px, color `--ring`.

The three palettes (exact, from source):

```css
/* Default – from app.css :root / .dark (no data-bg-theme attribute) */
/* light  --background: oklch(100% 0 0);          --surface-2: oklch(96.7% 0.001 286) */
/* dark   --background: oklch(15.3% 0.006 107.1);  --surface-2: oklch(27.4% 0.006 286) */

[data-bg-theme='golden-hour']:not(.dark) {
	--background: oklch(98.5% 0.006 80deg);
	--surface-2: oklch(96.5% 0.01 80deg);
	--surface-3: oklch(94% 0.014 80deg);
	--border: oklch(90% 0.014 80deg);
	--foreground-muted: oklch(46% 0.02 70deg);
}
[data-bg-theme='golden-hour'].dark {
	--background: oklch(15.5% 0.02 60deg);
	--surface-2: oklch(22.5% 0.024 60deg);
	--surface-3: oklch(26.5% 0.026 60deg);
	--border: oklch(29.5% 0.024 55deg);
	--foreground-muted: oklch(73% 0.02 70deg);
}
[data-bg-theme='twilight']:not(.dark) {
	--background: oklch(98.5% 0.006 210deg);
	--surface-2: oklch(96.5% 0.01 210deg);
	--surface-3: oklch(94% 0.014 210deg);
	--border: oklch(90% 0.014 205deg);
	--foreground-muted: oklch(46% 0.02 220deg);
}
[data-bg-theme='twilight'].dark {
	--background: oklch(15.5% 0.02 225deg);
	--surface-2: oklch(22.5% 0.024 225deg);
	--surface-3: oklch(26.5% 0.026 225deg);
	--border: oklch(29.5% 0.024 218deg);
	--foreground-muted: oklch(73% 0.02 210deg);
}
```

---

## 8. Design Constraints (Non-Negotiable)

- Background theme is a **separate control** from color mode – never merge them into one list/segmented control with mixed semantics.
- Background theme drives ONLY neutral chrome tokens; it must NOT recolor `--primary`, accent, or `--wishlist-*` tokens. Selected-state ring/check uses `--primary` (the app accent) – that's fine; the previews themselves must not change accent.
- Previews must be **token-driven and realistic** (background + surface + text + border), not flat brand dots – the differences are subtle neutrals.
- The chosen background applies app-wide via `data-bg-theme` on the root; selection is instant + persisted (no Save button for this control), matching the existing color-mode UX.
- Reuse the existing Appearance `Card` and `Separator` rhythm; do not introduce a new page or modal.
- Selected state conveyed by ring + check icon, not color alone (a11y).
- Use semantic tokens only; no raw hex, no `bg-blue-500`. Czech is primary language in copy.
- Must work in light and dark mode; each variant demonstrates both.

## 9. Design Freedom

- Presentation of the chooser – this is the axis the three variants explore:
    - **A**: large preview cards (3-up grid), each card splitting/showing light+dark.
    - **B**: vertical radio list with a thumbnail per row + a larger shared live-preview pane reflecting current mode.
    - **C**: compact segmented control (label-only) paired with a single full-bleed live preview that updates, plus a light/dark split inside that preview.
- Whether previews show light & dark side-by-side per option, or follow the current mode with a "shown in your current mode" note.
- Placement of the selected check (corner vs inline), use of an "Aktivní" badge.
- Where the independence note sits (inline helper, tooltip, grouped heading).
- Hover/selection micro-interactions within the motion tokens.
- Whether Color mode and Background theme share a subgrouped "Display" heading or stay as flat labelled groups.

## 10. Visual References

- **Internal**:
    - `src/lib/components/blocks/settings/SettingsAppearanceSection.svelte` – the card being extended (color-mode ToggleGroup + language).
    - `src/routes/(app)/settings/+page.svelte` – settings page layout (`max-w-3xl`, stacked cards).
    - `designs/app-shell/variant-1.html` – navbar chrome to reproduce as context.
    - `src/palette-colors.css` – the exact bg-theme palettes.
    - `designs/dashboard/` & `designs/wishlist-page/` variants – card/badge styling consistency.
- **External**: OS-style appearance pickers (macOS System Settings Appearance row, VS Code theme tiles) – labelled preview tiles with a selected ring.

## 11. Not Included (Scope Exclusions)

- The persistence backend / preference schema (issue #35) – this brief assumes it exists and the chooser writes to it.
- The token foundation itself (issue #34) and the palette CSS (already in `palette-colors.css`).
- Wishlist identity theme picker (separate feature, per-wishlist).
- Accent-color picker (`data-accent` in `accent-colors.css`) – out of scope unless later folded in.
- Adding new background-theme palettes beyond the three shipped.
- E2E test code (acceptance criterion, implemented during build – not part of the mockup).
