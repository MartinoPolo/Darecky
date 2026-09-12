<script lang="ts">
	import {
		PALETTES,
		PALETTE_LABELS,
		PALETTE_SWATCHES,
		type Palette,
	} from '$lib/theme/palettes.js';
	import { ChoiceRow } from '$lib/components/derived/choice-row/index.js';

	interface WishlistPalettePickerProps {
		/** Currently selected palette (drives aria-pressed). */
		value: Palette;
		/** Fired with the clicked palette. Caller owns persistence/state. */
		onchange: (palette: Palette) => void;
		/** Disable all swatches (e.g. while a parent form submits). */
		disabled?: boolean;
	}

	let { value, onchange, disabled = false }: WishlistPalettePickerProps = $props();
</script>

<!-- Pure controlled wishlist palette picker (issue #102 REQ-5): the 10 curated
     palettes as a 2-column swatch grid. Selection is a local settings draft; the
     parent composite save owns persistence. -->
<div class="grid grid-cols-2 gap-1">
	{#each PALETTES as paletteOption (paletteOption)}
		<ChoiceRow
			selected={paletteOption === value}
			{disabled}
			onSelect={() => onchange(paletteOption)}
		>
			{#snippet leading()}
				<span
					class="size-4 shrink-0 rounded-full border-2 border-ink"
					style:background-color={PALETTE_SWATCHES[paletteOption]}
					aria-hidden="true"
				></span>
			{/snippet}
			{PALETTE_LABELS[paletteOption]}
		</ChoiceRow>
	{/each}
</div>
