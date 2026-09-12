import '../../../../app.css';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import {
	IMAGE_URL,
	imageMeta,
	makeVisitorGift,
	renderItem,
	rectanglesIntersect,
	hasVisibleBoxShadow,
	GiftListItemTestHost,
} from './gift_list_item.test_fixtures.js';

describe('GiftListItem responsive image dimensions (issues #328 and #336)', () => {
	it('removes only the mobile Fit padding while keeping the image frame edge-to-edge', async () => {
		await page.viewport(390, 720);
		const host = await renderItem(
			makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta('#ffffff') }),
			WISHLIST_ROLES.visitor,
		);
		const image = host.querySelector('img') as HTMLImageElement;
		const frame = host.querySelector('[data-testid="image-frame"]') as HTMLElement;
		const imageRegion = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;

		expect(getComputedStyle(image).padding).toBe('0px');
		expect(frame.getBoundingClientRect().width).toBeCloseTo(imageRegion.clientWidth, 0);
		expect(frame.getBoundingClientRect().height).toBeCloseTo(imageRegion.clientHeight, 0);
		await page.viewport(800, 720);
		expect(getComputedStyle(image).padding).toBe('8px');
		host.remove();
	});

	it('keeps the desktop image square when the responsive size grows', async () => {
		await page.viewport(800, 720);
		const host = await renderItem(makeVisitorGift(), WISHLIST_ROLES.visitor);
		const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		const imageRect = image.getBoundingClientRect();

		expect(imageRect.width).toBeGreaterThanOrEqual(128);
		expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
	});

	it('renders one auto-height row with a full responsive square image and consolidated state overlay', async () => {
		await page.viewport(390, 720);
		const host = await renderItem(
			makeVisitorGift({ isFullyReserved: true, myReservationId: null }),
			WISHLIST_ROLES.visitor,
		);
		const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
		const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;

		const itemRect = item.getBoundingClientRect();
		const imageRect = image.getBoundingClientRect();
		expect(imageRect.width).toBeGreaterThanOrEqual(144);
		expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
		expect(itemRect.height).toBeGreaterThanOrEqual(imageRect.height);
		expect(host.querySelectorAll('[data-testid="gift-state-overlay"]')).toHaveLength(1);
		expect(host.querySelector('[data-testid="gift-reserved-sticker"]')).toBeNull();
	});

	it('keeps manager actions compact in a horizontal mobile list row, outside the image', async () => {
		await page.viewport(390, 720);
		const onreserve = vi.fn();
		const onreceived = vi.fn();
		const onmore = vi.fn();
		const host = document.createElement('div');
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
				role: WISHLIST_ROLES.moderator,
				isArchived: false,
				onreserve,
				onreceived,
				onmore,
			},
			{ baseElement: host },
		);

		const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
		const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		const content = host.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
		const received = host.querySelector('[data-testid="gift-received-toggle"]') as HTMLElement;
		const more = host.querySelector(`[aria-label="${m.gift_more_actions()}"]`) as HTMLElement;
		const reserveButtons = host.querySelectorAll<HTMLElement>('[data-testid="reserve-button"]');
		const reserve = reserveButtons[0]!;
		expect(reserveButtons).toHaveLength(1);
		expect(image.querySelector('[data-testid="reserve-button"]')).toBeNull();
		expect(content.contains(reserve)).toBe(true);
		expect(getComputedStyle(item).display).toBe('grid');
		expect(content.getBoundingClientRect().left).toBeCloseTo(
			image.getBoundingClientRect().right,
			0,
		);
		for (const action of [reserve, received, more]) {
			expect(action.getBoundingClientRect().height).toBeCloseTo(32, 0);
		}
		reserve.click();
		received.click();
		more.click();
		expect(onreserve).toHaveBeenCalledOnce();
		expect(onreceived).toHaveBeenCalledWith('gift-1', true);
		expect(onmore).toHaveBeenCalledOnce();

		const withoutReceivedHost = document.createElement('div');
		document.body.appendChild(withoutReceivedHost);
		await render(
			GiftListItemTestHost,
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
		expect(
			withoutReceivedHost
				.querySelector('[data-testid="gift-list-image"]')
				?.querySelector('[data-testid="reserve-button"]'),
		).toBeNull();
		host.remove();
		withoutReceivedHost.remove();
	});

	it('does not render Like for an archived visitor gift while preserving own cancellation', async () => {
		await page.viewport(390, 720);
		const host = document.createElement('div');
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
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

	it('leaves no reservation, Like, or Purchased trace for recipients', async () => {
		await page.viewport(390, 720);
		const host = await renderItem(
			makeVisitorGift({
				isFullyReserved: true,
				myReservationId: 'private-reservation',
				myReservationPurchasedAt: new Date('2026-01-03'),
				reserverNames: ['Soukromá osoba'],
			}),
			WISHLIST_ROLES.recipient,
		);

		expect(host.querySelector('[data-testid="gift-state-overlay"]')).toBeNull();
		expect(host.querySelector('[aria-pressed]')).toBeNull();
		expect(host.textContent).not.toMatch(/rezerv|koupen|Soukromá osoba/i);
	});
});

describe('GiftListItem approved Like geometry (issue #357)', () => {
	it.each([
		{ viewport: 390, count: 0 },
		{ viewport: 800, count: 7 },
		{ viewport: 1440, count: 123 },
	])(
		'keeps count $count beside the ghost heart at the full-item top-right at $viewport px',
		async ({ viewport, count }) => {
			await page.viewport(viewport, 720);
			const host = await renderItem(
				makeVisitorGift({
					likeCount: count,
					received: true,
					isFullyReserved: true,
					myReservationId: 'mine',
				}),
				WISHLIST_ROLES.visitor,
			);
			const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
			const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
			const content = host.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
			const title = content.querySelector('.gift-list-title') as HTMLElement;
			const like = host.querySelector('[data-like-heart]')?.closest('button') as HTMLElement;
			const heart = like.querySelector('[data-like-heart]') as HTMLElement;
			const countNode = like.querySelector('[data-like-count]') as HTMLElement;
			const imageRect = image.getBoundingClientRect();
			const itemRect = item.getBoundingClientRect();
			const likeRect = like.getBoundingClientRect();

			expect(item.contains(like)).toBe(true);
			expect(image.contains(like)).toBe(false);
			expect(content.contains(like)).toBe(false);
			expect(content.contains(title)).toBe(true);
			expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
			expect(likeRect.top).toBeLessThan(imageRect.top + imageRect.height / 2);
			expect(likeRect.right).toBeLessThanOrEqual(itemRect.right);
			expect(likeRect.top - itemRect.top).toBeCloseTo(itemRect.right - likeRect.right, 1);
			expect(countNode.textContent).toBe(String(count));
			expect(getComputedStyle(countNode).display).not.toBe('none');
			expect(heart.getBoundingClientRect().right).toBeLessThanOrEqual(
				countNode.getBoundingClientRect().left,
			);
			expect(hasVisibleBoxShadow(like.querySelector('.elevation-surface')!)).toBe(false);
			for (const pill of host.querySelectorAll<HTMLElement>(
				'[data-testid="gift-state-overlay"] > span',
			)) {
				for (const likePart of like.querySelectorAll<HTMLElement>(
					'[data-like-heart], [data-like-count]',
				)) {
					expect(
						rectanglesIntersect(
							likePart.getBoundingClientRect(),
							pill.getBoundingClientRect(),
						),
					).toBe(false);
				}
			}
			host.remove();
		},
	);
});
