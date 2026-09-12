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
