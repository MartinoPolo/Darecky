# App Background Theme – Design Summary

**Base**: Variant A | **Refined**: 2026-06-02

## Refinements Applied

Variant A chosen and refined with: full three-theme coverage, both light and dark mode frames, independence from color-mode control made explicit, RadioGroup aria semantics (role=radio/radiogroup/aria-checked), WCAG AA focus-visible rings via --ring/--focus-ring-width, all interactive states (hover/focus/active/selected/unselected), correct data-bg-theme on app root for live tinting (REQ-3), correct CSS selectors matching production, ../tokens.css path fix.

Key changes from base variant: 4 scenario frames vs 1 in variant-a.html; selectors corrected to :not(.dark)/.dark (production) instead of .theme-light/.theme-dark; ../tokens.css replaces ../../tokens.css; roving tabindex added. See the design brief for full requirements.

## Component Map

### Codebase – Use As-Is

| Component        | Path                                         | Usage                                | Key Props/Variants                    |
| ---------------- | -------------------------------------------- | ------------------------------------ | ------------------------------------- |
| Card.\*          | src/lib/components/base/card/                | Appearance card shell                | Root/Header/Title/Description/Content |
| Label            | src/lib/components/base/label/               | Group labels                         | default                               |
| ToggleGroup.\*   | src/lib/components/base/toggle-group/        | Color-mode control (existing)        | type="single", Item with aria-label   |
| RadioGroup.\*    | src/lib/components/base/radio-group/         | BackgroundThemeChooser single-select | type="single", roving tabindex        |
| Separator        | src/lib/components/base/separator/           | Divides control groups               | default horizontal                    |
| HelpText         | src/lib/components/base/help-text/           | Independence note under chooser      | default (foreground-muted, text-sm)   |
| Toast            | src/lib/components/base/toast/               | Save-error feedback                  | error variant                         |
| dark-mode-toggle | src/lib/components/derived/dark-mode-toggle/ | Existing control, not modified       | –                                     |

### Adopt from shadcn-svelte / Bits UI

None required. All primitives exist in base/.

### Build Custom

| Proposed Name          | Description                                                                | Why existing components do not cover it                                      |
| ---------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| BackgroundThemePreview | Token-driven tile: background+surface+lines+chip for a theme+mode pair     | No existing component renders a live mini-surface stack from bg-theme tokens |
| BackgroundThemeChooser | Composes 3 previews in a RadioGroup; sets data-bg-theme on root + persists | Feature-level composition; no generic equivalent                             |

## Implementation Notes

**Persistence (REQ-2, REQ-3)**: Optimistic – set data-bg-theme on layout root immediately, persist via issue-#35 preference store. On error: revert + toast.error. No Save button.

**data-bg-theme application (REQ-3)**: Attribute on layout root. palette-colors.css selectors use [data-bg-theme="golden-hour"]:not(.dark) and .dark – orthogonal to the .dark class for brightness. Both coexist on the same element.

**Independence from color mode (REQ-5)**: BackgroundThemeChooser never reads/modifies .dark. Two axes: .dark (brightness) and data-bg-theme (tint). Controls shown side-by-side with separate labels, never merged.

**Independence from wishlist tokens (REQ-4)**: Touches only --background, --surface-_, --border_, --foreground-muted/subtle. Must NOT touch --primary, --ring, --wishlist-\*.

**Keyboard nav**: role=radiogroup container, roving tabindex (selected=0, others=-1). Arrow Left/Right move focus+select. Space/Enter select.

**Mini-preview tile colors**: Hardcoded (not CSS custom properties) so tiles show both light AND dark simultaneously regardless of page color mode. Locked to src/palette-colors.css – update both together if palette changes.

**Proposed i18n keys**: settings_bg_theme_label, settings_bg_theme_default, settings_bg_theme_golden_hour, settings_bg_theme_twilight, settings_bg_theme_description, settings_bg_theme_saved, settings_bg_theme_saving, settings_bg_theme_error, settings_bg_theme_note_default, settings_bg_theme_note_golden, settings_bg_theme_note_twilight.
