import { tv } from 'tailwind-variants';

export const avatarVariants = tv({
	slots: {
		root: 'relative inline-flex shrink-0 items-center justify-center overflow-hidden select-none',
		image: 'size-full',
		fallback:
			'flex size-full items-center justify-center bg-primary/10 font-semibold text-primary',
	},
	variants: {
		size: {
			xs: { root: 'size-6', fallback: 'text-[10px]' },
			/* sm matches header controls (--size-control-md = 32px). */
			sm: { root: 'size-8', fallback: 'text-sm' },
			md: { root: 'size-10', fallback: 'text-base' },
			lg: { root: 'size-12', fallback: 'text-lg' },
		},
		/* Anime-sky sticker treatment: ink border + hard offset shadow, matching the
		   outline header buttons it sits next to. The crop radius is the single source
		   of truth for the photo/initials corners (it overrides ImageFrame's own
		   shape radius via tailwind-merge). When bordered, keep the crop CONCENTRIC
		   with the ink border — inner radius = outer rounded-xl minus the 2.5px border
		   width — so the photo and border corners align instead of the photo reading
		   rounder (#137). Without a border there is nothing to inset, so the crop just
		   matches the container's rounded-xl. */
		bordered: {
			true: {
				root: 'border-[2.5px] border-ink bg-card shadow-sticker-sm',
			},
			false: {},
		},
		shape: {
			square: {
				root: 'rounded-xl',
				image: 'rounded-xl',
				fallback: 'rounded-xl',
			},
			circle: {
				root: 'rounded-full',
				image: 'rounded-full',
				fallback: 'rounded-full',
			},
		},
		appearance: {
			default: {},
			recipient: {
				root: 'size-6 rounded-full border-2 border-ink bg-primary shadow-none',
				image: 'rounded-[10px] [&>img]:rounded-[10px]',
				fallback:
					'rounded-[10px] bg-primary text-[10px] font-extrabold text-primary-foreground',
			},
		},
	},
	compoundVariants: [
		{
			bordered: true,
			shape: 'square',
			class: {
				image: 'rounded-[calc(var(--radius-xl)-2.5px)]',
				fallback: 'rounded-[calc(var(--radius-xl)-2.5px)]',
			},
		},
		{
			bordered: true,
			shape: 'circle',
			size: 'xs',
			class: {
				// 24px outer diameter / 2 - 2.5px border = 9.5px concentric inner radius.
				image: 'rounded-[9.5px] [&>img]:rounded-[9.5px]',
				fallback: 'rounded-[9.5px]',
			},
		},
	],
	defaultVariants: {
		size: 'sm',
		bordered: false,
		shape: 'square',
		appearance: 'default',
	},
});

export type AvatarSize = keyof typeof avatarVariants.variants.size;
export type AvatarShape = keyof typeof avatarVariants.variants.shape;
export type AvatarAppearance = keyof typeof avatarVariants.variants.appearance;

export const AVATAR_SIZES = Object.keys(avatarVariants.variants.size) as AvatarSize[];
export const AVATAR_SHAPES = Object.keys(avatarVariants.variants.shape) as AvatarShape[];
export const AVATAR_APPEARANCES = Object.keys(
	avatarVariants.variants.appearance,
) as AvatarAppearance[];
