<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import { cn } from '$lib/utils.js';
	import { formatAppendDate } from '$lib/modules/gifts/gift_display.js';
	import type { DescriptionAppend } from '$lib/modules/gifts/types.js';

	interface GiftDescriptionProps {
		description: string | null;
		descriptionAppends: DescriptionAppend[];
		maxVisibleAppends?: number | null;
		showAppends?: boolean;
		descriptionClass?: string;
		class?: string;
	}

	let {
		description,
		descriptionAppends,
		maxVisibleAppends = null,
		showAppends = true,
		descriptionClass = '',
		class: className = '',
	}: GiftDescriptionProps = $props();

	let showAllAppends = $state(false);

	const hasBase = $derived((description ?? '').trim() !== '');
	const hasAppends = $derived(showAppends && descriptionAppends.length > 0);
	const hasContent = $derived(hasBase || hasAppends);
	const visibleAppendItems = $derived.by(() => {
		if (maxVisibleAppends === null || showAllAppends) {
			return showAppends
				? descriptionAppends.map((append, index) => ({ append, index }))
				: [];
		}
		if (maxVisibleAppends <= 0) {
			return [];
		}
		const startIndex = Math.max(0, descriptionAppends.length - maxVisibleAppends);
		return descriptionAppends
			.slice(startIndex)
			.map((append, offset) => ({ append, index: startIndex + offset }));
	});
	const collapsedHiddenAppendCount = $derived(
		!showAppends || maxVisibleAppends === null
			? 0
			: Math.max(0, descriptionAppends.length - Math.max(0, maxVisibleAppends)),
	);
	const canToggleAppends = $derived(collapsedHiddenAppendCount > 0);

	function toggleAppendHistory(event: MouseEvent) {
		event.stopPropagation();
		showAllAppends = !showAllAppends;
	}
</script>

{#if hasContent}
	<div class={cn('flex flex-col gap-1.5', className)}>
		{#if hasBase}
			<p class={cn('whitespace-pre-line text-sm text-muted-foreground', descriptionClass)}>
				{description}
			</p>
		{/if}
		{#each visibleAppendItems as item (`${item.append.addedAt}:${item.index}`)}
			<!-- Post-share append (issue #102, `anime-gift-detail-modal.html` desc-append):
			     immutable note on an accent-tinted block with the timestamp. -->
			<div
				class="rounded-r-[10px] border-l-4 border-accent-loud bg-[color-mix(in_oklab,var(--accent-loud)_16%,var(--card))] px-3 py-1.5 text-sm whitespace-pre-line text-foreground"
			>
				<span class="text-xs font-bold text-muted-foreground"
					>{formatAppendDate(item.append.addedAt)}</span
				>
				<br />
				{item.append.text}
			</div>
		{/each}
		{#if canToggleAppends}
			<Button
				type="button"
				size="sm"
				intent="ghost"
				class="-ml-1.5 h-7 w-fit"
				surfaceClass="px-1.5 text-xs text-muted-foreground group-hover:text-foreground"
				aria-expanded={showAllAppends}
				onclick={toggleAppendHistory}
				onkeydown={(event: KeyboardEvent) => event.stopPropagation()}
			>
				{#if showAllAppends}
					<ChevronUpIcon data-icon="inline-start" />
					{m.gift_description_history_hide()}
				{:else}
					<ChevronDownIcon data-icon="inline-start" />
					{m.gift_description_history_show({ count: collapsedHiddenAppendCount })}
				{/if}
			</Button>
		{/if}
	</div>
{/if}
