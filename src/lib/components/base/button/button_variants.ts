import type { WithElementRef } from '$lib/utils.js';
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';
import { asExhaustiveArray } from '$lib/utils/variants.js';

const FILLED_BUTTON_KBD_CLASSES =
	'[&_[data-slot=kbd]]:border-[color-mix(in_oklab,currentColor_28%,transparent)] [&_[data-slot=kbd]]:bg-[color-mix(in_oklab,currentColor_16%,transparent)] [&_[data-slot=kbd]]:text-current';

export const CIRCULAR_STICKER_OWNER_CLASSES = 'elevation-owner elevation-owner-raised';
export const CIRCULAR_STICKER_SURFACE_CLASSES = 'elevation-surface rounded-full';
export const ANCHORED_CIRCULAR_STICKER_OWNER_CLASSES = `${CIRCULAR_STICKER_OWNER_CLASSES} elevation-owner-anchored`;

/** Paint-only classes for raised outline control surfaces (selects use this on their surface). */
export const OUTLINE_CONTROL_SURFACE_CLASSES =
	'border-ink bg-card text-foreground group-hover:bg-accent group-hover:text-accent-foreground';

export const buttonVariants = tv({
	slots: {
		owner: 'group relative inline-flex shrink-0 whitespace-nowrap rounded-btn font-semibold leading-none outline-none select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45',
		surface:
			'elevation-surface inline-flex size-full min-h-inherit min-w-inherit items-center justify-center gap-1.5 rounded-[inherit] border-[2.5px] border-transparent transition-[translate,scale,box-shadow] duration-(--duration-normal) ease-(--ease-standard) delay-0 [&_[data-icon]]:pointer-events-none [&_[data-icon]]:shrink-0',
	},
	variants: {
		intent: {
			primary: {
				owner: 'elevation-owner elevation-owner-raised elevation-owner-anchored',
				surface: `border-ink bg-primary text-primary-foreground group-hover:bg-[color-mix(in_oklab,var(--primary)_86%,white)] ${FILLED_BUTTON_KBD_CLASSES}`,
			},
			secondary: {
				owner: 'elevation-owner elevation-owner-raised elevation-owner-anchored',
				surface: 'border-ink bg-card text-ink group-hover:bg-panel-hover',
			},
			ghost: {
				surface:
					'bg-transparent text-muted-foreground group-hover:bg-accent group-hover:text-foreground',
			},
			'ghost-overlay': {
				surface:
					'bg-transparent text-current opacity-60 group-hover:opacity-90 group-hover:bg-[color-mix(in_oklab,currentColor_10%,transparent)]',
			},
			danger: {
				owner: 'elevation-owner elevation-owner-raised elevation-owner-anchored',
				surface:
					'border-status-danger bg-card text-status-danger group-hover:bg-[color-mix(in_oklab,var(--status-danger)_10%,transparent)]',
			},
			'primary-destructive': {
				owner: 'elevation-owner elevation-owner-raised elevation-owner-anchored',
				surface: `border-ink bg-status-danger text-white group-hover:bg-[color-mix(in_oklab,var(--status-danger)_86%,white)] ${FILLED_BUTTON_KBD_CLASSES}`,
			},
			outline: {
				owner: 'elevation-owner elevation-owner-raised elevation-owner-anchored',
				surface: OUTLINE_CONTROL_SURFACE_CLASSES,
			},
			link: { surface: 'text-primary underline-offset-4 group-hover:underline' },
		},
		size: {
			sm: {
				owner: 'h-(--size-control-sm)',
				surface: 'px-2.25 text-(length:--text-sm) [&_[data-icon]]:size-3.5',
			},
			md: {
				owner: 'h-(--size-control-md)',
				surface: 'px-3 text-(length:--text-md) [&_[data-icon]]:size-4',
			},
			lg: {
				owner: 'h-(--size-control-lg)',
				surface: 'px-4 text-(length:--text-base) [&_[data-icon]]:size-4',
			},
			xl: {
				owner: 'h-(--size-control-xl)',
				surface: 'px-5 text-(length:--text-lg) [&_[data-icon]]:size-5',
			},
			icon: { owner: 'size-(--size-control-md)', surface: 'p-0 [&_svg]:size-4' },
			'icon-sm': { owner: 'size-(--size-control-sm)', surface: 'p-0 [&_svg]:size-3.5' },
		},
	},
	defaultVariants: { intent: 'primary', size: 'md' },
});

export type ButtonIntent = keyof typeof buttonVariants.variants.intent;
export type ButtonSize = keyof typeof buttonVariants.variants.size;
export const BUTTON_INTENTS = Object.keys(buttonVariants.variants.intent) as ButtonIntent[];
export const BUTTON_TEXT_SIZES = [
	'sm',
	'md',
	'lg',
	'xl',
] as const satisfies ReadonlyArray<ButtonSize>;
export const BUTTON_ICON_SIZES = ['icon', 'icon-sm'] as const satisfies ReadonlyArray<ButtonSize>;
export const BUTTON_SIZES = asExhaustiveArray<ButtonSize>()([
	...BUTTON_TEXT_SIZES,
	...BUTTON_ICON_SIZES,
]);

export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
	WithElementRef<HTMLAnchorAttributes> & {
		intent?: ButtonIntent;
		size?: ButtonSize;
		/** Paint and internal layout classes for the moving surface. */
		surfaceClass?: string;
	};
