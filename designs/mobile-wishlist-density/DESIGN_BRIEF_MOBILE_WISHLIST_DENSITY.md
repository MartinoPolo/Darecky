# Mobile Wishlist Density — Design Brief

> **Status**: Refined (Variant B with Variant C list cards and narrow single-column card mode)
> **Refined mockup**: `designs/mobile-wishlist-density/refined.html`
> **Summary**: `designs/mobile-wishlist-density/SUMMARY.md`
> **Refinements**: 12px single gutter, edge-to-edge imagery, equal-height cards, vertical single-column card mode at 320px, compact list cards, image-overlay drag handles, ownership-based reservation states, contextual mode toolbars, centered combined badges, and stable bottom sheets

Redesign the narrow-screen wishlist collection so more gifts and useful information are visible without abandoning Přejeme si’s tactile sticker-card language. The refined direction combines Variant B’s adaptive commerce cards, Variant C’s standalone list cards, and a narrow single-column version of the same vertical card anatomy at 320px.

**Source**: User design session, 2026-09-02; related toolbar issue #320, contained view-switcher issue #327, and gift-state overlay issue #328

---

## 1. Purpose

Help a mobile visitor scan and compare more gifts per viewport while keeping names, price or availability, reservation state, and the primary action understandable and touchable. Give the user a realistic visual basis for choosing between a dense visual grid and an improved list.

**Key value**: Show more gift choices without making each choice feel cramped, anonymous, or difficult to act on.

---

## 2. Surrounding Context

The mockups **MUST** show the full wishlist viewport at realistic proportions, not isolated cards.

### Full Viewport Structure

Use a `390 × 844px` phone as the default preview and provide prototype-only controls outside the phone for switching viewport width (`320`, `360`, `390px`), role (`Návštěvník`, `Obdarovaný`, `Správce`), lifecycle (`Aktivní`, `Archivovaný`), interaction mode (`Běžný`, `Výběr`, `Řazení`), and collection view (`Karty`, `Seznam`). Keep the gutter fixed at the approved `12px`. These controls are design-inspection tools, not proposed production UI.

Inside the phone, top to bottom:

1. Existing 56px app navigation with menu, gift shortcut, Přejeme si logo, add action, notifications, and avatar.
2. A refined compact wishlist hero that keeps the wishlist photo but removes the large ruled-notepad treatment. The hero must show recipient, title, lifecycle/count metadata, and a single role-aware overflow/settings action instead of wrapping labeled action buttons.
3. The current wishlist command structure from `.mpx/DECISIONS.md` and `designs/wishlist-command-review/`: one **Display** control in the command row, **Settings** in the hero, and **Add** as the primary action. The separate layout switcher controls cards/list; Display contains sorting, grouping, and filtering. Toolbar redesign remains outside this brief; only gift density is under review.
4. The gift collection under design. Show enough realistic gifts to demonstrate all state and action combinations while scrolling.

The role switcher must update hero actions, gift visibility, card actions, and privacy-sensitive reservation information. The collection must include available, partially reserved, fully reserved, reserved by the current visitor, reserved by someone else, purchased-by-current-visitor, received, liked, no-price, no-image, and long-title examples. Use realistic Czech product names, prices, and labels.

**What parent provides**: App shell, wishlist heading, compact sticky toolbar, view state, sort/group/filter state, and collection width.

**What this design fills**: The mobile gift collection below the toolbar and its one-time page gutter.

**Must NOT include**: Desktop redesign, bottom-sheet redesign, gift-detail modal redesign, or a second nested collection gutter.

**Mockup rendering instructions**:

- Render the phone at actual CSS pixel proportions, default `390 × 844px`.
- Keep all app chrome faithful and subordinate; cards or list items are the focus.
- Keep the compact toolbar sticky-looking and show content continuing beneath it.
- Include prototype-only width, role, lifecycle, view, and interaction-mode controls outside the phone.
- All cards must contain distinct realistic data and images or styled product placeholders.

---

## 3. Requirements

### 3.1 Mobile page width and spacing

- Use an approved `12px` gutter per side, applied once at page level; the gift collection adds no nested horizontal inset.
- Use a compact `8px` inter-card gap in the two-column card view and `10px` vertical separation in list view.
- Give vertical cards no wrapper padding: the image is edge-to-edge inside the card border, while the information and action regions use only `6–8px` internal padding.
- Give horizontal cards no outer interior frame: image and body touch the card’s internal edges, with `8px` content padding only where text needs breathing room.
- Preserve enough interior inset for focus rings and hard shadows without returning to the current spacious desktop card anatomy.
- Preserve existing desktop and tablet spacing; this direction applies below `sm` only.

