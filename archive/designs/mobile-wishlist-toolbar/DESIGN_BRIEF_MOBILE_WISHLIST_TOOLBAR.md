# Mobile Wishlist Toolbar — Design Brief

A compact, sticky wishlist command bar for narrow screens. The current labeled toolbar can wrap to six rows and permanently consume most of a phone viewport. This design keeps every browsing and management action reachable while limiting the sticky surface to one row for visitors and no more than two rows for managers.

**Source**: issue #246 follow-up, user review on 2026-09-02
**Current-state reference**: `designs/mobile-wishlist-toolbar/current-mobile-toolbar.png`

---

## 1. Purpose

The toolbar is persistent browsing chrome, not page content. On a phone it must help users change how gifts are displayed without displacing the gifts themselves.

**Key value**: every wishlist action remains available in a sticky toolbar that never exceeds two compact rows.

---

## 2. Surrounding Context

The mockups MUST show the component in a realistic 390 × 844 mobile viewport at the scrolled position captured in the current-state screenshot.

### Full Viewport Structure

1. **Sticky app header, 56 px, final**: white card surface, dark ink bottom border, hamburger sticker button, compact Přejeme si logo, coral create button, notification badge, circular avatar.
2. **Wishlist header has already scrolled away**: do not add another title or hero above the toolbar.
3. **Sticky wishlist toolbar, design area**: centered inside the page content with approximately 16 px side gutters; white card surface, 2.5 px ink border, 16 px radius, hard sticker shadow.
4. **Gift stream, final context**: realistic single-column gift cards immediately behind/below the toolbar. Use the Aloe Vera shampoo card from the supplied screenshot and part of a second image-led card to demonstrate reclaimed vertical space.
5. **Pink/cream wishlist page tint**: preserve the existing themed surface. The toolbar still uses semantic card, ink, primary, accent, and muted tokens.

**What parent provides**: sticky navbar, wishlist theme scope, page gutter, gift stream.
**What this component fills**: the sticky command area between the scrolled-away wishlist header and the gifts.
**Must NOT include**: desktop navigation, sidebar navigation, wishlist hero redesign, gift-card redesign, or shortened Czech labels in overlay content.

### Mockup Rendering Instructions

- Each variant is a self-contained HTML file optimized for a 390 × 844 viewport, but centered in a comparison canvas on larger screens.
- Show the normal compact toolbar and an open interaction state. The mockup should be clickable: Sort, Grouping, and Filter triggers switch the open surface.
- Include a small variant eyebrow above the phone frame, outside sticky app chrome.
- Make the toolbar visibly one or two rows only. It may not obscure more than approximately 116 px including its padding and border.
- Reference `../../tokens.css`; mirror the current palette derivation as existing design mockups do.

---

## 3. Requirements

### 3.1 Responsive Scope

- The compact command bar applies below Tailwind `sm` (`640px`).
- At `sm` and wider, the existing labeled desktop toolbar remains unchanged.
- Mobile control triggers are icon-only but retain fully descriptive Czech accessible names.
- Touch targets are at least 40 × 40 px. The internal Lucide icon remains approximately 18 px.

### 3.2 Row Ownership

**Row 1, browsing controls**:

- View switcher: card and list icons in the current segmented control. If the compact/table view is available, include its third icon without changing the row limit.
- Sort trigger: `arrow-up-down` icon.
- Grouping trigger: `layers` icon.
- Filter trigger: `list-filter-plus` icon with numeric badge when filters are active.
- Reset: `rotate-ccw`, immediately after Filter, visible only when display controls differ from defaults.

**Row 2, manager controls**:

- Reorder: `hand` icon; changes to `check` while active.
- Flexible spacer.
- Settings: `settings` icon.
- Batch add: `list-plus` icon.
- Add gift: primary coral button with `plus` icon.

- The second row is absent when the viewer has no management controls and the first row fits.
- Management actions remain an atomic cluster and never wrap to a third row.
- Add gift stays visually primary even without its text label.

### 3.3 Mobile State Communication

