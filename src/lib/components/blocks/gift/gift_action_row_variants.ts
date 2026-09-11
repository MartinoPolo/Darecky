import { tv } from 'tailwind-variants';

export const giftActionRowVariants = tv({
	slots: {
		row: 'gift-action-row grid min-w-0 grid-cols-[minmax(0,1fr)] items-stretch gap-2 sm:gap-1.5',
		primary: 'gift-action-slot flex min-w-0 flex-col gap-2 sm:gap-1.5',
		secondary:
			'gift-action-slot col-span-full row-start-1 flex min-w-0 flex-col gap-2 sm:gap-1.5',
		more: 'size-(--gift-action-control-size) min-h-0 min-w-0 flex-none self-start',
	},
	variants: {
		controlSizing: {
			fill: {
				primary: "[&>[data-slot='button']]:w-full [&>[data-slot='button']]:grow",
				secondary: "[&>[data-slot='button']]:w-full [&>[data-slot='button']]:grow",
			},
			intrinsic: {
				row: 'ml-auto w-fit max-w-full',
				primary:
					"max-w-full flex-none items-end [&>[data-slot='button']]:w-auto [&>[data-slot='button']]:grow-0",
				secondary:
					"max-w-full flex-none items-end [&>[data-slot='button']]:w-auto [&>[data-slot='button']]:grow-0",
			},
		},
		withMore: {
			true: {
				row: 'grid-cols-[minmax(0,1fr)_var(--gift-action-control-size)]',
			},
			false: {},
		},
		withSecondary: {
			true: {
				primary: 'row-start-2 sm:col-start-2 sm:row-start-1',
				secondary: 'sm:col-span-1 sm:col-start-1 sm:row-start-1',
				more: 'row-start-2 sm:row-start-1',
			},
			false: {},
		},
	},
	compoundVariants: [
		{
			withMore: true,
			withSecondary: true,
			class: {
				row: 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_var(--gift-action-control-size)]',
			},
		},
		{
			withMore: false,
			withSecondary: true,
			class: { row: 'sm:grid-cols-2' },
		},
	],
	defaultVariants: {
		controlSizing: 'fill',
		withMore: false,
		withSecondary: false,
	},
});
