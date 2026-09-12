import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';
import {
	REALISTIC_LONG_NAME,
	GiftCardTestHost,
	cleanupCardHosts,
	expectRaisedActionShadowInside,
	fixedHosts,
	makeVisitorGift,
} from './gift_card.test_fixtures.js';

afterEach(cleanupCardHosts);

describe('GiftCard mobile action row grouping', () => {
	it('keeps Reserve, Received, and More in one right-aligned row when a mobile card is wide enough', async () => {
		await page.viewport(390, 900);
		const host = document.createElement('div');
		host.style.width = '296px';
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
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
	});

	it('wraps Reserve above the inseparable Received and More group when intrinsic actions no longer fit', async () => {
		await page.viewport(390, 900);
		const host = document.createElement('div');
		host.style.width = '296px';
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
				role: WISHLIST_ROLES.moderator,
				onreceived: () => {},
				onreserve: () => {},
				onmore: () => {},
			},
			{ baseElement: host },
		);

		const footer = host.querySelector('[data-testid="gift-card-footer"]') as HTMLElement;
		const row = host.querySelector('[data-testid="gift-action-row"]') as HTMLElement;
		const reserve = row.querySelector('[data-testid="reserve-button"]') as HTMLElement;
		const received = row.querySelector('[data-testid="gift-received-toggle"]') as HTMLElement;
		const more = row.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
		const footerStyle = getComputedStyle(footer);
		const actionGap = Number.parseFloat(getComputedStyle(row).columnGap);
		const intrinsicRowWidth =
			reserve.getBoundingClientRect().width +
			received.getBoundingClientRect().width +
			more.getBoundingClientRect().width +
			actionGap * 2;
		const narrowCardWidth =
			intrinsicRowWidth +
			Number.parseFloat(footerStyle.paddingLeft) +
			Number.parseFloat(footerStyle.paddingRight) -
			1;
		host.style.width = `${narrowCardWidth}px`;

		const rowRect = row.getBoundingClientRect();
		const reserveRect = reserve.getBoundingClientRect();
		const receivedRect = received.getBoundingClientRect();
		const moreRect = more.getBoundingClientRect();

		expect(reserveRect.bottom).toBeLessThanOrEqual(receivedRect.top);
		expect(receivedRect.top).toBeCloseTo(moreRect.top, 0);
		expect(receivedRect.bottom).toBeCloseTo(moreRect.bottom, 0);
		expect(reserveRect.right).toBeCloseTo(rowRect.right, 0);
		expect(moreRect.right).toBeCloseTo(rowRect.right, 0);
	});

	it('keeps Reserve, Received, and More in one right-aligned desktop row', async () => {
		await page.viewport(768, 900);
		const host = document.createElement('div');
		host.style.width = '360px';
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
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
	});
});

