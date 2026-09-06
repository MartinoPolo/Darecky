import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
import { wishlistGiftGroupingStorageKey } from './gifts.context.svelte.js';
import { GIFT_GROUPING_OPTIONS, type GiftForVisitor } from './types.js';
import GiftsContextTestHost from './gifts_context_test_host.svelte';

function makeGift(options: { priority?: boolean; category?: boolean } = {}): GiftForVisitor {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-a',
		name: 'Gift',
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
		priorityLevelId: options.priority ? 'priority-high' : null,
		priorityLabel: options.priority ? 'High' : null,
		prioritySortOrder: options.priority ? 0 : null,
		categoryId: options.category ? 'category-books' : null,
		category: options.category
			? {
					id: 'category-books',
					presetKey: null,
					customLabel: 'Books',
					color: '#000000',
					sortOrder: 0,
				}
			: null,
		likeCount: 0,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
	};
}

async function expectGrouping(screen: ReturnType<typeof render>, value: string) {
	await expect.element(screen.getByTestId('grouping')).toHaveTextContent(value);
	await expect.element(screen.getByTestId('effective-grouping')).toHaveTextContent(value);
}

afterEach(() => localStorage.clear());

describe('wishlist grouping preference default (#363)', () => {
	it.each(Object.values(WISHLIST_ROLES))(
		'defaults every %s role to priority when available',
		async (role) => {
			const screen = render(GiftsContextTestHost, {
				role: role as WishlistRole,
				initialGifts: [makeGift({ priority: true })],
			});
			await expectGrouping(screen, GIFT_GROUPING_OPTIONS.priority);
			expect(localStorage.getItem(wishlistGiftGroupingStorageKey('wishlist-a'))).toBeNull();
		},
	);

	it('defaults to none without priorities, then reacts when priority data arrives without persisting', async () => {
		const screen = render(GiftsContextTestHost);
		await expectGrouping(screen, GIFT_GROUPING_OPTIONS.none);
		await screen.getByRole('button', { name: 'Add priority' }).click();
		await expectGrouping(screen, GIFT_GROUPING_OPTIONS.priority);
		expect(localStorage.getItem(wishlistGiftGroupingStorageKey('wishlist-a'))).toBeNull();
	});

	it.each([
		[GIFT_GROUPING_OPTIONS.none, { priority: true }],
		[GIFT_GROUPING_OPTIONS.priority, { priority: true }],
		[GIFT_GROUPING_OPTIONS.category, { category: true }],
	] as const)('preserves an explicit saved %s choice', async (saved, giftOptions) => {
		localStorage.setItem(wishlistGiftGroupingStorageKey('wishlist-a'), JSON.stringify(saved));
		const screen = render(GiftsContextTestHost, { initialGifts: [makeGift(giftOptions)] });
		await expectGrouping(screen, saved);
	});

	it('keeps saved and unsaved wishlist scopes independent while navigating', async () => {
		localStorage.setItem(
			wishlistGiftGroupingStorageKey('wishlist-a'),
			JSON.stringify(GIFT_GROUPING_OPTIONS.none),
		);
		const screen = render(GiftsContextTestHost, {
			initialGifts: [makeGift({ priority: true })],
		});
		await expectGrouping(screen, GIFT_GROUPING_OPTIONS.none);
		await screen.getByRole('button', { name: 'Wishlist B' }).click();
		await expectGrouping(screen, GIFT_GROUPING_OPTIONS.priority);
		expect(localStorage.getItem(wishlistGiftGroupingStorageKey('wishlist-b'))).toBeNull();
		await screen.getByRole('button', { name: 'Wishlist A' }).click();
		await expectGrouping(screen, GIFT_GROUPING_OPTIONS.none);
	});

	it('repairs invalid storage with the current fallback and retains availability coercion', async () => {
		const key = wishlistGiftGroupingStorageKey('wishlist-a');
		localStorage.setItem(key, '"invalid"');
		const invalidScreen = render(GiftsContextTestHost, {
			initialGifts: [makeGift({ priority: true })],
		});
		await expectGrouping(invalidScreen, GIFT_GROUPING_OPTIONS.priority);
		expect(localStorage.getItem(key)).toBe(JSON.stringify(GIFT_GROUPING_OPTIONS.priority));
		await invalidScreen.unmount();

		localStorage.setItem(key, JSON.stringify(GIFT_GROUPING_OPTIONS.priority));
		const unavailableScreen = render(GiftsContextTestHost);
		await expectGrouping(unavailableScreen, GIFT_GROUPING_OPTIONS.none);
		await expect
			.poll(() => localStorage.getItem(key))
			.toBe(JSON.stringify(GIFT_GROUPING_OPTIONS.none));
	});

	it('preserves legacy priority grouping migration', async () => {
		localStorage.setItem('prejemesi-gift-priority-grouping', 'true');
		const screen = render(GiftsContextTestHost, {
			initialGifts: [makeGift({ priority: true })],
		});
		await expectGrouping(screen, GIFT_GROUPING_OPTIONS.priority);
		expect(localStorage.getItem(wishlistGiftGroupingStorageKey('wishlist-a'))).toBe(
			JSON.stringify(GIFT_GROUPING_OPTIONS.priority),
		);
		expect(localStorage.getItem('prejemesi-gift-priority-grouping')).toBeNull();
	});
});