- No labeled sort/grouping/filter triggers in sticky mobile chrome.
- No active-filter pills in sticky mobile chrome.
- Filter displays a numeric count badge when one or more filters are active.
- Sort and grouping selected values are checked and named inside the open surface.
- Trigger accessible names include current state, for example `Řazení: Výchozí pořadí`, `Seskupení: Bez seskupení`, `Filtrovat, 2 aktivní filtry`.
- Tooltip/title support may be present for pointer users but cannot be required to understand the control.

### 3.4 Variant A: Anchored Dropdowns

- Use the existing base `DropdownMenu` / `Select` visual language.
- Open panel anchors below the triggering icon and remains fully inside the 390 px viewport.
- The panel may be wider than the trigger; recommended width is approximately 280–320 px.
- Only one sibling panel may be open.
- Sort and grouping use single-selection rows with a checkmark.
- Filter uses checkbox rows grouped under clear headings. Include representative category and priority facets plus `Pouze dostupné` and `S odkazem`.
- Active filter state and `Zrušit filtry` remain available in the panel.
- The page remains visually active without a modal backdrop.

### 3.5 Variant B: Bottom Sheet

- Use the existing base `Sheet` with `side="bottom"` visual language.
- Add a dimmed backdrop and a top-rounded card with a drag handle, title, current-value summary where useful, and circled close button.
- Sheet content uses full-width labeled rows with generous touch spacing.
- Sort and grouping are single-selection lists; filters are checkbox lists. The same toolbar icon opens the relevant sheet content rather than a combined generic menu.
- The sheet should occupy only the height needed for the shown control, with a sensible maximum and internal scrolling for long filter facets.
- Preserve the toolbar visibly behind the backdrop so the trigger-to-surface relationship remains clear.

### 3.6 Interaction and Accessibility

- Icon triggers are real buttons with visible focus rings and `aria-expanded` / `aria-haspopup` where applicable.
- View buttons expose `aria-pressed`.
- Dropdown keyboard behavior follows Bits UI menu/select semantics; sheet uses dialog semantics and traps focus.
- Escape closes the open surface. Opening a sibling closes the current one.
- Checked state is communicated through icon and semantics, not color alone.
- Czech copy must use formal address and no em dash.
- Respect reduced motion; no layout-changing animation in the sticky toolbar.

---

## 4. States

| State | Visual Treatment | Trigger |
| --- | --- | --- |
| Visitor default | One compact row of browsing controls | non-manager view |
| Manager default | Two owned rows; actions cluster on row 2 | manager view |
| Sort open | Sort trigger pressed; full labels and selected check visible | tap Sort |
| Grouping open | Grouping trigger pressed; selected group checked | tap Grouping |
| Filter open | Filter trigger pressed; active count retained; checkbox facets visible | tap Filter |
| Filters active | Numeric badge on Filter; Reset visible beside it | one or more filters active |
| Non-default sort/grouping | Reset visible; selected state named in open surface | changed preference |
| Reorder active | Hand becomes primary Check; incompatible controls disabled | tap Reorder |
| Disabled | Reduced opacity, no hover lift | reorder or unavailable option |
| Keyboard focus | 2 px ring with offset around whole 40 px target | keyboard navigation |
| Overlay closed | Gift cards immediately follow toolbar | dismiss / Escape |

---

## 5. Component Reuse Map

### Existing Components (MUST use)

| Component | Variant/Props | Usage |
| --- | --- | --- |
| `Button` | `size="icon"`, `intent="outline"` | sort, grouping, filter, settings, batch, reorder |
| `Button` | `size="icon"`, primary intent | Add gift and active reorder completion |
| `Button` | `size="icon"`, ghost intent | conditional Reset |
| `GiftViewSwitcher` | existing icon segmented control | view mode |
| `DropdownMenu` / `Select` | existing content, group, checkbox/radio item primitives | Variant A |
| `Sheet` | `side="bottom"`, overlay, title, close | Variant B |
| `SimpleTooltip` | descriptive text | pointer enhancement only |
| Lucide icons | grid/list/table, arrow-up-down, layers, list-filter-plus, rotate-ccw, hand/check, settings, list-plus, plus | command identity |

