import { tv } from 'tailwind-variants';

/**
 * Anime-sky sticker wishlist card (issue #102 REQ-16, `anime-dashboard.html`):
 * ink border, hard offset shadow, coherent lift, banner with the title on a small
 * rotated label sticker and the status chip pinned top-right. Archived cards dim,
 * desaturate, and stop lifting.
 */
export const wishlistCardVariants = tv({
	slots: {
		root: 'group/card relative isolate flex h-full cursor-pointer flex-col rounded-panel bg-card',
		plate: 'elevation-ordinary pointer-events-none absolute inset-0 z-[1] rounded-panel border-[2.5px] border-ink bg-transparent transition-[translate,scale,box-shadow] duration-(--duration-normal) ease-(--ease-standard)',
		banner: 'relative flex h-32 shrink-0 flex-col items-start justify-end overflow-hidden rounded-t-[calc(var(--radius-panel)-2.5px)] border-b-[2.5px] border-ink p-3.5',
		/** Notebook dot pattern over the tint fallback (hidden when a real photo fills the banner). */
		bannerPattern:
			'pointer-events-none absolute inset-0 bg-[radial-gradient(var(--pattern-dot)_1.4px,transparent_1.5px)] bg-size-[18px_18px]',
		bannerTitle:
			'relative z-[1] max-w-full -rotate-1 truncate rounded-[10px] border-2 border-ink bg-card px-3 py-1 font-heading text-[17px] font-semibold text-foreground shadow-sticker-sm',
		statusBadge:
			'absolute top-3 right-3 z-[1] inline-flex items-center whitespace-nowrap rounded-full border-2 border-ink px-3 py-0.5 text-[12.5px] font-semibold',
		body: 'flex flex-1 flex-col gap-2.5 px-4 pt-3.5 pb-4',
		metaRow: 'flex flex-wrap items-center gap-1.5',
		metaChip:
			'inline-flex items-center gap-1 whitespace-nowrap rounded-full border-2 border-ink bg-surface px-3 py-0.5 text-[13px] font-semibold text-foreground',
		metaText: 'truncate text-[13px] text-muted-foreground',
		ownerRow: 'flex items-center gap-2 text-sm text-muted-foreground',
		ownerAvatar:
			'flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-primary text-[10px] font-extrabold text-primary-foreground',
		progressWrap: 'flex flex-col gap-1.5',
		progressLabelRow:
			'flex items-center justify-between text-[13px] font-bold text-muted-foreground',
		progressValue: 'font-extrabold text-primary',
		progressTrack: 'h-3.5 overflow-hidden rounded-full border-2 border-ink bg-surface',
		progressFill:
			'h-full rounded-full bg-gradient-to-r from-brand to-brand-deep transition-[width] duration-slow ease-out',
		reservationChip:
			'inline-flex items-center gap-1 whitespace-nowrap rounded-full border-2 border-ink bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground',
		availableCount: 'text-[13px] font-semibold text-muted-foreground',
		divider: 'my-0.5 border-t-2 border-dashed border-ink-faint',
		actions: 'flex flex-wrap items-center gap-1.5',
		actionsEnd: 'ml-auto flex items-center gap-1.5',
	},
	variants: {
		archived: {
			true: {
				root: 'opacity-70 grayscale-[0.7] bg-[color-mix(in_oklab,var(--card)_82%,var(--surface))]',
			},
			false: { root: 'elevation-owner elevation-owner-raised' },
		},
	},
	defaultVariants: {
		archived: false,
	},
});

/** Status chip fills per wishlist status: shared (active) is the loud filled chip. */
export const STATUS_CHIP_CLASSES = {
	draft: 'bg-card text-foreground',
	active: 'bg-primary text-primary-foreground',
	archived: 'bg-card text-muted-foreground',
} as const;
