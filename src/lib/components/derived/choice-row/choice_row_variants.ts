import { tv } from 'tailwind-variants';

/** Compact menu-choice geometry preserves the original narrow language/palette rows. */
export const choiceRowVariants = tv({
	base: [
		'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-btn border-2 border-transparent px-2 py-1.5 text-left text-(length:--text-sm) font-semibold text-foreground transition-colors',
		'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
		'disabled:cursor-not-allowed disabled:opacity-50',
		'[&_[data-slot=choice-row-label]]:min-w-0 [&_[data-slot=choice-row-label]]:flex-1 [&_[data-slot=choice-row-label]]:whitespace-normal',
	],
	variants: {
		selected: {
			true: 'border-ink bg-accent',
			false: '',
		},
	},
});
