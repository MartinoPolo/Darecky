# App Shell – Design Summary

> **Historical scoped reference:** This document preserves its original design scope. For current requirements, see `designs/README.md`, `.mpx/DECISIONS.md`, `src/app.css`, and the current components; older auth, role, visual, and geometry copy here is not authoritative.

**Base**: Variant 1 | **Refined**: 2026-05-30

## Refinements Applied

| Area                | Before (Variant 1)                             | After (Refined)                                                                                                                    |
| ------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Logo                | Emoji + plain text                             | Gift-box inline SVG (Lucide-style, 18x18) + "prejemesi" in heading font, bold, primary color + ".cz" at 42% opacity with visible gap |
| Nav items           | Plain links only                               | Links + CSS hover dropdowns showing 3 recent wishlists + "Zobrazit vse"                                                            |
| Nav dropdown footer | –                                              | No "Novy seznam", no "Archivovane" – clean footer link only                                                                        |
| Active indicator    | Background highlight                           | Bold text + primary color underline via ::after pseudo-element                                                                     |
| Page structure      | Separate sort-bar row below page header        | Page title + toolbar merged into single flex row                                                                                   |
| Sort control        | Plain text label in sort-bar                   | Explicit ghost button "Razeni: Posledni aktivita" in toolbar                                                                       |
| Dark mode toggle    | 3-segment button group (Light / System / Dark) | Single cycling ghost button, sun icon (light active), tooltip "Svetly rezim"                                                       |
| Notification bell   | Inline SVG, no badge                           | Ghost button with red notification badge "3"                                                                                       |
| Icons               | Mix of emoji and SVG                           | Lucide-style inline SVG exclusively                                                                                                |
| Mode coverage       | Light + dark sections                          | Light mode only (dark auto-generated from tokens at implementation time)                                                           |

## Component Map

### Codebase – Use As-Is

| Element                         | Component                            | Location                        |
| ------------------------------- | ------------------------------------ | ------------------------------- |
| "+ Vytvorit" button             | Button (variant default)             | src/lib/components/base/button/ |
| Bell button, dark toggle button | Button (variant ghost, size icon)    | src/lib/components/base/button/ |
| Wishlist status badge           | Badge (variant secondary or default) | src/lib/components/base/badge/  |

### Adopt from shadcn-svelte / Bits UI

| Element                | Component                                                    | Notes                                  |
| ---------------------- | ------------------------------------------------------------ | -------------------------------------- |
| User dropdown menu     | DropdownMenu (Bits UI)                                       | Items: Profil, Nastaveni, Odhlasit se  |
| Nav hover dropdowns    | CSS-only hover for pointer; Popover if keyboard nav required | CSS approach shown in mockup           |
| Sort control           | Select or DropdownMenu                                       | Select.Trigger already styled to match |
| Tooltip on dark toggle | Tooltip (Bits UI)                                            | Wraps ghost icon button                |

### Build Custom

| Element                | Description                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| TopBar block           | Sticky header with logo, nav, right-side actions. Lives in src/lib/components/blocks/app-shell/ |
| NavItem derived        | Link + hover dropdown wrapper. Extracts pattern used for all 3 nav entries                      |
| LogoMark derived       | Gift-box SVG + brand text + dimmed TLD. Single source of truth for logo                         |
| NotifBell derived      | Ghost icon button + absolute badge counter                                                      |
| DarkModeToggle derived | Single cycling ghost button (light, dark, system) backed by Persisted state                     |
| UserAvatar derived     | Circle with initials fallback; shows profile image when Google OAuth is used                    |
| PageTitleRow derived   | h1 + toolbar slot in one flex row. Used on every list page                                      |

## Implementation Notes

**Logo gap**: Use a span with margin-left on the .cz TLD element, not a non-breaking space.

**Nav dropdowns – keyboard accessibility**: CSS hover works for pointer users. For production, replace with DropdownMenu or Popover (Bits UI) for keyboard focus management and aria-expanded.

**Active nav item**: Derive from $page.url.pathname in SvelteKit. Apply is-active class conditionally; use the ::after underline pattern from the mockup.

**Dark mode toggle**: Back with Persisted from src/lib/reactivity/persisted.svelte. Cycle: sun ("Svetly rezim") → moon ("Tmavy rezim") → monitor ("Systemovy rezim").

**Notification badge**: position absolute top-right relative to the icon button wrapper. Use --status-danger token for the red color.

**Content max-width**: --content-max-width: 1200px from tokens.css. Apply max-width with margin-inline auto and padding-inline var(--space-6) on the page content wrapper.

**Font loading**: @font-face already defined in src/app.css. Do not add a second Google Fonts link in SvelteKit.

**No Dashboard page**: "Moje seznamy" is the home page. The three nav items are the entire primary navigation.
