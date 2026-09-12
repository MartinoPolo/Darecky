<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, waitFor, within } from 'storybook/test';
	import WishlistPalettePicker from './WishlistPalettePicker.svelte';

	const { Story } = defineMeta({
		title: 'Blocks/Wishlist/PalettePicker',
		component: WishlistPalettePicker,
		tags: ['autodocs'],
	});

	function getPaletteSwatches(canvasElement: HTMLElement): HTMLElement[] {
		return within(canvasElement)
			.getAllByRole('button')
			.filter((button) => button.hasAttribute('aria-pressed'));
	}

	const playControlledSelection = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const swatches = getPaletteSwatches(canvasElement);

		// The initial `value` (sky = first palette) is the only pressed swatch.
		await expect(swatches[0]).toHaveAttribute('aria-pressed', 'true');
		await expect(
			swatches.filter((swatch) => swatch.getAttribute('aria-pressed') === 'true'),
		).toHaveLength(1);

		// Clicking the second swatch fires onchange, which updates the controlled
		// `value` and re-renders selection onto the clicked swatch only.
		await userEvent.click(swatches[1]);
		await waitFor(() => {
			const updatedSwatches = getPaletteSwatches(canvasElement);
			expect(updatedSwatches[1]).toHaveAttribute('aria-pressed', 'true');
			expect(updatedSwatches[0]).toHaveAttribute('aria-pressed', 'false');
			expect(
				updatedSwatches.filter((swatch) => swatch.getAttribute('aria-pressed') === 'true'),
			).toHaveLength(1);
		});
	};
</script>

<script lang="ts">
	import type { Palette } from '$lib/theme/palettes.js';

	let value = $state<Palette>('sky');
</script>

<!-- Controlled usage: the caller owns `value` state and updates it in onchange. -->
<Story name="Controlled [play: selection updates]" play={playControlledSelection}>
	{#snippet template()}
		<div class="w-72">
			<WishlistPalettePicker {value} onchange={(palette) => (value = palette)} />
		</div>
	{/snippet}
</Story>

<Story name="Disabled">
	{#snippet template()}
		<div class="w-72">
			<WishlistPalettePicker value="sky" onchange={() => {}} disabled />
		</div>
	{/snippet}
</Story>
