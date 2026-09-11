<script lang="ts">
	import type { Snippet } from 'svelte';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { giftActionRowVariants } from './gift_action_row_variants.js';

	interface Props {
		children?: Snippet;
		secondary?: Snippet;
		onmore?: (anchor: HTMLButtonElement) => void;
		moreOpen?: boolean;
		moreSurface?: 'menu' | 'dialog';
		controlSizing?: 'fill' | 'intrinsic';
		class?: string;
	}

	let {
		children,
		secondary,
		onmore,
		moreOpen = false,
		moreSurface = 'menu',
		controlSizing = 'fill',
		class: className,
	}: Props = $props();

	const styles = $derived(
		giftActionRowVariants({
			withMore: onmore !== undefined,
			withSecondary: secondary !== undefined,
			controlSizing,
		}),
	);
</script>

<div class={cn(styles.row(), className)} data-testid="gift-action-row">
	{#if secondary}
		<div class={styles.secondary()} data-testid="gift-action-secondary">
			{@render secondary()}
		</div>
	{/if}
	<div class={styles.primary()}>
		{@render children?.()}
	</div>
	{#if onmore}
		<Button
			intent="outline"
			size="icon"
			class={styles.more()}
			aria-label={m.gift_more_actions()}
			data-gift-action="more"
			data-testid="gift-more-actions"
			onclick={(event) => {
				event.stopPropagation();
				onmore(event.currentTarget as HTMLButtonElement);
			}}
			onkeydown={(event) => {
				if (event.key === 'ArrowDown') {
					event.preventDefault();
					event.stopPropagation();
					onmore(event.currentTarget as HTMLButtonElement);
				}
			}}
			aria-haspopup={moreSurface}
			aria-expanded={moreOpen}><EllipsisIcon data-icon /></Button
		>
	{/if}
</div>

<style>
	.gift-action-row {
		--gift-action-control-size: var(--size-control-md);
	}

	.gift-action-slot :global(> [data-slot='button']) {
		height: var(--gift-action-control-size);
		min-width: 0;
	}

	.gift-action-slot :global(> [data-slot='button'] > .elevation-surface) {
		height: 100%;
	}

	/* Keep compact visuals while giving coarse pointers a separate 40px hit area.
	 * The 8px mobile gaps make neighboring 4px expansions meet without overlapping. */
	@media (width < 640px) and (pointer: coarse) {
		.gift-action-slot :global(> [data-slot='button']::before),
		.gift-action-row > :global([data-slot='button']::before) {
			position: absolute;
			inset: -4px;
			content: '';
		}
	}
</style>
