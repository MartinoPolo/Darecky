<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { setReservationsContext } from '$lib/modules/reservations/reservations.context.svelte.js';
	import {
		RESERVATION_RELEASE_CAPABILITY,
		type ReservationReleaseCapability,
	} from '$lib/modules/wishlists/wishlist_capabilities.js';
	import type { ReservationForModerator } from '$lib/modules/reservations/types.js';
	import GiftCard from './GiftCard.svelte';

	/**
	 * Test/story-only harness: `GiftCard`'s actions (`LikeButton` + `PurchasedToggle`) read
	 * `useLikes()`/`useGifts()`, which only the real wishlist page (`/w/[id]/+page.svelte`)
	 * provides via `setLikesContext`/`setGiftsContext`. This stands in for that page so
	 * `GiftCard` can be rendered in isolation.
	 */
	type Props = ComponentProps<typeof GiftCard> & {
		releaseCapability?: ReservationReleaseCapability;
		reservations?: ReservationForModerator[];
	};
	let {
		releaseCapability = RESERVATION_RELEASE_CAPABILITY.none,
		reservations = [],
		...props
	}: Props = $props();

	setLikesContext(
		() => [],
		() => true,
		() => {},
	);
	setGiftsContext(
		() => 'test-wishlist',
		() => [props.gift],
		() => props.role,
		() => props.isArchived ?? false,
		() => true,
		() => [],
	);
	setReservationsContext(
		() => releaseCapability,
		() => reservations,
		async () => false,
	);
</script>

<GiftCard {...props} />
