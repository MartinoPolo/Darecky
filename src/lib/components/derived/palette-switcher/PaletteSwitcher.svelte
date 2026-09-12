<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import * as Popover from '$lib/components/base/popover/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import { ChoiceRow } from '$lib/components/derived/choice-row/index.js';
	import DepthStyleSwitcher from '$lib/components/derived/depth-style-switcher/DepthStyleSwitcher.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { setUserPalette } from '$lib/modules/settings/settings.remote.js';
	import {
		DEFAULT_PALETTE,
		PALETTES,
		PALETTE_LABELS,
		PALETTE_SWATCHES,
		isPalette,
		type Palette,
	} from '$lib/theme/palettes.js';

	interface PaletteSwitcherProps {
		/** `popover` = header icon trigger; `inline` = label + grid for drawers/consolidated menus. */
		variant?: 'popover' | 'inline';
	}

	let { variant = 'popover' }: PaletteSwitcherProps = $props();

	let isOpen = $state(false);
	// SSR renders the viewer's palette as `data-palette` on <html> (hooks.server.ts);
	// the client picks it up here to mark the current selection.
	let currentPalette = $state<Palette>(DEFAULT_PALETTE);

	onMount(() => {
		const domPalette = document.documentElement.dataset.palette;
		if (isPalette(domPalette)) {
			currentPalette = domPalette;
		}
	});

	async function selectPalette(palette: Palette) {
		isOpen = false;
		if (palette === currentPalette) {
			return;
		}

		currentPalette = palette;
		// Instant feedback: retheme the whole page before the server round-trip.
		document.documentElement.dataset.palette = palette;

		try {
			await setUserPalette(palette);
		} catch (err) {
			// The page is already themed; only persistence failed (retried on next change).
			console.error('[PaletteSwitcher] failed to persist palette', err);
		}
	}
</script>

{#snippet paletteGrid()}
	<div class="grid grid-cols-2 gap-1">
		{#each PALETTES as palette (palette)}
			<ChoiceRow
				selected={palette === currentPalette}
				onSelect={() => selectPalette(palette)}
			>
				{#snippet leading()}
					<span
						class="size-4 shrink-0 rounded-full border-2 border-ink"
						style:background-color={PALETTE_SWATCHES[palette]}
						aria-hidden="true"
					></span>
				{/snippet}
				{PALETTE_LABELS[palette]}
			</ChoiceRow>
		{/each}
	</div>
{/snippet}

{#if variant === 'inline'}
	<div role="group" aria-label={m.palette_switcher_label()} class="flex flex-col gap-1.5">
		<span class="text-(length:--text-sm) font-semibold text-muted-foreground"
			>{m.palette_switcher_label()}</span
		>
		{@render paletteGrid()}
	</div>
{:else}
	<Popover.Root bind:open={isOpen}>
		<SimpleTooltip text={m.palette_switcher_tooltip()} side="bottom" disabled={isOpen}>
			<Popover.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						intent="outline"
						size="icon"
						aria-label={m.palette_switcher_label()}
					>
						<!-- Dot inherits the active palette via the cascade (--primary = --p-brand). -->
						<span
							class="size-4 shrink-0 rounded-full border-2 border-ink bg-primary"
							aria-hidden="true"
						></span>
					</Button>
				{/snippet}
			</Popover.Trigger>
		</SimpleTooltip>
		<Popover.Content
			role="dialog"
			align="end"
			class="w-66 min-w-0 p-2.5"
			aria-label={m.palette_switcher_label()}
		>
			<Popover.Label>{m.palette_switcher_label()}</Popover.Label>
			{@render paletteGrid()}
			<Separator class="my-2" />
			<DepthStyleSwitcher />
		</Popover.Content>
	</Popover.Root>
{/if}
