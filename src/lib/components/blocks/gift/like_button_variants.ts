import { tv } from 'tailwind-variants';

/**
 * Anime-sky like control (issue #102 REQ-14 + round-2 delta): ghost ink chip
 * with the colored heart; hover tints it with the like blush and lifts it as one surface.
 * `md` matches the mockup card footer and the gift detail modal's action bar
 * (matches `ReserveButton`'s `md` there so the two stay height-aligned), `sm`
 * the compact rows. `ghost` is the borderless card/list chip; `sticker` is the
 * ink-bordered hard-shadow pill used in the detail modal's action bar.
 */
export const likeButtonVariants = tv({
	slots: {
		root: 'group/like inline-flex cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
		surface:
			'elevation-surface inline-flex size-full items-center gap-1.5 rounded-[inherit] border-2 border-transparent font-bold text-foreground transition-[background-color,translate,scale,box-shadow] duration-(--duration-normal) ease-(--ease-standard) group-hover/like:bg-like-tint',
		icon: 'text-heart transition-all duration-200',
		count: 'tabular-nums',
	},
	variants: {
		liked: {
			true: {
				icon: 'fill-heart',
			},
			false: {
				icon: 'fill-transparent',
			},
		},
		size: {
			sm: {
				surface: 'px-1.5 py-0.5 text-[13px]',
				icon: 'size-3.5',
				count: 'text-[12px]',
			},
			md: {
				surface: 'px-2 py-1 text-sm',
				icon: 'size-4',
				count: 'text-[13px]',
			},
			lg: {
				root: 'min-h-[52px] min-w-[52px]',
				surface: 'gap-2 px-4 text-base',
				icon: 'size-5',
				count: 'text-sm',
			},
		},
		appearance: {
			ghost: {},
			sticker: {
				root: 'elevation-owner elevation-owner-raised elevation-owner-like relative rounded-[7px]',
				surface: 'border-ink bg-card',
			},
		},
	},
	defaultVariants: {
		liked: false,
		size: 'md',
		appearance: 'ghost',
	},
});

export type LikeButtonSize = keyof typeof likeButtonVariants.variants.size;
export type LikeButtonAppearance = keyof typeof likeButtonVariants.variants.appearance;