### Components to Adopt

None. Base dropdown, select, sheet, button, and tooltip primitives already exist.

### Components to Design

| Component | Description | Why New |
| --- | --- | --- |
| Mobile toolbar responsive composition | Explicit browse and management rows inside `WishlistDetailToolbar` | existing mobile layout is an unbounded wrapping grid |
| Responsive display-control surface adapter | Presents the same sort/group/filter model through dropdowns or sheets by breakpoint | avoids duplicating state and menu definitions |

---

## 6. Layout Constraints

- Toolbar outer width: available page width with approximately 16 px gutters.
- Toolbar maximum: two rows, never three.
- Toolbar row height: 40 px minimum touch targets.
- Horizontal gaps: approximately 6–8 px; row gap approximately 8 px.
- Outer padding: approximately 8–10 px.
- Browse row does not horizontally scroll.
- Manager action cluster does not split.
- Conditional Reset must not create a third row; reserve its slot in the browsing-row capacity.
- Dropdown and sheet content may scroll internally; the sticky toolbar itself may not.

---

## 7. Design Tokens

Use `src/app.css` as canonical behavior and `designs/tokens.css` as the shared mockup foundation:

- Fonts: DynaPuff for brand/display, Geist for controls and content.
- Control sizes: mobile command targets at least 40 px despite desktop `--size-control-md` being 32 px.
- Geometry: `--radius-panel`, `--radius-btn`, `--border-w`.
- Surfaces: `--card`, `--popover`, `--background`, `--accent`, `--muted`.
- Color: `--ink`, `--primary`, `--primary-foreground`, `--muted-foreground`, `--ring`.
- Depth: `--shadow-sticker-sm`, `--shadow-sticker`, `--shadow-sticker-lift`.
- Overlay: use semantic darkened backdrop, not a new palette color.

---

## 8. Design Constraints (Non-Negotiable)

- Sticky mobile toolbar is never taller than two compact rows.
- Desktop labeled toolbar remains unchanged.
- Every current action and role gate remains available.
- Sort, grouping, and filter retain separate conceptual controls.
- Filter count remains visible on mobile; active pills do not.
- Minimum 40 px mobile targets.
- Menus/sheets contain full labels and explicit selected state.
- No sidebar, horizontally scrolling command bar, shortened translations, or text labels that can reintroduce wrapping.
- Recipient reservation privacy and all existing filtering semantics remain unchanged.
- Semantic theme tokens only; the design must work under wishlist palette scopes.

---

## 9. Design Freedom

- Exact distribution and visual divider between browsing and management rows.
- Whether the Add gift icon is square or slightly wider while still unlabeled.
- Badge position and shape on Filter.
- Dropdown alignment and width in Variant A.
- Sheet corner radius, handle treatment, section spacing, and current-value summary in Variant B.
- Which control is open by default when the HTML first loads, provided all three triggers are interactive.

---

## 10. Visual References

- `designs/mobile-wishlist-toolbar/current-mobile-toolbar.png` — failure state and exact surrounding phone context.
- `src/lib/components/blocks/wishlist/WishlistDetailToolbar.svelte` — current action gates and ordering.
- `designs/unified-filters/refined.html` — established filter menu and active-state language.
- `designs/unified-filters/DESIGN_BRIEF_UNIFIED_FILTERS.md` — filter semantics and role gates.
- `designs/control-heights/DESIGN_BRIEF_CONTROL_HEIGHTS.md` — control scale and toolbar context.
- `src/lib/components/base/dropdown-menu/` — Variant A primitive.
- `src/lib/components/base/sheet/` — Variant B primitive.
- `src/lib/components/base/button/button_variants.ts` — sticker button states.

---

## 11. Not Included

- Desktop toolbar redesign.
- Changes to sorting, grouping, filtering, reset, reorder, settings, batch-add, or add-gift behavior.
- Gift card, wishlist header, navbar, theme, or navigation redesign.
- Persisting filters or changing sort/group preference storage.
- Implementation in Svelte; these artifacts support choosing the mobile overlay pattern first.
