import '../../../../app.css';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';
import {
	REALISTIC_LONG_NAME,
	makeVisitorGift,
	firstNonBlankTextNode,
	expectRaisedActionShadowInside,
	GiftListItemTestHost,
} from './gift_list_item.test_fixtures.js';

describe('GiftListItem approved action geometry (issue #350)', () => {
	it.each([
		{
			viewport: 430,
			role: WISHLIST_ROLES.visitor,
			name: 'Myš',
		},
		{
			viewport: 430,
			role: WISHLIST_ROLES.recipient,
			name: REALISTIC_LONG_NAME,
		},
		{
			viewport: 500,
			role: WISHLIST_ROLES.moderator,
			name: REALISTIC_LONG_NAME,
		},
	])(
		'shows description and contains compact actions near mobile width for $role with title variant',
		async ({ viewport, role, name }) => {
			await page.viewport(viewport, 900);
			const host = document.createElement('div');
			host.style.width = `${viewport - 24}px`;
			document.body.appendChild(host);
			await render(
				GiftListItemTestHost,
				{
					gift: makeVisitorGift({
						name,
						description: 'Lehká myš pro pohodlné každodenní používání.',
						myReservationId: role === WISHLIST_ROLES.visitor ? null : 'mine',
						reservedCount: role === WISHLIST_ROLES.visitor ? 0 : 1,
					}),
					role,
					onreceived: () => {},
					onreserve: () => {},
					onunreserve: () => {},
					onmore: () => {},
				},
				{ baseElement: host },
			);

			const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
			const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
			const description = host.querySelector('.gift-list-description') as HTMLElement;
			const itemRect = item.getBoundingClientRect();
			const descriptionRect = description.getBoundingClientRect();
			expect(getComputedStyle(description).display).not.toBe('none');
			expect(descriptionRect.top).toBeGreaterThanOrEqual(itemRect.top);
			expect(descriptionRect.bottom).toBeLessThanOrEqual(itemRect.bottom);
			expect(image.getBoundingClientRect().width).toBeCloseTo(
				image.getBoundingClientRect().height,
				0,
			);
			expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth);
			expect(item.scrollHeight).toBeLessThanOrEqual(item.clientHeight);
			for (const action of host.querySelectorAll<HTMLElement>(
				'[data-testid="gift-list-actions"] button',
			)) {
				const actionRect = action.getBoundingClientRect();
				expect(actionRect.height).toBeCloseTo(32, 0);
				expect(actionRect.left).toBeGreaterThanOrEqual(itemRect.left);
				expect(actionRect.right).toBeLessThanOrEqual(itemRect.right);
				expect(actionRect.bottom).toBeLessThanOrEqual(itemRect.bottom);
			}
			host.remove();
		},
	);

	it('keeps Reserve alone above the grouped Received and More actions on mobile', async () => {
		await page.viewport(390, 900);
		const host = document.createElement('div');
		host.style.width = '366px';
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
				role: WISHLIST_ROLES.moderator,
				onreceived: () => {},
				onreserve: () => {},
				onmore: () => {},
			},
			{ baseElement: host },
		);

		const row = host.querySelector('[data-testid="gift-action-row"]') as HTMLElement;
		const reserve = row.querySelector('[data-testid="reserve-button"]') as HTMLElement;
		const received = row.querySelector('[data-testid="gift-received-toggle"]') as HTMLElement;
		const more = row.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
		const rowRect = row.getBoundingClientRect();
		const reserveRect = reserve.getBoundingClientRect();
		const receivedRect = received.getBoundingClientRect();
		const moreRect = more.getBoundingClientRect();

		expect(reserveRect.bottom).toBeLessThanOrEqual(receivedRect.top);
		expect(receivedRect.top).toBeCloseTo(moreRect.top, 0);
		expect(receivedRect.bottom).toBeCloseTo(moreRect.bottom, 0);
		expect(reserveRect.right).toBeCloseTo(rowRect.right, 0);
		expect(moreRect.right).toBeCloseTo(rowRect.right, 0);
		expect(reserveRect.width).toBeLessThan(rowRect.width);
		expect(receivedRect.width).toBeLessThan(rowRect.width);
		host.remove();
	});

	it('keeps Reserve, Received, and More in one right-aligned desktop row', async () => {
		await page.viewport(768, 900);
		const host = document.createElement('div');
		host.style.width = '720px';
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
				role: WISHLIST_ROLES.moderator,
				onreceived: () => {},
				onreserve: () => {},
				onmore: () => {},
			},
			{ baseElement: host },
		);

		const row = host.querySelector('[data-testid="gift-action-row"]') as HTMLElement;
		const reserve = row.querySelector('[data-testid="reserve-button"]') as HTMLElement;
		const received = row.querySelector('[data-testid="gift-received-toggle"]') as HTMLElement;
		const more = row.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
		const rowRect = row.getBoundingClientRect();
		const reserveRect = reserve.getBoundingClientRect();
		const receivedRect = received.getBoundingClientRect();
		const moreRect = more.getBoundingClientRect();

		expect(reserveRect.top).toBeCloseTo(receivedRect.top, 0);
		expect(receivedRect.top).toBeCloseTo(moreRect.top, 0);
		expect(reserveRect.right).toBeLessThanOrEqual(receivedRect.left);
		expect(receivedRect.right).toBeLessThanOrEqual(moreRect.left);
		expect(moreRect.right).toBeCloseTo(rowRect.right, 0);
		host.remove();
	});

	it.each([
		{ viewport: 320, role: WISHLIST_ROLES.visitor, reservationId: null },
		{ viewport: 390, role: WISHLIST_ROLES.visitor, reservationId: 'mine' },
		{ viewport: 768, role: WISHLIST_ROLES.recipient, reservationId: null },
		{ viewport: 1440, role: WISHLIST_ROLES.moderator, reservationId: null },
	])(
		'contains equal-height primary and More actions at $viewport px for $role',
		async ({ viewport, role, reservationId }) => {
			await page.viewport(viewport, 900);
			const host = document.createElement('div');
			host.style.width = `${Math.min(viewport - 24, 720)}px`;
			document.body.appendChild(host);
			await render(
				GiftListItemTestHost,
				{
					gift: makeVisitorGift({
						myReservationId: reservationId,
						reservedCount: reservationId === null ? 0 : 1,
						isFullyReserved: reservationId !== null,
					}),
					role,
					onreceived: () => {},
					onreserve: () => {},
					onunreserve: () => {},
					onmore: () => {},
				},
				{ baseElement: host },
			);

			const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
			const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
			const content = host.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
			const row = host.querySelector('[data-testid="gift-action-row"]') as HTMLElement;
			const more = row.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
			const primary = row.querySelector(
				'[data-testid="gift-received-toggle"], [data-testid="reserve-button"]',
			) as HTMLElement;
			const expectedControlSize = 32;
			const actions = Array.from(row.querySelectorAll<HTMLElement>('button'));
			expect(primary).toBeTruthy();
			expect(more).toBeTruthy();
			const contentRect = content.getBoundingClientRect();
			for (const action of actions) {
				const actionRect = action.getBoundingClientRect();
				expect(actionRect.height).toBeCloseTo(expectedControlSize, 0);
				expect(actionRect.left).toBeGreaterThanOrEqual(contentRect.left);
				expect(actionRect.right).toBeLessThanOrEqual(contentRect.right);
			}
			const primaryRect = primary.getBoundingClientRect();
			const moreRect = more.getBoundingClientRect();
			if (primaryRect.top === moreRect.top) {
				expect(primaryRect.right).toBeLessThanOrEqual(moreRect.left);
			} else {
				expect(primaryRect.bottom).toBeLessThanOrEqual(moreRect.top);
				expect(primaryRect.right).toBeCloseTo(row.getBoundingClientRect().right, 0);
				expect(moreRect.right).toBeCloseTo(row.getBoundingClientRect().right, 0);
			}
			const surface = primary.querySelector(':scope > .elevation-surface') as HTMLElement;
			const textRange = document.createRange();
			textRange.selectNodeContents(firstNonBlankTextNode(surface));
			const textRect = textRange.getBoundingClientRect();
			const surfaceRect = surface.getBoundingClientRect();
			expect(textRect.left).toBeGreaterThanOrEqual(surfaceRect.left + 2);
			expect(textRect.right).toBeLessThanOrEqual(surfaceRect.right - 2);
			expectRaisedActionShadowInside(primary, item);
			expectRaisedActionShadowInside(more, item);
			if (viewport < 640) {
				const itemRect = item.getBoundingClientRect();
				const imageRect = image.getBoundingClientRect();
				expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
				expect(content.getBoundingClientRect().left - imageRect.left).toBeCloseTo(
					imageRect.width,
					0,
				);
				expect(imageRect.top).toBeCloseTo(itemRect.top + 2, 0);
				expect(imageRect.bottom).toBeLessThanOrEqual(itemRect.bottom - 2);
				const imageFrame = image.querySelector(
					'[data-testid="image-frame"]',
				) as HTMLElement;
				expect(getComputedStyle(item).borderTopLeftRadius).toBe('16px');
				expect(getComputedStyle(imageFrame).borderTopLeftRadius).toBe('14px');
			}
			if (role === WISHLIST_ROLES.moderator) {
				const reserve = host.querySelector('[data-testid="reserve-button"]') as HTMLElement;
				expect(actions).toHaveLength(3);
				expect(image.contains(reserve)).toBe(false);
				const widths = actions.map((action) => action.getBoundingClientRect().width);
				expect(widths[0]).toBeGreaterThan(32);
				expect(widths[1]).toBeGreaterThan(32);
				expect(widths[2]).toBeCloseTo(32, 0);
			}
			if (role === WISHLIST_ROLES.recipient) {
				expect(host.querySelector('[data-like-heart]')).toBeNull();
				expect(host.querySelector('[data-testid="reserve-button"]')).toBeNull();
				expect(host.textContent).not.toMatch(/rezerv/i);
			}
			host.remove();
		},
	);

	it.each([
		{ locale: 'cs' as const, received: false },
		{ locale: 'cs' as const, received: true },
		{ locale: 'en' as const, received: false },
		{ locale: 'en' as const, received: true },
	])(
		'contains localized intrinsic manager actions in a 320px horizontal row for $locale (received: $received)',
		async ({ locale, received }) => {
			overwriteGetLocale(() => locale);
			await page.viewport(768, 900);
			const host = document.createElement('div');
			host.style.width = '320px';
			document.body.appendChild(host);
			try {
				await render(
					GiftListItemTestHost,
					{
						gift: makeVisitorGift({
							description: 'Dlouhý popis, který se v úzkém řádku zkrátí jako první.',
							links: [{ url: 'https://example.com/product' }],
							price: 2499,
							currency: 'CZK',
							quantity: 3,
							reserverNames: ['Alexandra Nováková'],
							received,
						}),
						role: WISHLIST_ROLES.moderator,
						onreceived: () => {},
						onunreserve: () => {},
						onmore: () => {},
					},
					{ baseElement: host },
				);

				const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
				const content = host.querySelector(
					'[data-testid="gift-list-content"]',
				) as HTMLElement;
				const primary = host.querySelector(
					'[data-testid="gift-received-toggle"]',
				) as HTMLElement;
				const more = host.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
				const reserve = host.querySelector('[data-testid="reserve-button"]') as HTMLElement;
				expect(getComputedStyle(item).display).toBe('grid');
				expect(content.getBoundingClientRect().left).toBeCloseTo(
					(
						host.querySelector('[data-testid="gift-list-image"]') as HTMLElement
					).getBoundingClientRect().right,
					0,
				);
				expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth);
				expect(item.scrollHeight).toBeLessThanOrEqual(item.clientHeight);
				expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth);
				expect(reserve.getAttribute('aria-label')).toBe(
					m.reserve_button_cancel_aria({ name: REALISTIC_LONG_NAME }),
				);
				expect(primary.getAttribute('aria-label')).toBe(
					received ? m.gift_mark_unreceived() : m.gift_mark_received(),
				);
				expect(more.getAttribute('aria-label')).toBe(m.gift_more_actions());
				const actions = [reserve, primary, more];
				const actionRects = actions.map((action) => action.getBoundingClientRect());
				for (const [index, action] of actions.entries()) {
					expect(actionRects[index]!.height).toBeCloseTo(32, 0);
					if (index === 2) {
						expect(actionRects[index]!.width).toBeCloseTo(32, 0);
					} else {
						expect(actionRects[index]!.width).toBeGreaterThan(32);
					}
					expectRaisedActionShadowInside(action, item);
				}
				expect(
					host.querySelector('[data-testid="gift-list-image"]')?.contains(reserve),
				).toBe(false);
			} finally {
				overwriteGetLocale(() => 'cs');
				host.remove();
			}
		},
	);

	it('reflows for enlarged root text at a fixed 390px viewport without clipping actions', async () => {
		await page.viewport(390, 900);
		const previousFontSize = document.documentElement.style.fontSize;
		document.documentElement.style.fontSize = '32px';
		const host = document.createElement('div');
		host.style.width = '366px';
		document.body.appendChild(host);

		try {
			await render(
				GiftListItemTestHost,
				{
					gift: makeVisitorGift({
						myReservationId: 'mine',
						isFullyReserved: true,
					}),
					role: WISHLIST_ROLES.visitor,
					onunreserve: () => {},
					onmore: () => {},
				},
				{ baseElement: host },
			);

			const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
			const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
			const content = host.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
			const primary = host.querySelector('[data-testid="reserve-button"]') as HTMLElement;
			const more = host.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
			await new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			);
			const itemRect = item.getBoundingClientRect();
			const imageRect = image.getBoundingClientRect();
			const contentRect = content.getBoundingClientRect();
			expect(getComputedStyle(item).display).toBe('grid');
			expect(item.hasAttribute('data-list-image-stacked')).toBe(true);
			expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
			expect(imageRect.width).toBeCloseTo(itemRect.width - 4, 0);
			expect(contentRect.left).toBeCloseTo(imageRect.left, 0);
			expect(contentRect.top).toBeCloseTo(imageRect.bottom, 0);
			expect(primary.getBoundingClientRect().height).toBeCloseTo(
				more.getBoundingClientRect().height,
				0,
			);
			expectRaisedActionShadowInside(primary, item);
			expectRaisedActionShadowInside(more, item);
			expect(item.scrollHeight).toBeLessThanOrEqual(item.clientHeight);
		} finally {
			document.documentElement.style.fontSize = previousFontSize;
			host.remove();
		}
	});

	it('keeps the complete square image beside content when actual space is narrow', async () => {
		await page.viewport(280, 900);
		const host = document.createElement('div');
		host.style.width = '256px';
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({
					myReservationId: null,
					reservedCount: 0,
					isFullyReserved: false,
				}),
				role: WISHLIST_ROLES.visitor,
				onreserve: () => {},
				onmore: () => {},
			},
			{ baseElement: host },
		);

		const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
		const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		const content = host.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
		const imageRect = image.getBoundingClientRect();
		expect(getComputedStyle(item).display).toBe('grid');
		expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
		expect(content.getBoundingClientRect().left).toBeCloseTo(imageRect.right, 0);
		expect(host.querySelector('[data-testid="reserve-button"]')).toBeTruthy();
		expect(host.querySelector('[data-testid="gift-more-actions"]')).toBeTruthy();
		host.remove();
	});
});
