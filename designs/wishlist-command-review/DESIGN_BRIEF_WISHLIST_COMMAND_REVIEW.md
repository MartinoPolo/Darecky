# Wishlist Command Review — Design Brief

> **Status**: Approved (refined Variant A). Design phase complete for the scoped command controls; duplicate labels corrected.
> **Refined mockup**: `designs/wishlist-command-review/refined.html`
> **Summary**: `designs/wishlist-command-review/SUMMARY.md`
> **Refinements**: Persistent cascading desktop menus, icon-only More/Settings, matching selection checkboxes, top-left compact grips with larger actionable targets; preserve accepted mobile flow.

**Sources:** #359, #353, #355, #358; contextual #361/#363. Latest #359 comment explicitly preserves the accepted toolbar mask from PR #366. This is a supplemental preview of settled requirements, not a new product-decision gate.

## 1. Purpose

Make browsing and bulk commands compact, predictable and discoverable. Key value: one entry point per workflow, without losing options or selected-state context.

## 2. Surrounding Context

Full wishlist page, 1440×900 desktop and responsive 390×844 phone (320px supported). Current Anime Sky app header, notebook hero and representative gifts remain visible as quiet context. Hero has authorized Settings top-right beside a distinct More menu. Toolbar follows the hero, with view switcher immediately followed by Display. Preserve current sticky mask/background/blur/fade/layering; do not explore them. Review-only controls above app chrome allow role, browse/selection/reorder, light/dark and error/pending fixtures. No duplicate application header within a sheet.

## 3. Requirements

- Desktop: view → labeled Display („Zobrazení“ with sliders icon and chevron). Display uses a persistent parent menu with sorting, grouping and filtering rows, selected summaries and active-filter visibility. Hover/click/ArrowRight opens a separate submenu beside the relevant row, like Windows context menus. Switching categories replaces only the child, never the root. Desktop must not use mobile-style in-place drilldown or a Back row. Bulk Actions follows the same cascading pattern. Root aligns to its actual trigger; child aligns to its parent row, flips sides and clamps within the viewport without being clipped by root scrolling. Remove separate sort/group/filter toolbar controls. No obsolete separator before full reorder label. Add gift remains primary and right aligned. Keep toolbar More and all eligible actions.
- Mobile: one row with view then Display, role-gated More and primary Add gift. Settings is in hero only. Display opens one stable bounded bottom sheet, pinned Sort/Grouping/Filter section navigation; section changes in place, not cascading popovers.
- All More triggers are ellipsis icons only at every width. Hero Settings is a gear icon only. Preserve accessible names and tooltips without visible text. Hero More retains sharing and manager workflows but no duplicate Settings; its mobile sheet must remain distinct from toolbar More. Toolbar More retains reset, preview, unfollow, selection, reorder, batch add as capability eligible.
- Sorting preserves actual source options and per-wishlist/device persistence. Grouping: none/priority/category, with unavailable choices disabled. Without a saved preference, priority is the initial fallback if available; saved none/category is respected. Filters are per visit, checkbox facets OR within and AND across; recipient never gets reservation/Like filters.
- Selection toolbar: explicit count; Select all, one Actions trigger, Cancel. Select-all uses the same rounded ink-bordered checkbox appearance as gift selection, including checked, unchecked and mixed states, while retaining native checkbox semantics. Gift checkbox placement, selection perimeter corners and hero button positions are accepted; the layout switcher and unrelated styling are not part of that approval. Desktop Actions has nested categories. Mobile Actions is one sheet: overview → selected category's options → Back; preserve selection. Categories: priority, category, image fit, image background, copy to wishlist, received state. Include mixed/current/disabled/pending/failed states. Copy leads to an explicit destination choice, never silently moves gifts.
- Sheet header: left group „Akce“ and selected count, shown once; close at right with equal top/bottom clearance and no separator collision. Do not repeat selected count in a subtitle. Each category renders its current/mixed-value summary exactly once; pending progress remains a separate status, not a second count summary. Content can scroll when genuinely too tall; no needless gaps or clipped final rows. Compact checkbox rows retain accessible touch/focus targets, at least 40px mobile. Sheet bounds respect safe areas.
- Reorder preview retains Grid/List switcher and Done; switches visibly change layout without exiting or saving. The grip remains at the **top-left** on both layouts and all widths. Use a compact outlined visual inside a larger invisible actionable area, as selected by the user, with no visible text. Prototype targets: desktop 32px around a 24px visual; mobile 60px around a 40px visual. These exceed the measured baseline targets (desktop 20px, mobile 40px) by at least 50% per dimension. Keep the target inside the image, clear of selection/status controls; touch scrolling remains possible outside it in implementation. Facing radius derives from card radius minus the complete physical visual inset (card border, target inset and internal centering). Static demo must explicitly state it does not prove production reorder persistence.
- Menus close on outside interaction and return focus to their trigger. Desktop ArrowLeft/Escape closes the child first and restores its parent row; the next Escape closes the root and restores the toolbar/hero trigger. Mobile sublevel Back returns to overview. Use ordinary keyboard-focusable HTML prototypes rather than falsely claiming full Bits UI parity.

