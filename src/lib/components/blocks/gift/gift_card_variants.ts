import { tv } from 'tailwind-variants';

/**
 * Anime-sky sticker gift card (issue #102 REQ-14): ink border, hard offset
 * shadow, coherent lift on hover, dotted-mat image background that brightens on
 * hover. `dimmed` covers fully reserved (visitor/moderator view) and received
 * gifts — the card greys out, stops lifting, and the mat stops brightening; the
 * centered state overlay stays crisp on top.
 *
 * The card is a row subgrid spanning 7 tracks (image / name / price / priority
 * / links / description / footer) of the grid in WishlistGiftCardGrid, so the
 * same sections sit on shared rows across every card in a grid row; a card
 * missing a section leaves an aligned blank slot. Sections carry explicit
 * row-start values — without them auto-placement would compact absent sections
 * away. Vertical rhythm comes from item margins (not row gaps) so fully-empty
 * tracks collapse.
 */
export const giftCardVariants = tv({
	slots: {
		// The `group/gift-card` triggers only mirror the drag grip so the card and grip lift in
		// lock-step; the card itself lifts through the semantic owner selector in app.css.
		card: 'group relative isolate grid h-full min-h-[280px] grid-rows-[auto_minmax(0,1fr)_auto] rounded-panel bg-card [--gift-card-footer-visible-gap:calc(var(--radius-panel)-var(--radius-btn))] sm:row-span-7 sm:min-h-0 sm:grid-rows-subgrid',
		plate: 'elevation-ordinary pointer-events-none absolute inset-0 z-[1] rounded-panel border-[2.5px] border-ink bg-transparent transition-[translate,scale,box-shadow] duration-(--duration-normal) ease-(--ease-standard) group-hover/gift-card:-translate-y-0.5 group-focus-within/gift-card:-translate-y-0.5',
		// 4:3 (issue #183, revises the earlier 1:1 shape): shorter cards, same
		// `minmax(280px, 1fr)` grid column sizing.
		imageArea:
			'relative isolate row-start-1 aspect-[4/3] w-full overflow-hidden rounded-t-[calc(var(--radius-panel)-2.5px)] border-b-[2.5px] border-ink bg-surface',
		/**
		 * Dotted mat behind the photo (shows through letterboxed photos). Sits on
		 * its own layer below the image so its opacity can fade up on hover —
		 * replaces the earlier diagonal position pan, which read as distracting on
		 * top of the card's lift.
		 */
		imagePattern:
			'pointer-events-none absolute inset-0 -z-[1] hidden bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px] opacity-60 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 sm:block',
		/** Grey veil over the image of a dimmed card ("don't buy this" at first glance). */
		imageVeil: 'absolute inset-0 bg-reserved-veil',
		body: 'row-start-2 flex min-h-0 flex-col px-[7px] py-1.5 sm:row-span-5 sm:grid sm:grid-rows-subgrid sm:p-4',
		nameRow: 'row-start-1 flex flex-wrap items-baseline gap-1.5',
		name: 'line-clamp-2 min-h-[34px] font-heading text-[13px] font-semibold leading-[17px] text-foreground sm:min-h-0 sm:text-[17px] sm:leading-snug',
		price: 'row-start-2 mt-2 text-[15px] font-bold text-foreground',
		priceEmpty: 'row-start-2 mt-2 text-sm text-muted-foreground italic',
		priorityEyebrow: 'row-start-3 mt-2 hidden items-center gap-1 sm:flex',
		linkList: 'row-start-4 mt-2 hidden flex-col sm:flex',
		// min-w-0: grid items (unlike flex) get an automatic min-content floor that can force the row wider (#211).
		footer: 'row-start-3 flex min-w-0 items-stretch justify-between gap-1.5 border-t border-dashed border-border p-[var(--gift-card-footer-visible-gap)] sm:row-start-7 sm:gap-2 sm:border-0',
		reservationActions: 'ml-auto flex min-w-0 flex-1 flex-col gap-1.5',
	},
	variants: {
		dimmed: {
			true: {
				card: 'bg-[color-mix(in_oklab,var(--card)_82%,var(--surface))]',
				imagePattern: 'group-hover:opacity-60 group-focus-within:opacity-60',
				body: 'opacity-55 grayscale-50',
				footer: 'opacity-55 grayscale-50',
			},
			false: { card: 'elevation-owner elevation-owner-raised' },
		},
	},
	defaultVariants: {
		dimmed: false,
	},
});
