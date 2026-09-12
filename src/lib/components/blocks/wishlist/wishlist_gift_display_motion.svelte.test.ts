import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
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
