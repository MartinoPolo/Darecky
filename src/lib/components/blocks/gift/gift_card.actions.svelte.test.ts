import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import {
	GiftCardTestHost,
	cleanupCardHosts,
	fixedHosts,
	makeVisitorGift,
} from './gift_card.test_fixtures.js';

afterEach(cleanupCardHosts);

describe('GiftCard actions (issue #255)', () => {
	it('does not render Like for an archived visitor gift while preserving own cancellation', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift({ myReservationId: 'reservation-1' }),
				role: WISHLIST_ROLES.visitor,
				isArchived: true,
				onunreserve: () => {},
			},
			{ baseElement: host },
		);

		expect(host.querySelector('[data-like-heart]')).toBeNull();
		expect(host.querySelector('[data-testid="reserve-button"]')).toBeTruthy();
	});

	it('keeps manager reservation and received callbacks in the footer without duplicates', async () => {
		await page.viewport(800, 720);
		const onreserve = vi.fn();
		const onreceived = vi.fn();
		const host = document.createElement('div');
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
				role: WISHLIST_ROLES.moderator,
				onreserve,
				onreceived,
			},
			{ baseElement: host },
		);

		const footer = host.querySelector('[data-testid="gift-card-footer"]') as HTMLElement;
		const image = host.querySelector('[data-testid="gift-card-image-frame"]') as HTMLElement;
		const reserve = host.querySelectorAll<HTMLElement>('[data-testid="reserve-button"]');
		const received = host.querySelector(
			'[data-testid="gift-received-toggle"]',
		) as HTMLButtonElement;
		expect(reserve).toHaveLength(1);
		expect(footer.contains(reserve[0]!)).toBe(true);
		expect(image.querySelector('[data-testid="reserve-button"]')).toBeNull();
		reserve[0]!.click();
		received.click();
		expect(onreserve).toHaveBeenCalledOnce();
		expect(onreceived).toHaveBeenCalledWith('gift-1', true);

		const withoutReceivedHost = document.createElement('div');
		document.body.appendChild(withoutReceivedHost);
		fixedHosts.add(withoutReceivedHost);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift({ id: 'gift-without-received', myReservationId: null }),
				role: WISHLIST_ROLES.moderator,
				onreserve: () => {},
			},
			{ baseElement: withoutReceivedHost },
		);
		expect(withoutReceivedHost.querySelectorAll('[data-testid="reserve-button"]')).toHaveLength(
			1,
		);
	});

	it('does not host reservation release even when the context permits it', async () => {
		await render(GiftCardTestHost, {
			gift: makeVisitorGift({ myReservationId: null, isFullyReserved: true }),
			role: WISHLIST_ROLES.moderator,
			isArchived: false,
			releaseCapability: 'any',
			reservations: [
				{
					id: 'reservation-other',
					giftId: 'gift-1',
					quantity: 1,
					displayName: 'Petr',
					releasable: true,
					createdAt: new Date('2026-01-02'),
				},
			],
		});

		expect(document.querySelector('[data-testid="release-reservation-button"]')).toBeNull();
	});
});

describe('GiftCard footer alignment', () => {
	it.each([
		{ role: WISHLIST_ROLES.recipient, received: false, isArchived: false, withMore: true },
		{ role: WISHLIST_ROLES.recipient, received: true, isArchived: false, withMore: true },
		{ role: WISHLIST_ROLES.recipient, received: false, isArchived: false, withMore: false },
		{ role: WISHLIST_ROLES.recipient, received: true, isArchived: true, withMore: true },
		{ role: WISHLIST_ROLES.visitor, received: false, isArchived: true, withMore: false },
	])(
		'right-aligns $role actions (received: $received, archived: $isArchived, More: $withMore)',
		async ({ role, received, isArchived, withMore }) => {
			await page.viewport(800, 720);
			const host = document.createElement('div');
			host.style.width = '360px';
			document.body.appendChild(host);
			fixedHosts.add(host);
			await render(
				GiftCardTestHost,
				{
					gift: makeVisitorGift({ received }),
					role,
					isArchived,
					onreceived: () => {},
					onunreserve: () => {},
					onmore: withMore ? () => {} : undefined,
				},
				{ baseElement: host },
			);

			const footer = host.querySelector('[data-testid="gift-card-footer"]') as HTMLElement;
			const footerStyle = getComputedStyle(footer);
			const rightEdge =
				footer.getBoundingClientRect().right - parseFloat(footerStyle.paddingRight);
			const actions = Array.from(footer.querySelectorAll<HTMLElement>('button'));
			expect(actions.length).toBeGreaterThan(0);
			expect(
				Math.max(...actions.map((action) => action.getBoundingClientRect().right)),
			).toBeCloseTo(rightEdge, 1);
		},
	);
});