describe('GiftCard approved action geometry (issue #350)', () => {
	it.each([
		{ viewport: 320, width: 296, role: WISHLIST_ROLES.visitor, reservationId: null },
		{ viewport: 390, width: 179, role: WISHLIST_ROLES.visitor, reservationId: 'mine' },
		{ viewport: 768, width: 280, role: WISHLIST_ROLES.recipient, reservationId: null },
		{ viewport: 1440, width: 360, role: WISHLIST_ROLES.moderator, reservationId: null },
	])(
		'contains equal-height primary and More actions at $viewport px for $role',
		async ({ viewport, width, role, reservationId }) => {
			await page.viewport(viewport, 900);
			const host = document.createElement('div');
			host.style.width = `${width}px`;
			document.body.appendChild(host);
			fixedHosts.add(host);
			await render(
				GiftCardTestHost,
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

			const row = host.querySelector('[data-testid="gift-action-row"]') as HTMLElement;
			const more = row.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
			const primary = row.querySelector(
				'[data-testid="gift-received-toggle"], [data-testid="reserve-button"]',
			) as HTMLElement;
			const card = host.querySelector('[data-testid="gift-card-image-frame"]')!
				.parentElement as HTMLElement;
			const expectedControlSize = 32;
			const actions = Array.from(row.querySelectorAll<HTMLElement>('button'));
			expect(primary).toBeTruthy();
			expect(more).toBeTruthy();
			for (const action of actions) {
				expect(action.getBoundingClientRect().height).toBeCloseTo(expectedControlSize, 0);
				expectRaisedActionShadowInside(action, card);
			}
			if (role === WISHLIST_ROLES.recipient) {
				expect(host.querySelector('[data-like-heart]')).toBeNull();
				expect(host.querySelector('[data-testid="reserve-button"]')).toBeNull();
			}
			if (role === WISHLIST_ROLES.moderator) {
				const reserve = host.querySelector('[data-testid="reserve-button"]') as HTMLElement;
				expect(actions).toHaveLength(3);
				expect(
					host.querySelector('[data-testid="gift-card-image-frame"]')?.contains(reserve),
				).toBe(false);
				expect(row.contains(reserve)).toBe(true);
				const widths = actions.map((action) => action.getBoundingClientRect().width);
				expect(widths[0]).toBeGreaterThan(32);
				expect(widths[1]).toBeGreaterThan(32);
				expect(widths[2]).toBeCloseTo(32, 0);
			}
		},
	);

	it.each([
		{ locale: 'cs' as const, received: false },
		{ locale: 'cs' as const, received: true },
		{ locale: 'en' as const, received: false },
		{ locale: 'en' as const, received: true },
	])(
		'contains localized manager actions and shadows for $locale (received: $received)',
		async ({ locale, received }) => {
			overwriteGetLocale(() => locale);
			await page.viewport(390, 900);
			const host = document.createElement('div');
			host.style.width = '296px';
			document.body.appendChild(host);
			fixedHosts.add(host);
			try {
				await render(
					GiftCardTestHost,
					{
						gift: makeVisitorGift({ received }),
						role: WISHLIST_ROLES.moderator,
						onreceived: () => {},
						onunreserve: () => {},
						onmore: () => {},
					},
					{ baseElement: host },
				);
				const card = host.querySelector('[data-testid="gift-card-image-frame"]')!
					.parentElement as HTMLElement;
				const primary = host.querySelector(
					'[data-testid="gift-received-toggle"]',
				) as HTMLElement;
				const more = host.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
				const reserve = host.querySelector('[data-testid="reserve-button"]') as HTMLElement;
				expect(reserve.getAttribute('aria-label')).toBe(
					m.reserve_button_cancel_aria({ name: REALISTIC_LONG_NAME }),
				);
				expect(primary.getAttribute('aria-label')).toBe(
					received ? m.gift_mark_unreceived() : m.gift_mark_received(),
				);
				expect(more.getAttribute('aria-label')).toBe(m.gift_more_actions());
				const actions = [reserve, primary, more];
				for (const action of actions) {
					expect(action.getBoundingClientRect().height).toBeCloseTo(32, 0);
					expectRaisedActionShadowInside(action, card);
				}
				expect(
					host.querySelector('[data-testid="gift-card-image-frame"]')?.contains(reserve),
				).toBe(false);
				expect(primary.getBoundingClientRect().top).toBeCloseTo(
					more.getBoundingClientRect().top,
					0,
				);
			} finally {
				overwriteGetLocale(() => 'cs');
			}
		},
	);

	it('keeps both moving-surface shadows contained at 200% root text', async () => {
		await page.viewport(390, 900);
		const previousFontSize = document.documentElement.style.fontSize;
		document.documentElement.style.fontSize = '32px';
		const host = document.createElement('div');
		host.style.width = '296px';
		document.body.appendChild(host);
		fixedHosts.add(host);
		try {
			await render(
				GiftCardTestHost,
				{
					gift: makeVisitorGift({ myReservationId: null, reservedCount: 0 }),
					role: WISHLIST_ROLES.visitor,
					onreserve: () => {},
					onmore: () => {},
				},
				{ baseElement: host },
			);
			const card = host.firstElementChild as HTMLElement;
			const primary = host.querySelector('[data-testid="reserve-button"]') as HTMLElement;
			const more = host.querySelector('[data-testid="gift-more-actions"]') as HTMLElement;
			expect(primary.getBoundingClientRect().height).toBeCloseTo(
				more.getBoundingClientRect().height,
				0,
			);
			expectRaisedActionShadowInside(primary, card);
			expectRaisedActionShadowInside(more, card);
		} finally {
			document.documentElement.style.fontSize = previousFontSize;
		}
	});
});
