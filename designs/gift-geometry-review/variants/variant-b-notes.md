# Variant B completion notes

Variant B is the shared comparison baseline. It uses the same renderer, fixtures, controls, chrome, Card view, and desktop List geometry as A. Its sole layout difference is below 640px: List actions remain in the content column beside the 1:1 thumbnail.

## Covered

- Role-aware received/reservation actions, privacy, likes, local pending/error behavior, archive restrictions, complete links and content.
- Equal-height neighboring actions, adjacent More control, a dedicated heart lane, centered readable stickers, and 60×60 reorder grip with arrows.
- Responsive content remains visible at 320/390px and can grow under text enlargement.

## Honest limitations

- All changes are local demo state; toasts are prefixed “Demo” and no persistence/network call occurs.
- Pointer drag is not implemented. Arrow reorder is the interactive alternative.
- Desktop before/after measurements and production behavior remain pending implementation verification.
- Seed photos use exact local `file:///C:/_MP_projects/prejemesi/.seed-uploads/seed/` paths and require browser file access.
