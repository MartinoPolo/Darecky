<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import GiftCard from './GiftCard.svelte';

	const { Story } = defineMeta({
		title: 'Blocks/Gift/GiftCard',
		component: GiftCard,
		tags: ['autodocs'],
	});

	// ── Fixtures ────────────────────────────────────────────────────────────
	const baseGift: GiftForVisitor = {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: 'Bezdrátová sluchátka',
		description: null,
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [{ url: 'https://www.alza.cz/sluchatka' }],
		price: 1490,
		priceMax: null,
		currency: 'CZK',
		imageUrl: null,
		imageKey: null,
		imageMeta: null,
		quantity: 1,
		sortOrder: 0,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		likeCount: 2,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
	};

	const NOT_RESERVED: GiftForVisitor = baseGift;

	const RESERVED_BY_ME: GiftForVisitor = {
		...baseGift,
		reservedCount: 1,
		isFullyReserved: true,
		myReservationId: 'reservation-1',
	};

	const RESERVED_BY_SOMEONE_ELSE: GiftForVisitor = {
		...baseGift,
		reservedCount: 1,
		isFullyReserved: true,
	};

	const PURCHASED: GiftForVisitor = {
		...baseGift,
		reservedCount: 1,
		isFullyReserved: true,
		myReservationId: 'reservation-1',
		myReservationPurchasedAt: new Date('2026-01-02T00:00:00Z'),
	};

	const RECEIVED_RESERVED_BY_ME: GiftForVisitor = {
		...RESERVED_BY_ME,
		received: true,
		likeCount: 12,
	};

	// Single unbroken 90-char token (issue #210/#211): no space, so the browser has no
	// break opportunity. `name`'s `line-clamp-2` implies `overflow: hidden`, which per the
	// CSS Sizing spec zeroes this grid item's automatic minimum size — so unlike the
	// reserve dialog's `giftName` (fixed by #210) or the footer's button pair (fixed by
	// #211), the card title never needed an explicit `min-w-0`: the run gets visually
	// clipped after two lines instead of dragging the card wider.
	const HOSTILE_NAME_GIFT: GiftForVisitor = {
		...RESERVED_BY_ME,
		name: 'x'.repeat(90),
	};

	// Realistic long multi-word Czech name (issue #211): wraps at word boundaries, so it
	// stresses the reservation-action layout without tripping the hostile-name issue above.
	const LONG_NAME_GIFT: GiftForVisitor = {
		...RESERVED_BY_ME,
		name: 'Bezdrátová herní myš s RGB podsvícením a vyměnitelnými tlačítky pro praváky i leváky',
	};
</script>

<script lang="ts">
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { setReservationsContext } from '$lib/modules/reservations/reservations.context.svelte.js';
	import { RESERVATION_RELEASE_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';

	// GiftCard's footer reads `useLikes()`/`useGifts()`/`useReservations()`, which only the
	// real wishlist page provides. Stand in with minimal contexts so every story below can render.
	setLikesContext(
		() => [],
		() => true,
		() => {},
	);
	setGiftsContext(
		() => 'gift-card-story',
		() => [],
		() => WISHLIST_ROLES.visitor,
		() => false,
		() => true,
		() => [],
	);
	// No release reach in isolation: these harnesses exercise the card/row itself, not the
	// administrator override (see ReleaseReservationTestHost.svelte for that flow).
	setReservationsContext(
		() => RESERVATION_RELEASE_CAPABILITY.none,
		() => [],
		async () => false,
	);
</script>

<Story name="Not Reserved">
	{#snippet template()}
		<div class="w-72">
			<GiftCard gift={NOT_RESERVED} role={WISHLIST_ROLES.visitor} />
		</div>
	{/snippet}
</Story>

<Story name="Reserved By Me [both actions]">
	{#snippet template()}
		<div class="w-72">
			<GiftCard gift={RESERVED_BY_ME} role={WISHLIST_ROLES.visitor} />
		</div>
	{/snippet}
</Story>

<Story name="Reserved By Someone Else">
	{#snippet template()}
		<div class="w-72">
			<GiftCard gift={RESERVED_BY_SOMEONE_ELSE} role={WISHLIST_ROLES.visitor} />
		</div>
	{/snippet}
</Story>

<Story name="Purchased">
	{#snippet template()}
		<div class="w-72">
			<GiftCard gift={PURCHASED} role={WISHLIST_ROLES.visitor} />
		</div>
	{/snippet}
</Story>

<Story name="Narrow Received + Reserved + Like">
	{#snippet template()}
		<div class="w-36">
			<GiftCard gift={RECEIVED_RESERVED_BY_ME} role={WISHLIST_ROLES.visitor} />
		</div>
	{/snippet}
</Story>

<Story name="Hostile fixture: 90-char unbroken name [contained by line-clamp]">
	{#snippet template()}
		<div class="w-72">
			<GiftCard gift={HOSTILE_NAME_GIFT} role={WISHLIST_ROLES.visitor} />
		</div>
	{/snippet}
</Story>

<Story name="Realistic long Czech name">
	{#snippet template()}
		<div class="w-72">
			<GiftCard gift={LONG_NAME_GIFT} role={WISHLIST_ROLES.visitor} />
		</div>
	{/snippet}
</Story>
