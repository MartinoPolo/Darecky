# Settings Control Review — Design Summary

**Base**: Variant A | **Refined**: 2026-09-05

## Refinements Applied

The user accepted Variant A's picker, palette choices and demonstrated data lifecycle. The refined artifact retains those controls and explicitly marks the simplified modal, tabs and surrounding app as context, not a redesign. See the design brief for authoritative requirements and approval boundaries.

## Component Map

### Codebase — Use As-Is

| Component                  | Path                                                                   | Usage                                | Key Props/Variants                                                   |
| -------------------------- | ---------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| Button                     | `src/lib/components/base/button/`                                      | Picker and global actions            | `intent="primary"` / `"outline"`, `size="md"`, `disabled`            |
| Popover                    | `src/lib/components/base/popover/`                                     | Picker placement/dismissal           | Existing trigger/content and focus lifecycle                         |
| Input                      | `src/lib/components/base/input/`                                       | Hex field                            | Controlled value and accessible validation                           |
| Dialog                     | `src/lib/components/base/dialog/`                                      | Settings and exit guard              | `Content size="md"`, existing focus restoration                      |
| WishlistSettingsModal      | `src/lib/components/blocks/wishlist/WishlistSettingsModal.svelte`      | Parent draft and guarded global save | Existing composite draft callbacks                                   |
| WishlistSettingsSaveButton | `src/lib/components/blocks/wishlist/WishlistSettingsSaveButton.svelte` | Global save state                    | Existing disabled/pending presentation                               |
| WishlistCategorySettings   | `src/lib/components/blocks/wishlist/WishlistCategorySettings.svelte`   | Category draft owner                 | `saving`, `commitVersion`, `ondraftchange`                           |
| WishlistPaletteAutoSave    | `src/lib/components/blocks/wishlist/WishlistPaletteAutoSave.svelte`    | Existing staged palette boundary     | `palette`, `onselect`, `commitVersion`, `discardVersion`, `disabled` |

### Adopt from shadcn-svelte / Bits UI

None. Existing primitives cover the interaction; no dependencies were installed.

### Build Custom

| Existing component to adapt                    | Description                                                   | Why adaptation is needed                                                                |
| ---------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `derived/color-picker/ColorPicker.svelte`      | Local draft and explicit acceptance around existing picker UI | Current `value` / `onValueChange` commits on selection; defer callback until local Save |
| `blocks/wishlist/WishlistPalettePicker.svelte` | Compact, centered choice layout                               | Preserve `value`, `onchange`, `disabled`; remove stretched choice widths                |

## Implementation Notes

The prototype uses only in-memory saved/draft values; it is not production mutation evidence. Keep the existing Svelte modal/tab layout and production focus/dismissal primitives, not the hand-written HTML dialog scaffolding. Native color-dialog acceptance only changes the picker draft. The debug ledger, fixture switches and reduced-opacity context never ship. Acceptance of settings does not approve gift geometry or close implementation issues.
