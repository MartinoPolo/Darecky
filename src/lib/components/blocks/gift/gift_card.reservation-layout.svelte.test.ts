import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import {
	GiftCardTestHost,
	cleanupCardHosts,
	firstNonBlankTextNode,
	fixedHosts,
	makeVisitorGift,
	renderCardInGridColumn,
} from './gift_card.test_fixtures.js';

afterEach(cleanupCardHosts);

describe('GiftCard reservation-action layout (issue #211)', () => {
	it('keeps a direct mobile Reserve action intrinsic when More is absent', async () => {
		await page.viewport(390, 720);
		const host = document.createElement('div');
		host.style.width = '179px';
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift({ reservedCount: 0, myReservationId: null }),
				role: WISHLIST_ROLES.visitor,
				onreserve: () => {},
			},
			{ baseElement: host },
		);

		const actions = host.querySelector(
			'[data-testid="gift-card-reservation-actions"]',
		) as HTMLElement;
		const reserve = host.querySelector('[data-testid="reserve-button"]') as HTMLElement;
		expect(reserve.getBoundingClientRect().width).toBeLessThan(
			actions.getBoundingClientRect().width,
		);
		expect(reserve.getBoundingClientRect().height).toBeCloseTo(32, 0);
	});

	it('keeps an onmore-only archived recipient footer available on desktop and mobile', async () => {
		await page.viewport(800, 720);
		const host = document.createElement('div');
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift(),
				role: WISHLIST_ROLES.recipient,
				isArchived: true,
				onmore: () => {},
			},
			{ baseElement: host },
		);

		const footer = host.querySelector('[data-testid="gift-card-footer"]') as HTMLElement;
		const more = host.querySelector(
			`[aria-label="${m.gift_more_actions()}"]`,
		) as HTMLButtonElement;
		expect(getComputedStyle(footer).display).not.toBe('none');
		expect(getComputedStyle(more).display).not.toBe('none');
		await page.viewport(390, 720);
		expect(getComputedStyle(more).display).not.toBe('none');
	});

	it('renders a stored gift image key without replacing the persisted source URL', async () => {
		await renderCardInGridColumn(
			makeVisitorGift({
				imageUrl: null,
				imageKey: 'gifts/cam.jpg',
			}),
		);

		expect(document.querySelector('img')?.getAttribute('src')).toBe(
			'/api/upload/gifts/cam.jpg',
		);
	});

	it('stacks mark-as-bought and cancel-reservation with intrinsic widths on desktop', async () => {
		await page.viewport(800, 720);
		await renderCardInGridColumn(makeVisitorGift());

		const reserveButtonEl = document.querySelector(
			'[data-testid="reserve-button"]',
		) as HTMLElement;
		const purchasedButtonEl = reserveButtonEl.parentElement!.querySelector(
			'button:not([data-testid])',
		) as HTMLElement;

		expect(reserveButtonEl).toBeTruthy();
		expect(purchasedButtonEl).toBeTruthy();

		const reserveRect = reserveButtonEl.getBoundingClientRect();
		const purchasedRect = purchasedButtonEl.getBoundingClientRect();

		// Stacked: the reserve/cancel button sits below the purchased-toggle button,
		// not beside it (no vertical overlap).
		expect(reserveRect.top).toBeGreaterThanOrEqual(purchasedRect.bottom);
		// Each localized action keeps its intrinsic width rather than stretching to its sibling.
		expect(reserveRect.width).not.toBeCloseTo(purchasedRect.width, 1);
	});

	it('keeps Purchased off the direct mobile face and exposes its context through More', async () => {
		await page.viewport(390, 720);
		const onmore = vi.fn();
		const host = document.createElement('div');
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{ gift: makeVisitorGift(), role: WISHLIST_ROLES.visitor, onmore },
			{ baseElement: host },
		);

		const purchased = host.querySelector(
			`[aria-label="${m.gift_mark_bought()}"]`,
		) as HTMLButtonElement | null;
		expect(purchased).toBeNull();
		const more = host.querySelector(
			`[aria-label="${m.gift_more_actions()}"]`,
		) as HTMLButtonElement;
		expect(more).toBeTruthy();
		more.click();
		expect(onmore).toHaveBeenCalledOnce();
	});

	it('fits the direct manager action and optional More in a compact mobile card', async () => {
		await page.viewport(390, 720);
		const host = document.createElement('div');
		host.style.width = '165px';
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift(),
				role: WISHLIST_ROLES.recipient,
				onreceived: () => {},
				onmore: () => {},
			},
			{ baseElement: host },
		);

		const directAction = host.querySelector(
			'[data-testid="gift-received-toggle"]',
		) as HTMLButtonElement;
		const more = host.querySelector(
			`[aria-label="${m.gift_more_actions()}"]`,
		) as HTMLButtonElement;
		expect(directAction).toBeTruthy();
		expect(more).toBeTruthy();
		expect(directAction.getBoundingClientRect().height).toBeCloseTo(32, 0);
		expect(more.getBoundingClientRect().width).toBeCloseTo(32, 0);
		expect(more.getBoundingClientRect().height).toBeCloseTo(
			directAction.getBoundingClientRect().height,
			0,
		);
		const labelNode = firstNonBlankTextNode(
			directAction.querySelector(':scope > .elevation-surface') as HTMLElement,
		);
		const labelRange = document.createRange();
		labelRange.selectNodeContents(labelNode);
		const labelRect = labelRange.getBoundingClientRect();
		const cardRect = (
			directAction.closest('[class*="rounded-panel"]') as HTMLElement
		).getBoundingClientRect();
		expect(labelRect.left).toBeGreaterThanOrEqual(cardRect.left);
		expect(labelRect.right).toBeLessThanOrEqual(cardRect.right);
	});

	it('contains the rendered manager action label inside its button at the real 390px grid width', async () => {
		await page.viewport(390, 720);
		const grid = document.createElement('div');
		grid.style.display = 'grid';
		grid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
		grid.style.columnGap = '8px';
		grid.style.width = '366px';
		document.body.appendChild(grid);
		fixedHosts.add(grid);

		for (const id of ['first', 'second']) {
			const column = document.createElement('div');
			grid.appendChild(column);
			await render(
				GiftCardTestHost,
				{
					gift: makeVisitorGift({ id: `gift-${id}` }),
					role: WISHLIST_ROLES.moderator,
					onreceived: () => {},
					onmore: () => {},
				},
				{ baseElement: column },
			);
		}

		await document.fonts.ready;
		const cards = Array.from(
			grid.children,
			(column) => column.firstElementChild as HTMLElement,
		);
		expect(cards).toHaveLength(2);
		const firstAction = cards[0]!.querySelector(
			'[data-testid="gift-received-toggle"]',
		) as HTMLButtonElement;
		const firstMore = cards[0]!.querySelector(
			`[aria-label="${m.gift_more_actions()}"]`,
		) as HTMLButtonElement;
		const secondCardRect = cards[1]!.getBoundingClientRect();
		const actionRect = firstAction.getBoundingClientRect();
		const moreRect = firstMore.getBoundingClientRect();
		const visibleButtons = Array.from(
			firstAction
				.closest('[data-testid="gift-action-row"]')!
				.querySelectorAll<HTMLButtonElement>('button'),
		).filter((button) => getComputedStyle(button).display !== 'none');
		const paintedLabels = visibleButtons.flatMap((button) => {
			const surface = button.querySelector(':scope > .elevation-surface') as HTMLElement;
			const node = (() => {
				try {
					return firstNonBlankTextNode(surface);
				} catch {
					return null;
				}
			})();
			if (node === null) {
				return [];
			}
			const range = document.createRange();
			range.selectNodeContents(node);
			return [
				{
					button: button.getBoundingClientRect(),
					label: range.getBoundingClientRect(),
				},
			];
		});

		expect(visibleButtons).toHaveLength(3);
		for (const { button, label } of paintedLabels) {
			expect(label.left).toBeGreaterThanOrEqual(button.left);
			expect(label.right).toBeLessThanOrEqual(button.right);
		}
		expect(firstAction.scrollWidth).toBeLessThanOrEqual(firstAction.clientWidth);
		expect(actionRect.right).toBeLessThanOrEqual(moreRect.left);
		expect(moreRect.right).toBeLessThanOrEqual(secondCardRect.left - 8);
	});

	it('keeps the manager action label visible and clear of More in a realistic two-column card', async () => {
		await page.viewport(390, 720);
		const host = document.createElement('div');
		host.style.width = '179px';
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift(),
				role: WISHLIST_ROLES.recipient,
				onreceived: () => {},
				onmore: () => {},
			},
			{ baseElement: host },
		);

		const directAction = host.querySelector(
			'[data-testid="gift-received-toggle"]',
		) as HTMLButtonElement;
		const more = host.querySelector(
			`[aria-label="${m.gift_more_actions()}"]`,
		) as HTMLButtonElement;
		const labelNode = firstNonBlankTextNode(
			directAction.querySelector(':scope > .elevation-surface') as HTMLElement,
		);
		const labelRange = document.createRange();
		labelRange.selectNodeContents(labelNode);
		const labelRect = labelRange.getBoundingClientRect();
		const actionRect = directAction.getBoundingClientRect();
		const moreRect = more.getBoundingClientRect();
		const cardRect = (
			directAction.closest('[class*="rounded-panel"]') as HTMLElement
		).getBoundingClientRect();

		expect(actionRect.height).toBeCloseTo(32, 0);
		expect(moreRect.width).toBeCloseTo(32, 0);
		expect(moreRect.height).toBeCloseTo(32, 0);
		expect(labelRect.left).toBeGreaterThanOrEqual(actionRect.left);
		expect(labelRect.right).toBeLessThanOrEqual(actionRect.right);
		expect(labelRect.top).toBeGreaterThanOrEqual(actionRect.top);
		expect(labelRect.bottom).toBeLessThanOrEqual(actionRect.bottom);
		expect(labelRect.right).toBeLessThanOrEqual(moreRect.left);
		expect(actionRect.bottom).toBeLessThanOrEqual(cardRect.bottom);
		expect(moreRect.bottom).toBeLessThanOrEqual(cardRect.bottom);
	});

	it('keeps the footer within the rendered card width, even with a long name', async () => {
		await page.viewport(800, 720);
		await renderCardInGridColumn(makeVisitorGift());

		const cardEl = document
			.querySelector('[data-testid="reserve-button"]')
			?.closest('[class*="rounded-panel"]') as HTMLElement;
		const footerEl = document.querySelector('[data-testid="reserve-button"]')!.parentElement!
			.parentElement as HTMLElement;

		// The card's own box never exceeds its grid track (it already carries
		// `overflow-hidden` for the rounded corners/sticker, unrelated to this fix), so
		// checking the card against its host would pass whether or not the footer fix is
		// present. The footer-vs-card check below is what the fix actually protects:
		// before it, the unstacked button pair's min-content width dragged the footer
		// wider than the card (clipped invisibly by that pre-existing `overflow-hidden`,
		// but still a real layout defect internally).
		expect(footerEl.getBoundingClientRect().width).toBeLessThanOrEqual(
			cardEl.getBoundingClientRect().width + 0.5,
		);
	});
});
