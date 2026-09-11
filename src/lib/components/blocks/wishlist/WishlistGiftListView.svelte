<script lang="ts">
	import GiftListItem from '$lib/components/blocks/gift/GiftListItem.svelte';
	import GiftSectionHeader from './GiftSectionHeader.svelte';
	import WishlistGiftItem from './WishlistGiftItem.svelte';
	import { createGiftPointerReorderController } from './gift_pointer_reorder.svelte.js';
	import { giftSectionHasHeader, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
	import type { GiftByRole, GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { GiftContextInvocation } from './gift_context_invocation.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import * as m from '$lib/paraglide/messages.js';
	import {
		toIndexedSections,
		countGiftsInSections,
		sectionRenderKey,
	} from './gift_section_rows.js';

	interface WishlistGiftListViewProps {
		sections: GiftSection[];
		role: WishlistRole;
		isArchived: boolean;
		hideReservationState: boolean;
		reorderEnabled: boolean;
		onedit: (gift: GiftByRole) => void;
		onreserve: (gift: GiftForVisitor) => void;
		onunreserve: (gift: GiftForVisitor) => void;
		onreceived: (giftId: string, received: boolean) => void;
		onreorderpreview: (orderedIds: string[]) => void;
		onreordercommit: (orderedIds: string[]) => void;
		onreordercancel: (orderedIds: string[]) => void;
		selectionMode?: boolean;
		onselectiontoggle?: (giftId: string) => void;
		oncontextactions?: (gift: GiftByRole, invocation: GiftContextInvocation) => boolean;
		hascontextactions?: (gift: GiftByRole) => boolean;
		activeContextGiftId?: string | null;
		contextSurface?: 'menu' | 'dialog';
	}

	let {
		sections,
		role,
		isArchived,
		hideReservationState,
		reorderEnabled,
		onedit,
		onreserve,
		onunreserve,
		onreceived,
		onreorderpreview,
		onreordercommit,
		onreordercancel,
		selectionMode = false,
		onselectiontoggle,
		oncontextactions,
		hascontextactions,
		activeContextGiftId = null,
		contextSurface = 'menu',
	}: WishlistGiftListViewProps = $props();

	let listEl = $state<HTMLElement | null>(null);
	let reorderAnnouncement = $state('');

	const indexedSections = $derived(toIndexedSections(sections));
	const totalGiftCount = $derived(countGiftsInSections(sections));

	function getItemElements() {
		return listEl === null
			? []
			: Array.from(listEl.querySelectorAll<HTMLElement>('[data-gift-item]'));
	}

	const reorder = createGiftPointerReorderController({
		getItemElements,
		getItemIds: () => getItemElements().map((element) => element.dataset.giftId!),
		onPreviewOrder: (orderedIds) => onreorderpreview(orderedIds),
		onCommitOrder: (orderedIds) => onreordercommit(orderedIds),
		onCancelOrder: (orderedIds) => onreordercancel(orderedIds),
	});

	function handleReorderMove(index: number, direction: -1 | 1) {
		const destination = index + direction;
		if (destination >= 0 && destination < totalGiftCount) {
			if (!reorder.move(index, direction)) {
				return;
			}
			const movedGift = indexedSections
				.flatMap(({ items }) => items)
				.find((item) => item.index === index)?.gift;
			if (movedGift !== undefined) {
				reorderAnnouncement = m.gift_reorder_move_success({
					name: movedGift.name,
					position: destination + 1,
					total: totalGiftCount,
				});
			}
		}
	}

	$effect(() => {
		if (!reorderEnabled) {
			reorder.cancel();
		}
	});
	$effect(() => () => reorder.destroy());
</script>

<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
	{reorderAnnouncement}
</div>

<div
	bind:this={listEl}
	data-testid="wishlist-gift-list"
	class="isolate flex flex-col gap-2.5 sm:gap-4"
>
	{#each indexedSections as { section, items } (sectionRenderKey(section, items))}
		{#if giftSectionHasHeader(section)}
			<GiftSectionHeader {section} {selectionMode} {onselectiontoggle} />
		{/if}
		{#each items as { gift: giftItem, index } (giftItem.id)}
			<WishlistGiftItem
				selectionLayout="list"
				gift={giftItem}
				{index}
				totalCount={totalGiftCount}
				{reorderEnabled}
				draggedGiftId={reorder.draggedGiftId.current}
				dragOverGiftId={reorder.dragOverGiftId.current}
				dragOverStyle="bg"
				{selectionMode}
				{onselectiontoggle}
				{oncontextactions}
				{onedit}
				onreorderpointerdown={reorder.start}
				onreordermove={handleReorderMove}
			>
				{#snippet children(giftItem)}
					<GiftListItem
						gift={giftItem}
						{role}
						{isArchived}
						{hideReservationState}
						contextualMode={selectionMode || reorderEnabled}
						{onreserve}
						{onunreserve}
						{onreceived}
						moreOpen={activeContextGiftId === giftItem.id}
						moreSurface={contextSurface}
						onmore={oncontextactions !== undefined &&
						hascontextactions !== undefined &&
						hascontextactions(giftItem)
							? (anchor) => oncontextactions(giftItem, { kind: 'more', anchor })
							: undefined}
					/>
				{/snippet}
			</WishlistGiftItem>
		{/each}
	{/each}
</div>
