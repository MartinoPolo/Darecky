<script lang="ts">
	import GiftCard from '$lib/components/blocks/gift/GiftCard.svelte';
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

	interface WishlistGiftCardGridProps {
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
	}: WishlistGiftCardGridProps = $props();

	let gridEl = $state<HTMLElement | null>(null);
	let reorderAnnouncement = $state('');

	const indexedSections = $derived(toIndexedSections(sections));
	const totalGiftCount = $derived(countGiftsInSections(sections));

	function getItemElements() {
		return gridEl === null
			? []
			: Array.from(gridEl.querySelectorAll<HTMLElement>('[data-gift-item]'));
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

<!-- Each card band spans 7 rows of this grid (see gift_card_variants.ts): the wrapper and
     card are row subgrids, so price/priority/links/footer align across cards in a row.
     gap-5 stays between bands; inside a band the wrapper zeroes the row gap and the card
     sections space themselves with margins. -->
<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
	{reorderAnnouncement}
</div>

<div
	bind:this={gridEl}
	data-testid="wishlist-gift-card-grid"
	class="gift-card-grid isolate grid auto-rows-auto grid-cols-2 gap-2 sm:gap-5 sm:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]"
>
	{#each indexedSections as { section, items } (sectionRenderKey(section, items))}
		{#if giftSectionHasHeader(section)}
			<!-- Full-width band/group header breaks the auto-fill row so cards flow beneath it. -->
			<div class="col-span-full">
				<GiftSectionHeader {section} {selectionMode} {onselectiontoggle} />
			</div>
		{/if}
		{#each items as { gift: giftItem, index } (giftItem.id)}
			<WishlistGiftItem
				gift={giftItem}
				{index}
				totalCount={totalGiftCount}
				{reorderEnabled}
				class="h-full min-w-0 sm:row-span-7 sm:grid sm:grid-rows-subgrid sm:gap-y-0"
				draggedGiftId={reorder.draggedGiftId.current}
				dragOverGiftId={reorder.dragOverGiftId.current}
				dragOverStyle="ring"
				{selectionMode}
				{onselectiontoggle}
				{oncontextactions}
				{onedit}
				onreorderpointerdown={reorder.start}
				onreordermove={handleReorderMove}
			>
				{#snippet children(giftItem)}
					<GiftCard
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

<style>
	@media (width <= 320px) {
		.gift-card-grid {
			grid-template-columns: minmax(0, 1fr);
			gap: 10px;
		}
	}
</style>