### 3.2 Compact wishlist hero

- Replace the large ruled-notebook hero with a compact standalone card approximately `104–120px` tall.
- Keep the wishlist photo as a prominent `84–96px` square or slightly portrait image on the left, using the existing image crop and fallback behavior. Inset it equally from the hero’s top, bottom, and left edges; do not mix full-bleed edges with padding on only one side.
- Show recipient name, wishlist title, lifecycle status, and gift count in a tight information column. Clamp long titles instead of increasing hero height.
- Remove decorative notebook holes, red margin rule, ruled-paper background, taped-polaroid stack, and large vertical gaps.
- Collapse Share, Managers, Archive, and metadata-edit actions into one 40px overflow/settings trigger for recipient and moderator roles. Its role-aware menu or bottom sheet must expose full labels and dangerous-action separation.
- Do not render management actions for visitors. Keep privacy/lifecycle notices outside the hero when they are required.

### 3.3 Shared compact gift anatomy

Directly show:

1. The largest image practical for the selected view, rendered full-bleed across its entire image region rather than as a smaller product tile on a decorative colored mat.
2. Gift name, clamped to two lines.
3. Price, or “Cena neuvedena”.
4. One consolidated state label.
5. Like state when the role allows liking.
6. One context-primary action plus a More actions trigger only when additional actions exist.

Move description, category, priority, domains, links, and secondary metadata into gift detail or the contextual action surface. Preserve quantity only when it changes reservation meaning.

Tapping non-action card space opens gift detail; Like, the primary action, and More actions remain independent 40px targets and stop navigation.

### 3.4 Refined responsive card view

- Use Variant B’s vertical commerce cards at every width above `320px`, in exactly two equal columns through the mobile breakpoint.
- At `320px` and below, use one vertical card per row with the image as the full-width top section and information/actions below it. It must remain visually and structurally distinct from the horizontal list view; switching between Card and List must never be a no-op.
- Preserve one semantic information and tab order across one- and two-column card layouts.
- Make the actual product image edge-to-edge and dominant: near-square or `4:3` in two-column cards and a compact full-width landscape region in the narrow one-column card. Do not place the image inside another colored image mat or framed paper tile.
- Every card in the rendered Card view must have the same height, independent of title length, price, reservation state, role, or presence of actions. Let content regions absorb unused space without rendering empty placeholder controls or state-dependent gaps.
- Use a concise action footer: one primary action fills available width and a separate 40px More actions button appears only for multi-action states.

### 3.5 Refined standalone list view

- Use Variant C’s discrete warm card surfaces, ink border, modest radius, and restrained hard shadow instead of transparent divider rows.
- Use an edge-to-edge square product image approximately `112–128px`. The product image fills the entire left image region with `object-fit: cover`; no colored mat surrounds it.
- Keep list view one column at `320–390px`, with name, price/state, and actions beside the image. Every list item in the rendered view has the same fixed height; long or optional content clamps rather than stretching an item.
- Overlay the 40px Like button on the image only when the role allows liking and the selected/drag state does not need that corner.
- Fit the primary action and optional More actions trigger without creating a tall empty information column.
- Avoid a table-row appearance; each item must read as one complete tactile card.

### 3.6 Role-specific actions and privacy

| Role | Visible state | Direct card action | Additional actions |
| --- | --- | --- | --- |
| Visitor | Remaining capacity and ownership states without reserver names; Like available | Reserve, Cancel own reservation, or no button when reserved by someone else | Authenticated owners of a reservation can mark it Purchased/Not purchased through More actions |
| Recipient / author | Never reservation count, state, identity, Like, Reserve, or Purchased | Mark received / Mark not received on active lists | Edit, priority, category, links, and selection actions through detail/context surfaces |
| Moderator / správce | Full reservation state and reserver names; Like available | Mark received / Mark not received remains directly available | Reserve/Cancel own reservation, Purchased tracking, edit, and permitted reservation release through More actions/detail |

- The role switcher must update the entire phone preview rather than only labels.
- A recipient must not infer hidden reservation state from spacing, badge gaps, disabled controls, or differing card heights.
- Archived mode removes mutation actions except cancellation of the current visitor’s own reservation.
- The refined card face shows at most one direct context-primary action. Multi-action combinations use a 40px More actions trigger opening a labeled action sheet.

