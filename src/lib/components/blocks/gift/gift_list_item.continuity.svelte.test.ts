import '../../../../app.css';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import {
	REALISTIC_LONG_NAME,
	IMAGE_URL,
	imageMeta,
	makeVisitorGift,
	GiftListItemTestHost,
} from './gift_list_item.test_fixtures.js';

describe('GiftListItem image continuity', () => {
	it.each([
		{
			label: 'visitor actions without an image',
			width: 296,
			gift: makeVisitorGift({
				imageUrl: null,
				imageMeta: null,
				myReservationId: null,
				reservedCount: 0,
			}),
			role: WISHLIST_ROLES.visitor,
			contentMinimumHeight: undefined,
		},
		{
			label: 'visitor own reservation',
			width: 366,
			gift: makeVisitorGift({
				imageUrl: IMAGE_URL,
				imageMeta: imageMeta('#ffffff'),
				myReservationId: 'mine',
				reservedCount: 1,
				isFullyReserved: true,
			}),
			role: WISHLIST_ROLES.visitor,
			contentMinimumHeight: undefined,
		},
		{
			label: 'dense manager actions and reserver state',
			width: 366,
			gift: makeVisitorGift({
				imageUrl: IMAGE_URL,
				imageMeta: imageMeta('#ffffff'),
				description: 'Dlouhý popis dárku se všemi důležitými podrobnostmi.',
				links: [{ url: 'https://example.com/product' }],
				price: 2499,
				currency: 'CZK',
				quantity: 3,
				reservedCount: 1,
				myReservationId: 'mine',
				reserverNames: ['Alexandra Nováková'],
			}),
			role: WISHLIST_ROLES.moderator,
			contentMinimumHeight: undefined,
		},
		{
			label: 'mobile content taller than the stylesheet baseline cap',
			width: 366,
			gift: makeVisitorGift({
				imageUrl: IMAGE_URL,
				imageMeta: imageMeta('#ffffff'),
				myReservationId: null,
				reservedCount: 0,
			}),
			role: WISHLIST_ROLES.visitor,
			contentMinimumHeight: 224,
		},
		{
			label: 'desktop content taller than the stylesheet baseline cap',
			width: 720,
			gift: makeVisitorGift({
				imageUrl: IMAGE_URL,
				imageMeta: imageMeta('#ffffff'),
				myReservationId: null,
				reservedCount: 0,
			}),
			role: WISHLIST_ROLES.visitor,
			contentMinimumHeight: 240,
		},
	])(
		'keeps a square frame against every inner row edge for $label',
		async ({ width, gift, role, contentMinimumHeight }) => {
			await page.viewport(width + 24, 900);
			const host = document.createElement('div');
			host.style.width = `${width}px`;
			document.body.appendChild(host);
			await render(
				GiftListItemTestHost,
				{
					gift,
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
			const imageFrame = image.querySelector('[data-testid="image-frame"]') as HTMLElement;
			const content = host.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
			if (contentMinimumHeight !== undefined) {
				content.style.minHeight = `${contentMinimumHeight}px`;
				await new Promise<void>((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
				);
			}
			const itemRect = item.getBoundingClientRect();
			const imageRect = image.getBoundingClientRect();
			const frameRect = imageFrame.getBoundingClientRect();
			const itemStyle = getComputedStyle(item);
			const innerTop = itemRect.top + Number.parseFloat(itemStyle.borderTopWidth);
			const innerBottom = itemRect.bottom - Number.parseFloat(itemStyle.borderBottomWidth);

			expect(getComputedStyle(item).display).toBe('grid');
			expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
			expect(imageRect.top).toBeCloseTo(innerTop, 0);
			expect(imageRect.bottom).toBeCloseTo(innerBottom, 0);
			expect(frameRect.top).toBeCloseTo(innerTop, 0);
			expect(frameRect.bottom).toBeCloseTo(innerBottom, 0);
			expect(content.getBoundingClientRect().left).toBeCloseTo(imageRect.right, 0);
			for (const action of host.querySelectorAll<HTMLElement>(
				'[data-testid="gift-list-actions"] button',
			)) {
				expect(action.getBoundingClientRect().left).toBeGreaterThanOrEqual(imageRect.right);
			}
			host.remove();
		},
	);
});

describe('GiftListItem desktop bordered card geometry (issue #360)', () => {
	it.each([640, 768, 1440])(
		'keeps the complete bordered card enclosed at %d px',
		async (viewport) => {
			await page.viewport(viewport, 900);
			const host = document.createElement('div');
			host.style.width = `${Math.min(viewport - 24, 900)}px`;
			document.body.appendChild(host);
			await render(
				GiftListItemTestHost,
				{
					gift: makeVisitorGift({
						description:
							'Lehká myš pro dlouhé hraní, ideálně v černé barvě a s tichými spínači.',
						links: [
							{ url: 'https://www.alza.cz/gaming/dlouhy-nazev-produktu' },
							{ url: 'https://www.mall.cz/alternativni-produkt' },
						],
						price: 2499,
						currency: 'CZK',
						quantity: 3,
						reservedCount: 1,
						reserverNames: ['Babička'],
					}),
					role: WISHLIST_ROLES.moderator,
					onreceived: () => {},
					onreserve: () => {},
					onmore: () => {},
				},
				{ baseElement: host },
			);

			const item = host.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
			const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
			const content = host.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
			const itemStyle = getComputedStyle(item);
			const itemRect = item.getBoundingClientRect();
			const imageRect = image.getBoundingClientRect();
			const contentRect = content.getBoundingClientRect();

			expect(itemStyle.borderTopWidth).toBe('2px');
			expect(itemStyle.borderRightWidth).toBe('2px');
			expect(itemStyle.borderBottomWidth).toBe('2px');
			expect(itemStyle.borderLeftWidth).toBe('2px');
			expect(itemStyle.borderTopLeftRadius).toBe('16px');
			expect(itemStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
			expect(itemStyle.boxShadow).not.toBe('none');
			expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
			expect(imageRect.top).toBeCloseTo(itemRect.top + 2, 0);
			expect(itemStyle.display).toBe('grid');
			expect(imageRect.bottom).toBeLessThanOrEqual(itemRect.bottom - 2);
			expect(contentRect.left).toBeCloseTo(imageRect.right, 0);
			expect(Number.parseFloat(getComputedStyle(content).paddingRight)).toBeGreaterThan(0);
			expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth);
			expect(item.scrollHeight).toBeLessThanOrEqual(item.clientHeight);
			expect(host.textContent).toContain(REALISTIC_LONG_NAME);
			expect(host.textContent).toContain('alza.cz');
			expect(host.textContent).toContain('Babička');
			expect(host.querySelector('[data-testid="gift-state-overlay"]')).toBeTruthy();
			expect(host.querySelector('[data-testid="gift-received-toggle"]')).toBeTruthy();
			expect(host.querySelector('[data-testid="reserve-button"]')).toBeTruthy();
			expect(host.querySelector('[data-testid="gift-more-actions"]')).toBeTruthy();

			for (const action of host.querySelectorAll<HTMLElement>(
				'[data-testid="gift-list-actions"] button',
			)) {
				const actionRect = action.getBoundingClientRect();
				expect(actionRect.left).toBeGreaterThanOrEqual(contentRect.left);
				expect(actionRect.right).toBeLessThanOrEqual(itemRect.right - 2);
				expect(actionRect.bottom + 3).toBeLessThanOrEqual(itemRect.bottom - 2);
			}
			host.remove();
		},
	);
});

describe('GiftListItem reservation-action layout (issue #211)', () => {
	it('stacks mark-as-bought and cancel-reservation with intrinsic widths', async () => {
		await page.viewport(800, 720);
		const host = document.createElement('div');
		host.style.width = '400px';
		document.body.appendChild(host);

		await render(
			GiftListItemTestHost,
			{ gift: makeVisitorGift(), role: WISHLIST_ROLES.visitor, isArchived: false },
			{ baseElement: host },
		);

		const reserveButtonEl = host.querySelector('[data-testid="reserve-button"]') as HTMLElement;
		const purchasedButtonEl = reserveButtonEl.parentElement!.querySelector(
			'button:not([data-testid])',
		) as HTMLElement;

		expect(reserveButtonEl).toBeTruthy();
		expect(purchasedButtonEl).toBeTruthy();

		const reserveRect = reserveButtonEl.getBoundingClientRect();
		const purchasedRect = purchasedButtonEl.getBoundingClientRect();

		// Stacked: no vertical overlap between the two actions.
		expect(reserveRect.top).toBeGreaterThanOrEqual(purchasedRect.bottom);
		// Each localized action keeps its intrinsic width rather than stretching to its sibling.
		expect(reserveRect.width).not.toBeCloseTo(purchasedRect.width, 1);
	});
});
