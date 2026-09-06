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
		onmore?: () => void;
		class?: string;
	}

	let { children, secondary, onmore, class: className }: Props = $props();

	const styles = $derived(
		giftActionRowVariants({
			withMore: onmore !== undefined,
			withSecondary: secondary !== undefined,
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
			size="md"
			class={styles.more()}
			surfaceClass="h-full p-0"
			aria-label={m.gift_more_actions()}
			data-testid="gift-more-actions"
			onclick={(event) => {
				event.stopPropagation();
				onmore();
			}}><EllipsisIcon /></Button
		>
	{/if}
</div>

<style>
	.gift-action-row {
		--gift-action-control-size: var(--size-control-xl);
	}

	.gift-action-slot :global(> [data-slot='button']) {
		height: auto;
		min-height: var(--gift-action-control-size);
		flex-grow: 1;
		min-width: 0;
		width: 100%;
		align-self: stretch;
	}

	.gift-action-slot :global(> [data-slot='button'] > .elevation-surface) {
		height: 100%;
	}

	@media (width >= 640px) {
		.gift-action-row {
			--gift-action-control-size: var(--size-control-md);
		}
	}
</style>
