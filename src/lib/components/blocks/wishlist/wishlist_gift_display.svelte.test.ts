import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'svelte';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { GIFT_SECTION_KINDS, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';

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

function deferredAnimation() {
	let finish!: () => void;
	const finished = new Promise<void>((resolve) => {
		finish = resolve;
	});
	return {
		animation: {
			finished,
			cancel: vi.fn(),
		} as unknown as Animation,
		finish,
	};
}

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

describe('WishlistGiftDisplay selection accessibility', () => {
	it('uses group and independently tabbable checkbox semantics', async () => {
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			selectionMode: true,
			selectedIds: ['gift-1'],
		});
		const collection = document.querySelector('[data-wishlist-gift-collection]')!;
		const gift = document.querySelector('[data-gift-item]')!;

		expect(collection.getAttribute('role')).toBe('group');
		expect(collection.hasAttribute('aria-multiselectable')).toBe(false);
		expect(gift.getAttribute('role')).toBe('checkbox');
		expect(gift.getAttribute('aria-checked')).toBe('true');
		expect(gift.getAttribute('tabindex')).toBe('0');
		await screen.unmount();
	});
});

function expectNoContextualCardActions(gift: Element) {
	expect(gift.querySelector('[data-like-heart]')).toBeNull();
	expect(gift.querySelector('[data-testid="reserve-button"]')).toBeNull();
	expect(gift.querySelector('[data-testid="gift-received-toggle"]')).toBeNull();
	expect(gift.querySelector(`[aria-label="${m.gift_more_actions()}"]`)).toBeNull();
	expect(gift.querySelector(`[aria-label="${m.gift_mark_bought()}"]`)).toBeNull();
}

function rectanglesIntersect(first: DOMRect, second: DOMRect): boolean {
	return (
		first.left < second.right &&
		first.right > second.left &&
		first.top < second.bottom &&
		first.bottom > second.top
	);
}

function expectContextualOverlayClearOf(gift: Element, controls: readonly HTMLElement[]): void {
	const overlays = gift.querySelectorAll<HTMLElement>('[data-testid="gift-state-overlay"]');
	expect(overlays).toHaveLength(1);
	const overlay = overlays[0]!;
	expect(overlay.querySelector('[data-state-primary]')?.textContent).toBe(
		m.gift_received_badge(),
	);
	expect(overlay.querySelector('[data-reservation-support]')?.textContent).toBe(
		m.gift_reserved_by_other_overlay(),
	);
	expect(overlay.textContent).not.toContain('Soukromá osoba');

	const badge = overlay.querySelector(':scope > span') as HTMLElement;
	for (const control of controls) {
		expect(
			rectanglesIntersect(badge.getBoundingClientRect(), control.getBoundingClientRect()),
		).toBe(false);
	}
}