### 3.7 Badge and overlay collision policy

- Reserve one image corner for the 40px Like button in visitor/moderator normal mode.
- Center one consolidated state badge over the image whenever the gift is reserved or received. Reservation and receipt must be identifiable at first glance, not tucked into a corner.
- State precedence is Received → Own reservation → Reserved by someone else → Partially available quantity. If received and reserved coexist, render one combined centered badge with Received as the dominant first label and the ownership/availability state as supporting text.
- Fully unavailable quantity must not change user-facing terminology or color based on whether the gift quantity is one or several. For a visitor, use `Rezervováno vámi` with white text on a lighter, clearly green saturated surface when the current visitor owns the reservation, and a distinctly darker navy treatment with `Rezervováno někým jiným` when another person owns it. The ownership colors must remain unmistakable without relying on text alone.
- Only a partially available multi-quantity gift exposes counts, phrased by remaining capacity such as `Volné 2/3`; it remains reservable. Do not use `Plně rezervováno` as a separate visitor-facing state.
- Never stack category, priority, reservation, received, and quantity pills over the image. Lower-priority facts move to the body or action sheet.
- Moderator reserver identity is a concise body line such as “Rezervovala Jana”, not another image sticker.
- Recipient mode renders no reservation placeholder at all.
- Selection mode replaces Like with the selection checkbox in the same reserved corner. Reorder mode replaces normal card actions with reorder affordances; normal action buttons become inert. Keep up/down controls and add a visible 40px drag handle over the image. Dragging starts only from this handle so vertical swipes elsewhere on the card continue scrolling the page.
- Received and reservation facts may coexist in data, but only the highest-priority badge occupies the image. Remaining allowed facts appear as text in the body.

### 3.8 State coverage in the refined prototype

The collection must include distinct examples for:

- Available and unliked.
- Available and liked.
- Partially available quantity (`Volné 2/3`) and still reservable.
- Reserved by another visitor, with the same label regardless of whether total quantity is one or several.
- Reserved by the current visitor, with Cancel and Purchased actions.
- Purchased by the current visitor.
- Reserved with visible reserver identity in moderator mode.
- Received, including the Mark not received reversal.
- Received plus an underlying reservation to validate badge precedence.
- No price.
- No image.
- Long two-line title.
- Selected in multi-select mode.
- Reorder mode.

### 3.9 Interaction and prototype controls

- The toolbar card/list switch must change the actual rendered collection.
- Role controls must switch between Visitor, Recipient, and Moderator state without reloading.
- Lifecycle controls must demonstrate active and archived behavior, including removal of mutations except cancellation of the current visitor’s own reservation.
- Mode controls must demonstrate normal, selection, and reorder presentations.
- Entering selection mode must replace the normal toolbar with a contextual selection toolbar containing selection count, cancel/close, and a labeled `Akce` trigger for batch actions. Gift cards show only the image-overlay checkbox; they must not render a second checkmark/action button in the card footer.
- Reorder mode must replace incompatible toolbar controls with an explicit Done action while retaining the approved up/down card controls and enabling pointer/touch drag from the image-overlay handle only.
- Toolbar entry actions must use the same Lucide semantics as the existing application: `ListChecks` for multi-selection, `Hand` for entering reorder, and `Check` for completing reorder.
- More actions must open a role- and gift-specific bottom sheet or menu with all available actions, including multi-action combinations.
- The hero overflow trigger must expose Share, Managers, Archive, and edit actions only for manager roles.
- Gifts reserved by someone else remain readable, use the neutral/dark ownership label, and do not offer a disabled Reserve button.
- Cards without a price show a quiet fallback; long titles never collide with actions.
- Bottom-sheet opening and closing must not change phone width, page scroll position, toolbar geometry, or outer prototype position. Lock only the inner viewport, preserve its scroll offset, and restore focus without scrolling.
- Like feedback must run only after direct Like activation. Re-rendering caused by Reserve, role, view, or state changes must not replay Like animation.
- Toolbar rows use equal internal top and bottom padding; no second-row control may touch or clip against the toolbar border.
- Focus-visible treatment stays inside the `12px` page gutter and all interactive targets remain at least 40px.

---

## 4. States

