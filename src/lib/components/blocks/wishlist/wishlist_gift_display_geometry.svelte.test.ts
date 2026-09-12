import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'svelte';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { GIFT_SECTION_KINDS, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: WishlistGiftDisplay } = await import('./WishlistGiftDisplay.svelte');

function visitorGift(): GiftForVisitor {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: 'Stolní lampa',
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
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
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

const sections: GiftSection[] = [
	{
		kind: GIFT_SECTION_KINDS.available,
		key: 'available',
		label: null,
		gifts: [visitorGift()],
	},
];

const defaultProps: ComponentProps<typeof WishlistGiftDisplay> = {
	sections,
	role: WISHLIST_ROLES.recipient,
	isArchived: false,
	hideReservationState: false,
	viewMode: 'card',
	isEmpty: false,
	isFilteredEmpty: false,
	reorderMode: false,
	onedit: () => {},
	onreserve: () => {},
	onunreserve: () => {},
	onreceived: () => {},
	onaddgift: () => {},
	onclearfilters: () => {},
	onreorderpreview: () => {},
	onreordercommit: () => {},
	onreordercancel: () => {},
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe('WishlistGiftDisplay mobile collection geometry (issue #336)', () => {
	it.each([
		{
			kind: GIFT_SECTION_KINDS.priorityGroup,
			key: 'priority:high',
			label: 'Vysoká priorita',
			priorityKey: null,
		},
		{
			kind: GIFT_SECTION_KINDS.categoryGroup,
			key: 'category:kitchen',
			label: 'Kuchyně',
			priorityKey: null,
		},
	])('keeps a short $kind heading close to its first card on mobile', async (section) => {
		await page.viewport(390, 720);
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections: [{ ...section, gifts: [visitorGift()] }],
			viewMode: 'card',
		});
		const heading = screen.getByRole('heading', { name: section.label }).element();
		const card = document.querySelector<HTMLElement>('[data-gift-item]')!;
		const gap = card.getBoundingClientRect().top - heading.getBoundingClientRect().bottom;

		expect(gap).toBeGreaterThanOrEqual(8);
		expect(gap).toBeLessThanOrEqual(12);
		await screen.unmount();
	});

	it('uses one card column at 320px and exactly two equal columns from 321px through 639px', async () => {
		const second = { ...visitorGift(), id: 'gift-2', name: 'Kávovar' };
		const responsiveSections = [{ ...sections[0]!, gifts: [visitorGift(), second] }];
		await page.viewport(320, 720);
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections: responsiveSections,
			viewMode: 'card',
		});
		let cards = Array.from(document.querySelectorAll<HTMLElement>('[data-gift-item]'));
		expect(cards[1]!.getBoundingClientRect().top).toBeGreaterThan(
			cards[0]!.getBoundingClientRect().top,
		);

		await page.viewport(321, 720);
		cards = Array.from(document.querySelectorAll<HTMLElement>('[data-gift-item]'));
		const firstRect = cards[0]!.getBoundingClientRect();
		const secondRect = cards[1]!.getBoundingClientRect();
		expect(secondRect.top).toBeCloseTo(firstRect.top, 0);
		expect(secondRect.width).toBeCloseTo(firstRect.width, 0);
		expect(secondRect.left - firstRect.right).toBeCloseTo(8, 0);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(321);

		await page.viewport(639, 720);
		cards = Array.from(document.querySelectorAll<HTMLElement>('[data-gift-item]'));
		const firstAt639 = cards[0]!.getBoundingClientRect();
		const secondAt639 = cards[1]!.getBoundingClientRect();
		expect(secondAt639.top).toBeCloseTo(firstAt639.top, 0);
		expect(secondAt639.width).toBeCloseTo(firstAt639.width, 0);
		expect(secondAt639.left - firstAt639.right).toBeCloseTo(8, 0);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(639);
		await screen.unmount();
	});

	it('uses adaptive minmax columns at every desktop and tablet acceptance width', async () => {
		const gifts = Array.from({ length: 6 }, (_, index) => ({
			...visitorGift(),
			id: `gift-${index + 1}`,
			name: `Dárek ${index + 1}`,
		}));

		for (const { viewportWidth, collectionWidth } of [
			{ viewportWidth: 640, collectionWidth: 560 },
			{ viewportWidth: 768, collectionWidth: 688 },
			{ viewportWidth: 1024, collectionWidth: 944 },
			{ viewportWidth: 1280, collectionWidth: 1152 },
		]) {
			await page.viewport(viewportWidth, 900);
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				sections: [{ ...sections[0]!, gifts }],
				viewMode: 'card',
			});
			const collection = document.querySelector<HTMLElement>(
				'[data-wishlist-gift-collection]',
			)!;
			collection.style.width = `${collectionWidth}px`;
			const grid = collection.querySelector<HTMLElement>(
				'[data-testid="wishlist-gift-card-grid"]',
			)!;
			const columns = getComputedStyle(grid).gridTemplateColumns.split(' ');
			const expectedColumnCount = Math.floor((collectionWidth + 20) / 300);

			expect(columns).toHaveLength(expectedColumnCount);
			for (const column of columns) {
				expect(parseFloat(column)).toBeGreaterThanOrEqual(280);
			}
			await screen.unmount();
		}
	});

	it('keeps the collection edges exact and leaves card paint unclipped', async () => {
		const gifts = Array.from({ length: 4 }, (_, index) => ({
			...visitorGift(),
			id: `gift-${index + 1}`,
			name: `Dárek ${index + 1}`,
		}));

		for (const { viewportWidth, collectionWidth } of [
			{ viewportWidth: 390, collectionWidth: 390 },
			{ viewportWidth: 639, collectionWidth: 639 },
			{ viewportWidth: 640, collectionWidth: 560 },
			{ viewportWidth: 768, collectionWidth: 688 },
			{ viewportWidth: 1280, collectionWidth: 1152 },
		]) {
			await page.viewport(viewportWidth, 900);
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				sections: [{ ...sections[0]!, gifts }],
				viewMode: 'card',
				selectionMode: true,
				selectedIds: ['gift-4'],
			});
			const collection = document.querySelector<HTMLElement>(
				'[data-wishlist-gift-collection]',
			)!;
			collection.style.width = `${collectionWidth}px`;
			const grid = collection.querySelector<HTMLElement>(
				'[data-testid="wishlist-gift-card-grid"]',
			)!;
			const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-gift-item]'));
			const gridRect = grid.getBoundingClientRect();
			const cardRects = cards.map((card) => card.getBoundingClientRect());
			const rightmostEdge = Math.max(...cardRects.map((rect) => rect.right));
			const bottomEdge = Math.max(...cardRects.map((rect) => rect.bottom));

			expect(gridRect.right - rightmostEdge).toBeCloseTo(0, 0);
			expect(gridRect.bottom - bottomEdge).toBeCloseTo(0, 0);
			expect(getComputedStyle(grid).overflowX).toBe('visible');
			expect(getComputedStyle(grid).overflowY).toBe('visible');
			expect(getComputedStyle(collection).zIndex).toBe('0');
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(viewportWidth);
			await screen.unmount();
		}
	});

	it('uses standalone equal-height list cards with full-height square images and a 10px gap', async () => {
		await page.viewport(390, 720);
		const second = { ...visitorGift(), id: 'gift-2', name: 'Kávovar' };
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			sections: [{ ...sections[0]!, gifts: [visitorGift(), second] }],
			viewMode: 'list',
		});
		const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-gift-item]'));
		const cardRects = cards.map((card) => card.getBoundingClientRect());
		const imageRects = cards.map((card) =>
			(
				card.querySelector('[data-testid="gift-list-image"]') as HTMLElement
			).getBoundingClientRect(),
		);
		expect(cardRects[1]!.height).toBeCloseTo(cardRects[0]!.height, 0);
		for (const [index, imageRect] of imageRects.entries()) {
			expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
			expect(imageRect.height).toBeCloseTo(cardRects[index]!.height - 4, 0);
		}
		expect(cardRects[1]!.top - cardRects[0]!.bottom).toBeCloseTo(10, 0);
		await screen.unmount();
	});
});
