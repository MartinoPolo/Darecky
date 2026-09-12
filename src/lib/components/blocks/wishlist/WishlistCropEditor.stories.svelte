<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, waitFor, within } from 'storybook/test';
	import WishlistCropEditor from './WishlistCropEditor.svelte';
	import { IMAGE_FIT_MODES } from '$lib/components/derived/image-frame/index.js';
	import type { WishlistImageSlots } from '$lib/modules/images/index.js';

	const { Story } = defineMeta({
		title: 'Blocks/Wishlist/WishlistCropEditor',
		component: WishlistCropEditor,
		tags: ['autodocs'],
	});

	function noop() {}

	// A wishlist that already has an assigned image so the per-slot crop workflow renders.
	// The object key resolves to a same-origin /api/upload route that is absent in Storybook;
	// ImageFrame degrades to its themed fallback, leaving the interactive controls intact.
	const ASSIGNED_KEY = 'wishlists/banners/demo.jpg';
	const ASSIGNED_SLOTS = {
		card: {
			fitMode: IMAGE_FIT_MODES.coverCrop,
			cropRect: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
			focal: { x: 50, y: 50 },
			zoom: 1.25,
		},
		thumbnail: {
			fitMode: IMAGE_FIT_MODES.coverCrop,
			cropRect: { x: 0, y: 0, w: 1, h: 1 },
			focal: { x: 50, y: 50 },
			zoom: 1,
		},
		banner: {
			fitMode: IMAGE_FIT_MODES.coverCrop,
			cropRect: { x: 0, y: 0, w: 1, h: 1 },
			focal: { x: 50, y: 50 },
			zoom: 1,
		},
		social: {
			fitMode: IMAGE_FIT_MODES.coverCrop,
			cropRect: { x: 0, y: 0, w: 1, h: 1 },
			focal: { x: 50, y: 50 },
			zoom: 1,
		},
	} satisfies WishlistImageSlots;

	// The preview workflow since #116 (D3 + follow-up): three slot tiles render (banner
	// removed from the editor; its persisted JSON above is retained), exactly one is
	// active (the card slot by default), and selecting another tile moves the active
	// selection and promotes that slot to Manual mode. The display-mode control offers
	// Fill / Fit / Manual for the active slot.
	const playSlotSelection = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);

		// Three per-slot preview tiles (aria-pressed buttons), one active by default.
		await waitFor(() => {
			expect(canvas.getAllByRole('button', { pressed: true })).toHaveLength(1);
			expect(canvas.getAllByRole('button', { pressed: false })).toHaveLength(2);
		});

		// Fit-mode control exposes the three modes for the active slot.
		await expect(canvas.getAllByRole('radio')).toHaveLength(3);

		// Selecting another slot tile moves the active selection to it.
		const thumbnailTile = canvas.getByRole('button', { name: /Miniatura|Thumbnail/ });
		await userEvent.click(thumbnailTile);
		await waitFor(() => {
			expect(thumbnailTile).toHaveAttribute('aria-pressed', 'true');
			expect(canvas.getByRole('radio', { name: /Ručně|Manual/ })).toBeChecked();
		});
	};
</script>

<Story name="No image (upload)">
	{#snippet template()}
		<div class="max-w-2xl">
			<WishlistCropEditor
				imageKey={null}
				imageSlots={null}
				themeEmoji="🎁"
				title="Sample wishlist"
				onsave={noop}
			/>
		</div>
	{/snippet}
</Story>

<Story name="With image – slot previews [play: slot selection]" play={playSlotSelection}>
	{#snippet template()}
		<div class="max-w-2xl">
			<WishlistCropEditor
				imageKey={ASSIGNED_KEY}
				imageSlots={ASSIGNED_SLOTS}
				themeEmoji="🎂"
				title="Sample wishlist"
				onsave={noop}
			/>
		</div>
	{/snippet}
</Story>
