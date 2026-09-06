# Wishlist Command Review — Design Summary

**Base**: Variant A | **Refined**: 2026-09-05

## Refinements Applied

Variant A retains the accepted mobile sheet hierarchy, hero action positions and gift selection geometry. Desktop Display and bulk categories now open adjacent child menus while keeping their roots visible. More/Settings remain icon-only, select-all matches gift checkboxes, and a compact top-left reorder visual has a larger actionable area. The user approved this direction. Duplicate selected-count and current/mixed-value summaries in the mobile bulk sheet are removed at their two rendering owners, with regression checks across its categories. See the design brief for requirements. The scoped command design phase is complete; implementation issues remain open.

## Component Map

### Codebase — Use As-Is

| Component           | Path                                                            | Usage                                        | Key Props/Variants                                                                                    |
| ------------------- | --------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| DropdownMenu        | `src/lib/components/base/dropdown-menu/`                        | Persistent desktop cascades                  | `Root`, `Trigger`, `Content`, `Sub`, `SubTrigger`, `SubContent`; existing alignment/portal behavior   |
| Button              | `src/lib/components/base/button/`                               | Display, Actions, Add and icon-only triggers | `intent="primary"` / `"outline"` / `"ghost"`, `size="md"` / `"icon"`; icon child plus accessible name |
| Checkbox            | `src/lib/components/base/checkbox/`                             | Selection and compact filter rows            | `checked`, `indeterminate`, `disabled`, `onCheckedChange`; geometry via composition                   |
| WishlistBottomSheet | `src/lib/components/blocks/wishlist/WishlistBottomSheet.svelte` | Mobile bounded sheets                        | `portalDisabled`, `preventScroll`, `onCloseAutoFocus`                                                 |
| GiftViewSwitcher    | `src/lib/components/blocks/gift/GiftViewSwitcher.svelte`        | Existing layout control                      | Preserve production appearance; Grid/List remain available in reorder                                 |
| ActiveFilterPills   | `src/lib/components/derived/filter-menu/`                       | Existing active-state affordance             | Preserve existing filter callbacks and summaries                                                      |

### Adopt from shadcn-svelte / Bits UI

None. Existing DropdownMenu sub-primitives already provide cascading menus. Do not adopt a separate menu library or copy the prototype positioning code into production.

### Build Custom

| Existing composition to adapt                         | Description                                           | Why adaptation is needed                                       |
| ----------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| `blocks/wishlist/WishlistDetailToolbar.svelte`        | Unified Display with desktop cascades/mobile sections | Role/capability callbacks remain owned by the existing toolbar |
| `blocks/wishlist/WishlistSelectionToolbar.svelte`     | Categorized bulk actions and matching select-all      | Preserve selected/mixed/pending states and mobile hierarchy    |
| `blocks/wishlist/WishlistHeaderActions.svelte`        | Icon-only Settings beside distinct More               | Repositioned entry point, no duplicated settings menu item     |
| `blocks/wishlist/WishlistGiftDraggableWrapper.svelte` | Top-left visual/target separation                     | Increase actionable area without oversized visual chrome       |

## Implementation Notes

Use the existing portalled DropdownMenu primitives for collision handling, keyboard navigation and pointer transitions; the HTML cascade only demonstrates the requested interaction. The current `SubContent` defaults (`align="start"`, `alignOffset=-4`, `sideOffset=2`) provide the implementation starting point, not prototype absolute offsets. Do not modify the accepted sticky mask or infer approval of the simplified view switcher, artwork or app shell.

The raw HTML locally simulates selection and bulk state but does not call remote functions. Pointer dragging and persistence remain unimplemented; production must verify handle-only dragging, keyboard alternatives and scrolling outside the handle. Current source measurement for #362 is desktop 20px target and mobile 40px target, not a uniform baseline. Prototype hit boxes are separate from their visible outlined child.

No production positioning, mutation, reorder persistence or hover issue is closed by this refinement. The separate gift-geometry Variant C has now been approved; its authoritative handoff is `designs/gift-geometry-review/refined.html`. Design approval does not close implementation issues.
