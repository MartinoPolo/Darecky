<script lang="ts">
	import { untrack } from 'svelte';
	import { setGiftsContext, wishlistGiftGroupingStorageKey } from './gifts.context.svelte.js';
	import { GIFT_GROUPING_OPTIONS, type GiftForVisitor } from './types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';

	let {
		initialWishlistId = 'wishlist-a',
		initialGifts = [],
		role = 'visitor',
	}: {
		initialWishlistId?: string;
		initialGifts?: GiftForVisitor[];
		role?: WishlistRole;
	} = $props();

	let wishlistId = $state(untrack(() => initialWishlistId));
	let gifts = $state(untrack(() => initialGifts));
	const context = setGiftsContext(
		() => wishlistId,
		() => gifts,
		() => role,
		() => false,
		() => true,
		() => [],
	);

	function prioritizedGift(): GiftForVisitor {
		return {
			id: 'gift-priority',
			wishlistId,
			name: 'Priority gift',
			description: null,
			descriptionAppends: [],
			editedAfterShareAt: null,
			links: [],
			price: null,
			priceMax: null,
			currency: null,
			imageUrl: null,
			imageKey: null,
			imageMeta: null,
			quantity: 1,
			sortOrder: 0,
			received: false,
			createdAt: new Date('2026-01-01T00:00:00Z'),
			priorityLevelId: 'priority-high',
			priorityLabel: 'High',
			prioritySortOrder: 0,
			categoryId: null,
			category: null,
			likeCount: 0,
			reservedCount: 0,
			isFullyReserved: false,
			reserverNames: [],
			myReservationId: null,
			myReservationPurchasedAt: null,
		};
	}
</script>

<div data-testid="grouping">{context.grouping.current}</div>
<div data-testid="effective-grouping">{context.effectiveGrouping.current}</div>
<div data-testid="stored">
	{localStorage.getItem(wishlistGiftGroupingStorageKey(wishlistId)) ?? ''}
</div>
<button onclick={() => (gifts = [prioritizedGift()])}>Add priority</button>
<button onclick={() => (gifts = [])}>Remove priorities</button>
<button onclick={() => (wishlistId = 'wishlist-a')}>Wishlist A</button>
<button onclick={() => (wishlistId = 'wishlist-b')}>Wishlist B</button>
<button onclick={() => (context.grouping.current = GIFT_GROUPING_OPTIONS.none)}>Save none</button>
<button onclick={() => (context.grouping.current = GIFT_GROUPING_OPTIONS.priority)}
	>Save priority</button
>
<button onclick={() => (context.grouping.current = GIFT_GROUPING_OPTIONS.category)}
	>Save category</button
>
