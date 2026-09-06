import { tv } from 'tailwind-variants';

export const giftDetailModalVariants = tv({
	slots: {
		// Flex column so the body inherits a definite height when the dialog is
		// capped at 90dvh – that lets the detail column pin its footer and scroll
		// only the fields (#116 follow-up, GiftDraftDialog precedent). Widened to
		// ~1100px (issue #183 REQ-9/REQ-10): both the edit form and the visitor
		// detail view (view mode reuses this same slot) needed more room – the
		// 4:3 crop preview and the full uncropped detail photo both read as
		// cramped in the previous 900px column.
		content:
			'flex flex-col sm:max-w-[1100px] max-h-[90dvh] overflow-hidden p-0 gap-0 max-w-[calc(100%-1rem)]',
		// Mobile: a single scrolling flex column so the image and fields share one
		// scroll region inside the 90dvh-capped dialog (issue: mobile edit dialog UX).
		// Desktop: restores the exact 2-col grid + its own overflow-hidden. ~50/50
		// split (issue #183 REQ-9, revises the earlier 45/55 split). No min-height:
		// the grid takes its height from the columns' content (form column /
		// adaptive stage), capped at 90dvh by `content` above (#189 REQ-5).
		body: 'flex min-h-0 flex-1 flex-col overflow-y-auto sm:grid sm:grid-cols-[50%_50%] sm:grid-rows-[minmax(0,1fr)] sm:flex-initial sm:overflow-hidden',
		// Dotted notebook mat behind the photo (issue #102 round-2 delta): letterboxed
		// images keep the mat visible; a dashed ink seam separates image and form columns.
		// The mobile height fits the display-mode toggle + preview + tile row (#116 round 3).
		// shrink-0: `body` is a bounded-height flex column on mobile – without this, the
		// default flex-shrink:1 compresses this column below its intended height and,
		// combined with overflow-hidden, crushes/clips its content instead of letting
		// `body` scroll (mobile edit dialog UX fix).
		imageColumn:
			'relative shrink-0 overflow-hidden border-b-2 border-dashed border-ink-faint bg-surface bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px] sm:border-b-0 sm:border-r-2 h-[260px] sm:h-auto',
		// Photo-workshop panel (issue #189 REQ-6): an inset sticker panel that groups
		// the mode pill + adaptive stage + preview tiles as one designed unit on the
		// dotted mat, visually distinct from the form column — replaces the de-seamed
		// full-bleed mat that read as an unfinished wireframe. No thin grey seam.
		modeSectionPanel:
			'flex w-full min-h-0 flex-col rounded-panel border-2 border-ink bg-card p-2.5 shadow-sticker',
		// Empty-state click-to-upload affordance (issue #131 REQ-2/REQ-3): a real
		// button so it is keyboard-focusable with a visible focus ring, not just a
		// static label. Sticker-panel treatment (issue #189 REQ-6) so the empty column
		// reads as intentional as the filled one.
		imagePlaceholder:
			'flex size-full cursor-pointer flex-col items-center justify-center gap-2 rounded-panel border-2 border-ink bg-card shadow-sticker outline-none transition-colors hover:bg-panel-hover focus-visible:ring-2 focus-visible:ring-ring',
		image: 'size-full object-cover',
		// Mobile: overflow-visible so the pinned actions bar sticks to the BODY scroll
		// instead of clipping inside this column. shrink-0 (see imageColumn): keeps this
		// column at its natural content height so `body` scrolls instead of compressing
		// it – min-h-0 is kept for the sm: grid-cell scroll mechanism (harmless with
		// shrink-0 on mobile, since flex-shrink:0 makes min-height moot there).
		detailColumn: 'flex min-h-0 shrink-0 flex-col gap-0 overflow-visible sm:overflow-hidden',
		// Mobile: no own scroll region – fields flow into the body scroll. Desktop:
		// its own scroll region, unchanged.
		detailScroll: 'min-h-0 overflow-visible p-5 sm:flex-1 sm:overflow-y-auto sm:p-7',
		formField: 'flex flex-col gap-1.5',
		formLabel: 'text-sm font-medium text-foreground',
		formRow: 'grid grid-cols-2 gap-3',
		formLabelRow: 'flex min-h-6 items-center justify-between gap-2',
		// Mobile: manager release/delete actions flow with the form scroll; Save
		// itself is hidden here and rendered instead in `mobileSubmitFooter`
		// below (see there for why). Desktop: sm:static – already pinned by flex
		// in the right column, whole block bordered/bg as before.
		formActions:
			'flex flex-col gap-2 px-5 pb-4 sm:static sm:border-t-2 sm:border-dashed sm:border-ink-faint sm:bg-card sm:px-7 sm:py-4',
		// Desktop-only Save button, grouped with the manager release/delete
		// actions in the one pinned block (`sm:order-1` keeps Save first). Hidden
		// on mobile: a `position: sticky` copy nested this deep in the mobile
		// scroll can't stay visible from scroll-top – sticky only re-enters view
		// once you've scrolled down to the element's normal flow position, so on
		// a long form it stayed invisible until the user scrolled most of the
		// way down (mobile edit modal scroll fix, follow-up).
		// `mobileSubmitFooter` below is the real mobile Save button instead: a
		// true DOM sibling outside the scrolling body, always visible regardless
		// of scroll position.
		submitWrapper: 'hidden sm:order-1 sm:block',
		// Mobile-only pinned Save footer (see `submitWrapper` above for why it's
		// a separate element): a true sibling of `body`, not nested inside its
		// scroll, so it's always visible. Hidden on desktop, where
		// `submitWrapper` already renders Save inline with the manager actions.
		mobileSubmitFooter:
			'shrink-0 border-t-2 border-dashed border-ink-faint bg-card px-5 py-4 sm:hidden',
		// Stacked full-width buttons keep the shared sticker hover state shadow-only;
		// the button owner never moves.
		submitButton: 'w-full',
		releaseButton: 'order-1 sm:order-2 w-full',
		// order-*: DOM order is [release, delete, submit] (mobile edit modal
		// scroll fix, see `submitWrapper`); sm:order-* restores Save-first
		// visually on desktop where all three sit in one pinned block.
		deleteButton: 'order-2 sm:order-3 w-full',
		imageInputRow: 'flex flex-col gap-2',
		imageTabRow: 'flex gap-1.5',
		imageTab:
			'cursor-pointer rounded-full border-2 px-3 py-1 text-xs font-semibold transition-colors',

		// ── Read-only view mode (issue #165) ──────────────────────────────────
		// Dedicated slots instead of reusing the edit-mode `body`/`imageColumn`/
		// `detailColumn` above: the view reads as an enlarged gift card with its
		// own composition rules, distinct from the edit-mode grid used by
		// #116/#131/#142.
		// Mobile: one scrolling flex column (media, content, sticky action bar).
		// Desktop: media column + fluid content column sharing row 1 (widened
		// from 340px alongside the ~1100px modal, issue #183 REQ-10); the action
		// bar is the grid's `auto` row, spanning both columns, pinned outside the
		// content column's own scroll region (REQ-1).
		viewGrid:
			'flex min-h-0 flex-1 flex-col overflow-y-auto sm:grid sm:grid-cols-[440px_minmax(0,1fr)] sm:grid-rows-[minmax(0,1fr)_auto] sm:flex-initial sm:overflow-hidden',
		// shrink-0: prevents the mobile flex column from compressing the media area
		// (same rationale as `imageColumn`). Centers the (now natural-aspect, #183
		// REQ-10) photo at any size up to its height cap; desktop fills the grid's
		// row 1 at its natural column width.
		viewMedia:
			'relative flex shrink-0 max-h-[42vh] min-h-[240px] items-center justify-center overflow-hidden border-b-2 border-dashed border-ink-faint bg-surface bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px] p-4 sm:max-h-none sm:min-h-0 sm:border-r-2 sm:border-b-0 sm:p-6',
		// Positioned ancestor for the photo-overlay stack (issue #183 REQ-10: no
		// longer crop-target-sized – shrink-wraps around whatever the natural-aspect
		// photo below renders at, so tall photos display tall and wide ones wide).
		viewPhotoFrame: 'relative inline-block max-w-full',
		// Physical photo sticker (matches the `.polaroid` treatment in WishlistHeader):
		// fixed paper/ink colors that intentionally do NOT follow the palette or dark
		// mode. Shrink-wraps around the natural-aspect photo (issue #183 REQ-10) instead
		// of forcing a square crop; the photo itself carries the raised height cap.
		viewPhoto:
			'inline-block -rotate-2 rounded-[10px] border-2 border-[#4A443A] bg-[#FFFDF6] p-[9px] shadow-[var(--elevation-lifted-strong)] max-w-full',
		viewPhotoInner:
			'inline-block overflow-hidden rounded-[6px] border-2 border-black/10 bg-[#F2F0EA] max-w-full',
		viewContent: 'flex min-h-0 flex-col sm:overflow-hidden',
		// Desktop-only internal scroll region (REQ-1 long-description strategy); mobile
		// flows into the outer `viewGrid` scroll behind the sticky action bar.
		viewContentScroll: 'flex flex-col gap-3 p-4 sm:min-h-0 sm:flex-1 sm:overflow-y-auto sm:p-6',
	},
	variants: {
		imageTabActive: {
			true: {
				imageTab: 'border-ink bg-primary text-primary-foreground',
			},
			false: {
				imageTab:
					'border-ink bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
			},
		},
		// Fully-reserved-by-others dimming (REQ-3): applied to the photo and content
		// separately so the crisp photo-overlay status note (a sibling, not a child of
		// either) is never capped by an ancestor's reduced opacity. Matches the
		// `giftCardVariants` dimmed treatment (issue #102).
		viewDimmed: {
			true: {
				viewPhoto: 'opacity-55 grayscale-50',
				viewContentScroll: 'opacity-55 grayscale-50',
			},
			false: {},
		},
	},
	defaultVariants: {
		imageTabActive: false,
		viewDimmed: false,
	},
});

export type GiftDetailModalMode = 'create' | 'edit';