| State | Visual Treatment | Trigger |
| --- | --- | --- |
| Available | Full-color image, normal text, role-primary action | Gift has capacity and wishlist is active |
| Partially available | Compact remaining-capacity state such as `Volné 2/3`; remains reservable | Reserved count is below quantity |
| Reserved by someone else | Neutral/dark `Rezervováno někým jiným`; Reserve omitted regardless of total quantity | No capacity remains and the current visitor is not the reserver |
| Own reservation | Green `Rezervováno vámi`; Cancel is direct and Purchased appears in More actions | Current user owns a reservation |
| Purchased privately | Private purchased confirmation visible only to current reserver | Current reserver toggled purchased tracking |
| Moderator identity | Concise reserver-name line in body | Moderator views a reserved gift |
| Recipient privacy | No reservation, Like, or Purchased trace and no reserved layout gap | Recipient views their own list |
| Received | Highest-precedence received badge and direct reversal for managers | Manager marked gift received |
| Liked | Filled coral heart with accessible pressed state | Visitor/moderator liked gift |
| No price | “Cena neuvedena” in muted compact text | Gift price is absent |
| No image | Full-size designed fallback frame | Image is absent or unusable |
| Long name | Two-line clamp with intact card rhythm | Name exceeds available line length |
| Selection | Checkbox replaces Like; card tint/ring remains compatible with state badge | Selection mode is active |
| Reorder | Normal card actions are inert; 40px image-overlay drag handle plus up/down controls are visible | Reorder mode is active |
| Archived | No new mutations; own reservation cancellation remains available | Wishlist is archived |
| Focus visible | Strong contained ring | Keyboard focus |
| Pressed | Brief tactile scale or shadow change | Pointer or touch activation |
| Narrow card mode | One equal-height vertical card per row with image above content | Card view at 320px and below |
| Wider mobile grid | Two equal-height vertical cards per row | Card view above 320px and below `sm` |
| Mobile list | One equal-height large-image horizontal card per row | List view at any mobile width |

---

## 5. Component Reuse Map

### Existing Components — MUST use or faithfully represent

| Component | Path / Variant | Usage |
| --- | --- | --- |
| `WishlistDetailToolbar` | `src/lib/components/blocks/wishlist/WishlistDetailToolbar.svelte` plus selected mobile-toolbar design | Sticky view and display controls above collection |
| `WishlistGiftCardGrid` | `src/lib/components/blocks/wishlist/WishlistGiftCardGrid.svelte` | Grid collection, grouping, selection, and reorder boundaries |
| `GiftCard` | `src/lib/components/blocks/gift/GiftCard.svelte` | Existing card behavior and role logic to adapt responsively |
| `WishlistGiftListView` | `src/lib/components/blocks/wishlist/WishlistGiftListView.svelte` | List collection, grouping, selection, and reorder boundaries |
| `GiftListItem` | `src/lib/components/blocks/gift/GiftListItem.svelte` | Existing list behavior and role logic to restyle |
| `GiftImage` | `src/lib/components/blocks/gift/GiftImage.svelte` | Responsive image frame and fallback behavior |
| `LikeButton` | `src/lib/components/blocks/gift/LikeButton.svelte`, `size="md"` | 40px like target |
| `ReserveButton` | `src/lib/components/blocks/reservation/ReserveButton.svelte`, `size="md"` | Reserve or cancel own reservation |
| `PurchasedToggle` | `src/lib/components/blocks/reservation/PurchasedToggle.svelte` | Private current-reserver action inside More actions |
| `GiftReceivedToggle` | `src/lib/components/blocks/gift/GiftReceivedToggle.svelte` | Direct manager action in browse views |
| `GiftContextActions` | `src/lib/components/blocks/wishlist/GiftContextActions.svelte` | Existing role-aware mobile action-sheet pattern |
| `Sheet` | `src/lib/components/base/sheet`, `side="bottom"` | Card More actions and compact hero management actions |
| `Badge` | `src/lib/components/base/badge` subtle semantic tones | One consolidated reservation, received, or quantity state |
| `Button` | `src/lib/components/base/button`, icon or compact primary variants | Toolbar, card, and overflow actions |

### Components to Adopt

None. Existing base and block primitives cover the required interactions.

### Components to Design

| Component | Description | Why New |
| --- | --- | --- |
| Responsive compact gift anatomy | A mobile-only presentation shared by grid and list gift displays | Current desktop-oriented card and list anatomy cannot meet the density and collision requirements through spacing changes alone |
| Consolidated gift state resolver | Maps allowed role-visible facts to one image badge plus optional body text | Prevents ad hoc precedence and privacy leaks when reservation, received, quantity, selection, and Like states coexist |
| Compact mobile wishlist hero | Responsive presentation of the existing wishlist photo, identity, lifecycle metadata, and manager actions | Current notebook composition and labeled action row consume too much narrow-screen height |