describe('WishlistGiftDisplay contextual gift presentation', () => {
	it.each(['card', 'list'] as const)(
		'renders only the image checkbox control in selection mode for the %s path',
		async (viewMode) => {
			await page.viewport(390, 720);
			const privateGift = {
				...visitorGift(),
				received: true,
				quantity: 3,
				reservedCount: 3,
				isFullyReserved: true,
				myReservationId: null,
				reserverNames: ['Soukromá osoba'],
			};
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				sections: [{ ...sections[0]!, gifts: [privateGift] }],
				role: WISHLIST_ROLES.moderator,
				viewMode,
				selectionMode: true,
				oncontextactions: () => true,
			});
			const gift = document.querySelector('[data-gift-item]')!;
			const checkboxSurface = gift.querySelector(
				'[data-testid="gift-selection-control"]',
			) as HTMLElement;

			expect(checkboxSurface).toBeTruthy();
			expect(checkboxSurface.getBoundingClientRect().width).toBeCloseTo(40, 0);
			expect(checkboxSurface.getBoundingClientRect().height).toBeCloseTo(40, 0);
			expect(checkboxSurface.querySelector('[data-slot="checkbox"]')).toBeNull();
			const imageRegion = gift.querySelector(
				viewMode === 'card'
					? '[data-testid="gift-card-image-frame"]'
					: '[data-testid="gift-list-image"]',
			) as HTMLElement;
			const checkboxRect = checkboxSurface.getBoundingClientRect();
			const imageRect = imageRegion.getBoundingClientRect();
			const giftRect = gift.getBoundingClientRect();
			expect(checkboxRect.top).toBeGreaterThanOrEqual(giftRect.top + 4 - 0.5);
			expect(checkboxRect.right).toBeLessThanOrEqual(giftRect.right - 4 + 0.5);
			expect(checkboxRect.right).toBeLessThanOrEqual(imageRect.right);
			expect(checkboxRect.bottom).toBeLessThan(imageRect.bottom);
			expectNoContextualCardActions(gift);
			expectContextualOverlayClearOf(gift, [checkboxSurface]);
			expect(gift.querySelectorAll('button, a, input, textarea, select')).toHaveLength(0);
			await screen.unmount();
		},
	);

	it.each([
		{ viewMode: 'card' as const, directionalControlsVisible: false },
		{ viewMode: 'list' as const, directionalControlsVisible: true },
	])(
		'renders layout-aware reorder controls in the $viewMode path',
		async ({ viewMode, directionalControlsVisible }) => {
			await page.viewport(390, 720);
			const privateGift = {
				...visitorGift(),
				received: true,
				quantity: 3,
				reservedCount: 3,
				isFullyReserved: true,
				myReservationId: null,
				reserverNames: ['Soukromá osoba'],
			};
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				sections: [{ ...sections[0]!, gifts: [privateGift] }],
				role: WISHLIST_ROLES.moderator,
				viewMode,
				reorderMode: true,
				oncontextactions: () => true,
			});
			const gift = document.querySelector('[data-gift-item]')!;
			const grip = gift.querySelector(
				`button[aria-label="${m.gift_reorder_grip_label()}"]`,
			) as HTMLButtonElement;
			const moveUp = gift.querySelector(
				`button[aria-label="${m.gift_reorder_move_up({ name: privateGift.name })}"]`,
			) as HTMLButtonElement;
			const moveDown = gift.querySelector(
				`button[aria-label="${m.gift_reorder_move_down({ name: privateGift.name })}"]`,
			) as HTMLButtonElement;

			expect(grip).toBeTruthy();
			expect(grip.getBoundingClientRect().width).toBeCloseTo(60, 0);
			expect(grip.getBoundingClientRect().height).toBeCloseTo(60, 0);
			expect(moveUp).toBeTruthy();
			expect(moveDown).toBeTruthy();
			const directionalActions = moveUp.parentElement as HTMLElement;
			expect(getComputedStyle(directionalActions).display === 'none').toBe(
				!directionalControlsVisible,
			);
			if (directionalControlsVisible) {
				expect(moveUp.getBoundingClientRect().width).toBeCloseTo(40, 0);
				expect(moveUp.getBoundingClientRect().height).toBeCloseTo(40, 0);
				expect(moveDown.getBoundingClientRect().width).toBeCloseTo(40, 0);
				expect(moveDown.getBoundingClientRect().height).toBeCloseTo(40, 0);
				expect(moveUp.disabled).toBe(true);
				expect(moveDown.disabled).toBe(true);
			}
			expectNoContextualCardActions(gift);
			const gripSurface = grip.firstElementChild as HTMLElement;
			expect(gripSurface.getBoundingClientRect().width).toBeCloseTo(40, 0);
			expect(gripSurface.getBoundingClientRect().height).toBeCloseTo(40, 0);
			expectContextualOverlayClearOf(
				gift,
				directionalControlsVisible ? [gripSurface, moveUp, moveDown] : [gripSurface],
			);
			const visibleInteractiveElements = Array.from(
				gift.querySelectorAll<HTMLElement>('button, a, input, textarea, select'),
			).filter((element) => element.getClientRects().length > 0);
			expect(visibleInteractiveElements).toHaveLength(directionalControlsVisible ? 3 : 1);
			await screen.unmount();
		},
	);
});

describe('WishlistGiftDisplay recipient privacy structure (issue #336)', () => {
	it.each(['card', 'list'] as const)(
		'keeps reserved and unreserved recipient %s presentations structurally and geometrically identical',
		async (viewMode) => {
			await page.viewport(390, 720);
			const capture = async (gift: GiftForVisitor) => {
				const screen = await render(WishlistGiftDisplay, {
					...defaultProps,
					sections: [{ ...sections[0]!, gifts: [gift] }],
					role: WISHLIST_ROLES.recipient,
					viewMode,
				});
				const item = document.querySelector('[data-gift-item]') as HTMLElement;
				const snapshot = {
					html: item.innerHTML,
					width: item.getBoundingClientRect().width,
					height: item.getBoundingClientRect().height,
					text: item.textContent ?? '',
				};
				await screen.unmount();
				return snapshot;
			};
			const available = await capture(visitorGift());
			const privatelyReserved = await capture({
				...visitorGift(),
				reservedCount: 1,
				isFullyReserved: true,
				myReservationId: 'private-reservation',
				myReservationPurchasedAt: new Date('2026-01-03'),
				reserverNames: ['Soukromá osoba'],
				likeCount: 9,
			});

			expect(privatelyReserved.html).toBe(available.html);
			expect(privatelyReserved.width).toBeCloseTo(available.width, 0);
			expect(privatelyReserved.height).toBeCloseTo(available.height, 0);
			expect(privatelyReserved.text).not.toMatch(/rezerv|koupen|Soukromá osoba|9/i);
		},
	);
});

