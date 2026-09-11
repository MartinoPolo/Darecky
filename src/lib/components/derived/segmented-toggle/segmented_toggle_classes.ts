import { tv } from 'tailwind-variants';

export const segmentedToggleVariants = tv({
	slots: {
		surface: 'border-0 bg-transparent group-data-[state=on]:bg-transparent',
		root: 'h-10 gap-px overflow-visible rounded-btn bg-accent shadow-none sm:h-8',
		item: 'size-10 rounded-[calc(var(--radius-btn)-2px)] border-0 bg-transparent shadow-none focus-visible:!outline-offset-2 focus-visible:!outline-ring data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:outline-2 data-[state=on]:outline-solid data-[state=on]:outline-offset-[-2px] data-[state=on]:outline-ink sm:size-8',
	},
});
