<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Select from '$lib/components/base/select/index.js';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import { GIFT_SORT_OPTIONS, type GiftSortOption } from '$lib/modules/gifts/types.js';
	import { GIFT_SORT_KEYS, GIFT_SORT_LABELS } from './gift_sort_options.js';
	import { cn } from '$lib/utils.js';

	interface GiftSortSelectProps {
		value: GiftSortOption;
		onchange: (sort: GiftSortOption) => void;
		open?: boolean;
		onopenchange?: (open: boolean) => void;
		disabled?: boolean;
		class?: string;
	}

	let {
		value,
		onchange,
		open = false,
		onopenchange,
		disabled = false,
		class: className,
	}: GiftSortSelectProps = $props();

	function isGiftSortOption(candidate: string): candidate is GiftSortOption {
		return candidate in GIFT_SORT_OPTIONS;
	}

	const combinedLabel = $derived(`${m.gift_sort_by()}: ${GIFT_SORT_LABELS[value]()}`);
</script>

<!-- Visible sort select in the wishlist toolbar (issue #101 / #102 REQ-15) -->
<Select.Root
	type="single"
	{value}
	{open}
	onOpenChange={onopenchange}
	{disabled}
	onValueChange={(newValue) => {
		if (isGiftSortOption(newValue)) {
			onchange(newValue);
		}
	}}
>
	<Select.Trigger
		size="md"
		appearance="raised"
		class={cn('min-w-0 max-w-full', className)}
		surfaceClass="px-3 group-hover:bg-accent group-hover:text-accent-foreground"
		aria-label={combinedLabel}
		title={combinedLabel}
	>
		<ArrowUpDownIcon class="size-4 shrink-0 text-muted-foreground" data-toolbar-icon="sort" />
		<span class="min-w-0 truncate">{GIFT_SORT_LABELS[value]()}</span>
	</Select.Trigger>
	<Select.Content preventScroll={false}>
		<Select.Group>
			{#each GIFT_SORT_KEYS as option (option)}
				<Select.Item value={option} label={GIFT_SORT_LABELS[option]()} />
			{/each}
		</Select.Group>
	</Select.Content>
</Select.Root>