describe('WishlistGiftDisplay primary-link middle click wiring', () => {
	it.each(['card', 'list'] as const)(
		'opens the real primary link from the %s view on middle-click',
		async (viewMode) => {
			const open = vi.spyOn(window, 'open').mockImplementation(() => null);
			const giftWithPrimaryLink: GiftForVisitor = {
				...visitorGift(),
				links: [{ url: 'https://example.com/gift' }],
			};
			const linkedSections: GiftSection[] = [
				{
					...sections[0]!,
					gifts: [giftWithPrimaryLink],
				},
			];
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				sections: linkedSections,
				viewMode,
			});
			const wrapper = document.querySelector('[data-gift-item]') as HTMLElement;

			wrapper.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));

			expect(open).toHaveBeenCalledWith(
				'https://example.com/gift',
				'_blank',
				'noopener,noreferrer',
			);
			await screen.unmount();
		},
	);
});

describe('WishlistGiftDisplay keyboard reorder announcements', () => {
	it.each(['card', 'list'] as const)(
		'announces successful moves but not boundary no-ops in %s view',
		async (viewMode) => {
			const first = visitorGift();
			const second = { ...visitorGift(), id: 'gift-2', name: 'Kávovar', sortOrder: 1 };
			const reorderSections: GiftSection[] = [{ ...sections[0]!, gifts: [first, second] }];
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				sections: reorderSections,
				viewMode,
				reorderMode: true,
			});
			const grips = screen.getByRole('button', { name: m.gift_reorder_grip_label() }).all();

			grips[0]!.element().focus();
			await userEvent.keyboard('{ArrowDown}');
			await expect
				.element(screen.getByRole('status'))
				.toHaveTextContent(
					m.gift_reorder_move_success({ name: first.name, position: 2, total: 2 }),
				);
			await screen.unmount();

			const boundaryScreen = await render(WishlistGiftDisplay, {
				...defaultProps,
				sections: reorderSections,
				viewMode,
				reorderMode: true,
			});
			const boundaryGrips = boundaryScreen
				.getByRole('button', { name: m.gift_reorder_grip_label() })
				.all();
			boundaryGrips[1]!.element().focus();
			await userEvent.keyboard('{ArrowDown}');
			await expect.element(boundaryScreen.getByRole('status')).toHaveTextContent('');
			await boundaryScreen.unmount();
		},
	);

	it.each(['card', 'list'] as const)(
		'does not announce a keyboard move rejected during a pointer reorder in %s view',
		async (viewMode) => {
			const first = visitorGift();
			const second = { ...visitorGift(), id: 'gift-2', name: 'Kávovar', sortOrder: 1 };
			const screen = await render(WishlistGiftDisplay, {
				...defaultProps,
				sections: [{ ...sections[0]!, gifts: [first, second] }],
				viewMode,
				reorderMode: true,
			});
			const grip = screen
				.getByRole('button', { name: m.gift_reorder_grip_label() })
				.all()[0]!
				.element();

			grip.dispatchEvent(
				new PointerEvent('pointerdown', {
					bubbles: true,
					button: 0,
					pointerId: 1,
					pointerType: 'mouse',
				}),
			);
			grip.focus();
			await userEvent.keyboard('{ArrowDown}');

			await expect.element(screen.getByRole('status')).toHaveTextContent('');
			await screen.unmount();
		},
	);
});

