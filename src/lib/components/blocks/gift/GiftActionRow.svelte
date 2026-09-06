<script lang="ts">
	import type { Snippet } from 'svelte';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { giftActionRowVariants } from './gift_action_row_variants.js';

	interface Props {
		children?: Snippet;
		onmore?: () => void;
		class?: string;
	}

	let { children, onmore, class: className }: Props = $props();

	const styles = $derived(giftActionRowVariants({ withMore: onmore !== undefined }));
</script>

<div class={cn(styles.row(), className)} data-testid="gift-action-row">
	<div class={cn(styles.primary(), 'primary-action')}>
		{@render children?.()}
	</div>
	{#if onmore}
		<Button
			intent="outline"
			size="xl"
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
	.primary-action :global(> [data-slot='button']) {
		height: auto;
		min-height: var(--size-control-xl);
		min-width: 0;
		width: 100%;
		align-self: stretch;
	}

	.primary-action :global(> [data-slot='button'] > .elevation-surface) {
		height: 100%;
	}
</style>