Do not create a second gift domain model or duplicate role logic. Responsive presentation must consume the existing gift data and actions.

---

## 6. Layout Constraints

- Default design viewport: `390 × 844px`.
- Responsive inspection widths: `320`, `360`, and `390px`.
- Grid columns: one vertical card at `320px` and below; exactly two vertical cards above `320px` through the mobile breakpoint.
- Mobile page gutter: fixed `12px`, applied once.
- Two-column gap: `8px`.
- List-card vertical gap: `10px`.
- Card-view item height: fixed and identical for every item within the active responsive mode.
- Vertical card image: edge-to-edge, near-square or `4:3`; narrow single-column cards use a compact full-width landscape image above content.
- List-view item height: fixed and identical, with a `112–128px` edge-to-edge left image.
- Card body/action padding: `6–8px`; no additional card wrapper padding.
- Compact hero: approximately `104–120px` tall with an `84–96px` photo.
- Minimum interactive target: `40 × 40px`.
- Compact card title: 13–15px, heading family, semibold, two-line maximum.
- Price or state: 12–15px, strong enough to scan but secondary to title.
- Desktop and tablet card grid remain out of scope.

---

## 7. Design Tokens

Reference `designs/tokens.css` via `<link rel="stylesheet" href="../../tokens.css">`.

- Body: `--font-sans` (Figtree).
- Headings and product names: `--font-heading` (Noto Sans).
- Compact text: `--text-xs`, `--text-sm`, and `--text-base`; do not invent unreadably small type.
- Spacing: `--space-2` for grid gap, `--space-3` recommended page gutter and compact list padding.
- Controls: `--size-control-md` minimum on touch surfaces.
- Card radius: `--radius-lg` or `--radius-xl`.
- Use current app theme variables and the anime-sky/sticker direction visible in `designs/redesign-2026/refined.html` and the selected mobile-toolbar mockup.
- Use domain semantic reserved and liked colors from tokens; do not communicate state through color alone.

---

## 8. Design Constraints — Non-Negotiable

- Preserve card/list view selection and global per-device persistence.
- Preserve gift detail navigation, reservation, like, reorder, selection, grouping, and role-gated behavior.
- Never show reservation state to the wishlist recipient.
- Never use touch targets smaller than 40px even when visual glyphs are smaller.
- At `320px` and below, Card view is one column of vertical image-above-content cards; above `320px`, it is two columns through the mobile breakpoint.
- No horizontal scrolling for cards or list items.
- No nested collection gutter; mobile page padding is exactly `12px`.
- Do not solve density only by shrinking all type and controls.
- Do not edit or replace shadcn-managed base primitives for this design.
- Desktop presentation remains unchanged.

---

## 9. Design Freedom

- Exact image ratio between square and `4:3`.
- Whether the compact primary action is fully labeled or pairs a short label with a semantic icon.
- Exact visual treatment of the consolidated state badge within the fixed collision policy.
- Degree of sticker rotation and shadow restraint at small sizes.
- Exact horizontal image width within the `112–128px` target.
- Compact hero image crop and background treatment without notebook decoration.
- Motion details that respect reduced motion.

---

## 10. Visual References

- **Current command structure (scoped reference)**: `.mpx/DECISIONS.md` and `designs/wishlist-command-review/`; use one Display control, hero Settings, and primary Add. The archived toolbar mockup is historical provenance only and is not a current requirement.
- **Current collection screenshot**: `designs/mobile-wishlist-density/current-mobile-wishlist.png`.
- **Current oversized hero screenshot**: `designs/mobile-wishlist-density/current-mobile-wishlist-hero.png`.
- **Current wishlist card implementation**: `src/lib/components/blocks/gift/GiftCard.svelte`.
- **Current transparent list implementation**: `src/lib/components/blocks/gift/GiftListItem.svelte`.
- **Established app direction**: `designs/redesign-2026/refined.html`.
- **Prior wishlist-page exploration**: `designs/wishlist-page/refined.html` and its design brief.

---

## 11. Not Included

- Implementing the selected design in Svelte.
- Changing desktop or tablet wishlist density.
- Redesigning gift detail, reservation dialogs, filter sheets, or app navigation.
- Changing gift data, sorting, grouping, filters, permissions, or persistence.
- Introducing masonry ordering or horizontal carousels.
- Changing the user’s persisted card/list choice; the refined prototype only demonstrates both responsive presentations.
