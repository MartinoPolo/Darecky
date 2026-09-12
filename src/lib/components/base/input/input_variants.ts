import type { WithElementRef, WithoutChildren } from '$lib/utils.js';
import type { HTMLInputAttributes } from 'svelte/elements';
import { tv } from 'tailwind-variants';

export const inputVariants = tv({
	base: 'w-full rounded-btn border-[2.5px] border-ink bg-card font-sans font-medium text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-70 read-only:bg-muted read-only:text-muted-foreground focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_22%,transparent)]',
	variants: {
		size: {
			md: 'h-(--size-control-md) px-3 text-(length:--text-md)',
			lg: 'h-(--size-control-lg) px-3.5 text-(length:--text-base)',
		},
		state: {
			default: '',
			success:
				'border-status-success shadow-[0_0_0_3px_color-mix(in_oklab,var(--status-success)_18%,transparent)]',
			error: 'border-status-danger shadow-[0_0_0_3px_color-mix(in_oklab,var(--status-danger)_18%,transparent)]',
			loading:
				'animate-shimmer bg-[length:200%_100%] bg-[linear-gradient(90deg,transparent_0%,color-mix(in_oklab,var(--primary)_12%,transparent)_50%,transparent_100%)]',
		},
	},
	defaultVariants: {
		size: 'md',
		state: 'default',
	},
});

export type InputSize = keyof typeof inputVariants.variants.size;
export type InputState = keyof typeof inputVariants.variants.state;

export const INPUT_STATES = Object.keys(inputVariants.variants.state) as InputState[];

export type InputProps = Omit<WithoutChildren<WithElementRef<HTMLInputAttributes>>, 'size'> & {
	size?: InputSize;
	state?: InputState;
	files?: FileList | null;
};