## 4. States

| State                | Treatment                                               | Trigger             |
| -------------------- | ------------------------------------------------------- | ------------------- |
| Browse/default       | Single Display beside switcher                          | Initial             |
| Filter active        | Trigger count, checked rows, desktop removable pills    | Checkbox            |
| Display open         | Categorized desktop surface / mobile sections           | Display             |
| Selection            | Count, Select all, Actions, Cancel                      | More/select fixture |
| Bulk overview/nested | Short category list / in-place options + Back on mobile | Actions/category    |
| Mixed/current        | „Různé hodnoty“ or current summary                      | Selected fixtures   |
| Pending              | Disable repeat actions, announce progress               | Demo mutation       |
| Failure              | Safe error and preserved selection                      | Error fixture       |
| Empty/unavailable    | Clear explanatory state, disabled unavailable grouping  | Fixture             |
| Reorder              | Enabled layout switcher, label, Done                    | More/reorder        |
| Focus/hover          | Visible stable focus, no pointer-region shifting        | Input               |

## 5. Component Reuse Map

`blocks/wishlist/WishlistDetailToolbar.svelte` owns role/capability gates and callbacks; `WishlistSelectionToolbar.svelte` owns selectedCount, hiddenCount, visibleState, pending, mixed summaries and six actions. `WishlistBottomSheet.svelte` derives shared mobile sheet without editing managed base Sheet. Reuse base Button `intent=primary|outline|ghost`, `size=md|icon`; base DropdownMenu with submenus for desktop, Checkbox, Sheet, and derived `filter-menu` ActiveFilterPills/FilterMenu. `blocks/gift/GiftViewSwitcher.svelte` is the existing layout switcher. No new dependency or primitive required; design only composes these controls.

## 6. Layout Constraints

Breakpoint `sm`=640px. Desktop toolbar controls 32px nominal; mobile usable targets 40px. Mobile page gutter 12px. Bounded sheet with top/side inset and safe-area bottom. Header accommodates count 3 and 120 without overlapping close. Desktop categorized menu approx 300–360px, constrained to viewport. Test 320/390/768/1440 widths. Toolbar must not horizontally scroll or grow into multiple phone rows.

## 7. Design Tokens

Canonical `src/app.css`, DynaPuff Variable + Geist Variable, ink border, hard sticker shadows, current semantic colors and four-step control scale. In `refined.html`, link `../tokens.css` then `../open-issue-review/assets/app.css` (orchestrator supplies canonical compiled CSS). Reuse utility/design-system classes, with component-specific layout CSS only. Light is the visual source of truth; dark uses canonical tokens.

## 8. Non-Negotiable Constraints

No production code/data calls. Preserve accepted mask and all capability/privacy gates, options and persistence semantics. No cascading mobile popovers. No Settings duplicate. Correct Czech diacritics and formal copy; clear accessible names and focus restoration. Mark all changes as local demo state.

## 9. Design Freedom

Dim global app chrome, hero artwork/text and gift illustration/body as context; keep reviewed hero actions, toolbar and gift selection/grip controls at full opacity. The simplified layout switcher, surrounding app styling and actual positioning engine are not new design approvals.

Compact row spacing, icon alignment, menu summaries and active-state presentation inside the approved hierarchy. Do not invent new grouping, filtering, bulk, or persistence behavior.

## 10. Visual References

`designs/mobile-wishlist-toolbar/`, `designs/wishlist-gift-actions/refined.html`, current toolbar and selection source, current `WishlistHeaderActions.svelte`. Older separate-control decisions are explicitly superseded by #359; latest mask acceptance is not.

## 11. Not Included

#352 mutation repairs, #347 reorder initialization repair, #346 hover oscillation, #364 positioning-engine repair. Prototype placement is illustrative and does not close these issues. No additional mandatory design/HITL labels are needed for these settled requirements.