describe('WishlistGiftDisplay collection transition', () => {
	it('immediately removes the outgoing collection from interaction and the accessibility tree', async () => {
		const exit = deferredAnimation();
		const enter = deferredAnimation();
		vi.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValueOnce(exit.animation)
			.mockReturnValueOnce(enter.animation);
		const oncontextactions = vi.fn(() => true);
		const screen = await render(WishlistGiftDisplay, {
			...defaultProps,
			hascontextactions: () => true,
			oncontextactions,
		});
		const collection = document.querySelector<HTMLElement>('[data-wishlist-gift-collection]')!;
		const outgoingMore = collection.querySelector<HTMLButtonElement>(
			'[data-testid="gift-more-actions"]',
		)!;

		await screen.rerender({
			...defaultProps,
			viewMode: 'list',
			hascontextactions: () => true,
			oncontextactions,
		});

		expect(collection.dataset.viewMode).toBe('card');
		expect(collection.hasAttribute('inert')).toBe(true);
		expect(collection.getAttribute('aria-hidden')).toBe('true');
		outgoingMore.focus();
		expect(document.activeElement).not.toBe(outgoingMore);
		const moreRect = outgoingMore.getBoundingClientRect();
		const pointerTarget = document.elementFromPoint(
			moreRect.left + moreRect.width / 2,
			moreRect.top + moreRect.height / 2,
		);
		expect(collection.contains(pointerTarget)).toBe(false);
		expect(oncontextactions).not.toHaveBeenCalled();

		exit.finish();
		await vi.waitFor(() => expect(collection.dataset.viewMode).toBe('list'));
		expect(collection.hasAttribute('inert')).toBe(false);
		expect(collection.hasAttribute('aria-hidden')).toBe(false);
		const incomingMore = collection.querySelector<HTMLButtonElement>(
			'[data-testid="gift-more-actions"]',
		)!;
		incomingMore.focus();
		expect(document.activeElement).toBe(incomingMore);

		enter.finish();
		await screen.unmount();
	});

	it('fades the retained collection out before replacing geometry, then settles the whole collection in', async () => {
		const exit = deferredAnimation();
		const enter = deferredAnimation();
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValueOnce(exit.animation)
			.mockReturnValueOnce(enter.animation);
		const screen = await render(WishlistGiftDisplay, defaultProps);
		const collection = document.querySelector<HTMLElement>('[data-wishlist-gift-collection]')!;

		await screen.rerender({ ...defaultProps, viewMode: 'list' });

		expect(collection.dataset.viewMode).toBe('card');
		expect(animate.mock.calls[0]).toEqual([
			[{ opacity: 1 }, { opacity: 0 }],
			{ duration: 160, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' },
		]);

		exit.finish();
		await vi.waitFor(() => expect(collection.dataset.viewMode).toBe('list'));
		await vi.waitFor(() => expect(animate).toHaveBeenCalledTimes(2));

		expect(animate.mock.calls[1]).toEqual([
			[
				{ opacity: 0, transform: 'translateY(3px)' },
				{ opacity: 1, transform: 'none' },
			],
			{ duration: 280, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' },
		]);

		enter.finish();
		await screen.unmount();
	});

	it('cancels a stale handoff and leaves the latest rapidly requested mode rendered', async () => {
		const staleExit = deferredAnimation();
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValue(staleExit.animation);
		const screen = await render(WishlistGiftDisplay, defaultProps);
		const collection = document.querySelector<HTMLElement>('[data-wishlist-gift-collection]')!;

		await screen.rerender({ ...defaultProps, viewMode: 'list' });
		expect(animate).toHaveBeenCalledOnce();
		expect(collection.hasAttribute('inert')).toBe(true);
		expect(collection.getAttribute('aria-hidden')).toBe('true');
		await screen.rerender({ ...defaultProps, viewMode: 'card' });

		expect(staleExit.animation.cancel).toHaveBeenCalledOnce();
		expect(collection.dataset.viewMode).toBe('card');
		expect(collection.hasAttribute('inert')).toBe(false);
		expect(collection.hasAttribute('aria-hidden')).toBe(false);
		await screen.unmount();
	});

	it('swaps immediately without transforms when reduced motion is requested', async () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({
			matches: true,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		} as unknown as MediaQueryList);
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		const screen = await render(WishlistGiftDisplay, defaultProps);
		const collection = document.querySelector<HTMLElement>('[data-wishlist-gift-collection]')!;

		await screen.rerender({ ...defaultProps, viewMode: 'list' });

		expect(collection.dataset.viewMode).toBe('list');
		expect(collection.style.transform).toBe('');
		expect(animate).not.toHaveBeenCalled();
		await screen.unmount();
	});

	it('keeps transitions into and out of compact mode immediate', async () => {
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		const screen = await render(WishlistGiftDisplay, defaultProps);
		const collection = document.querySelector<HTMLElement>('[data-wishlist-gift-collection]')!;

		await screen.rerender({ ...defaultProps, viewMode: 'compact' });
		expect(collection.dataset.viewMode).toBe('compact');
		await screen.rerender({ ...defaultProps, viewMode: 'list' });

		expect(collection.dataset.viewMode).toBe('list');
		expect(animate).not.toHaveBeenCalled();
		await screen.unmount();
	});

	it('cancels collection animation and leaves no inline motion styles on teardown', async () => {
		const pending = deferredAnimation();
		vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(pending.animation);
		const screen = await render(WishlistGiftDisplay, defaultProps);
		const collection = document.querySelector<HTMLElement>('[data-wishlist-gift-collection]')!;

		await screen.rerender({ ...defaultProps, viewMode: 'list' });
		await screen.unmount();

		expect(pending.animation.cancel).toHaveBeenCalledOnce();
		expect(collection.getAttribute('style')).toBeNull();
	});
});
