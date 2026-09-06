# Variant A completion notes

Variant A now uses the shared B-baseline renderer, fixtures, controls, chrome, Card view, and desktop List geometry. Its sole layout difference is below 640px: List actions span a full-width card footer beneath image and content.

## Covered

- Role-aware received/reservation actions, privacy, likes, local pending/error behavior, archive restrictions, complete links and content.
- Equal-height neighboring actions, adjacent More control, a dedicated heart lane, centered readable stickers, 1:1 List imagery, and 60×60 reorder grip with arrows.
- Responsive content remains visible at 320/390px and can grow under text enlargement.

## Honest limitations

- All changes are local demo state; toasts are prefixed “Demo” and no persistence/network call occurs.
- Pointer drag is not implemented. Arrow reorder is the interactive alternative.
- Desktop before/after measurements and production behavior remain pending implementation verification.
- Seed photos use exact local `file:///C:/_MP_projects/prejemesi/.seed-uploads/seed/` paths and require browser file access.
