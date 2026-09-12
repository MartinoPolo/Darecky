import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';
import {
	GiftCardTestHost,
	cleanupCardHosts,
	fixedHosts,
	hasVisibleBoxShadow,
	makeVisitorGift,
	rectanglesIntersect,
	renderCardInGridColumn,
	textOutsideOverlay,
} from './gift_card.test_fixtures.js';
import { render } from 'vitest-browser-svelte';

afterEach(cleanupCardHosts);

describe('GiftCard unified state presentation (issues #328 and #330)', () => {
	it('stacks moderator reserver text above a real description outside the image overlay', async () => {
		await page.viewport(800, 720);
		const host = await renderCardInGridColumn(
			makeVisitorGift({
				reserverNames: ['Babička'],
				description: 'Skutečný popis dárku pro kontrolu rozložení.',
			}),
			WISHLIST_ROLES.moderator,
		);
		const stack = host.querySelector(
			'[data-testid="gift-card-description-stack"]',
		) as HTMLElement;
		const reserverText = Array.from(stack.querySelectorAll('p')).find((element) =>
			element.textContent?.includes('Babička'),
		) as HTMLElement;
		const description = Array.from(stack.querySelectorAll('p')).find((element) =>
			element.textContent?.includes('Skutečný popis dárku'),
		) as HTMLElement;
		const imageOverlay = host.querySelector(
			'[data-testid="gift-state-overlay"]',
		) as HTMLElement;
		const reserverRect = reserverText.getBoundingClientRect();
		const descriptionRect = description.getBoundingClientRect();

		expect(reserverText).toBeTruthy();
		expect(description).toBeTruthy();
		expect(descriptionRect.top).toBeGreaterThanOrEqual(reserverRect.bottom);
		expect(imageOverlay.contains(reserverText)).toBe(false);
	});

	it('renders no empty description stack for a recipient without text content', async () => {
		const host = await renderCardInGridColumn(
			makeVisitorGift({
				description: '   ',
				descriptionAppends: [],
				reserverNames: ['Private'],
			}),
			WISHLIST_ROLES.recipient,
		);

		expect(host.querySelector('[data-testid="gift-card-description-stack"]')).toBeNull();
		expect(host.textContent).not.toContain('Private');
	});

	it('uses the shared centered overlay on desktop without legacy badges', async () => {
		await page.viewport(800, 720);
		const host = await renderCardInGridColumn(
			makeVisitorGift({ received: true, isFullyReserved: true, myReservationId: 'mine' }),
		);

		const overlays = host.querySelectorAll('[data-testid="gift-state-overlay"]');
		expect(overlays).toHaveLength(1);
		expect(overlays[0]?.textContent).toContain(m.gift_received_badge());
		expect(host.querySelector('[data-testid="gift-reserved-sticker"]')).toBeNull();
		expect(host.querySelector('[data-testid="gift-received-sticker"]')).toBeNull();
	});

	it('keeps received recipient DOM and relative geometry identical across private reservation states', async () => {
		await page.viewport(800, 720);
		const states: Partial<GiftForVisitor>[] = [
			{
				received: true,
				quantity: 3,
				reservedCount: 0,
				isFullyReserved: false,
				myReservationId: null,
			},
			{
				received: true,
				quantity: 3,
				reservedCount: 1,
				isFullyReserved: false,
				myReservationId: null,
			},
			{
				received: true,
				quantity: 3,
				reservedCount: 3,
				isFullyReserved: true,
				myReservationId: null,
			},
			{
				received: true,
				quantity: 3,
				reservedCount: 1,
				isFullyReserved: false,
				myReservationId: 'private',
			},
		];
		const hosts = await Promise.all(
			states.map((state) =>
				renderCardInGridColumn(
					makeVisitorGift({ ...state, reserverNames: ['Soukromá osoba'] }),
					WISHLIST_ROLES.recipient,
				),
			),
		);
		const snapshots = hosts.map((host) => {
			const overlay = host.querySelector('[data-testid="gift-state-overlay"]') as HTMLElement;
			const image = host.querySelector(
				'[data-testid="gift-card-image-frame"]',
			) as HTMLElement;
			const overlayRect = overlay.getBoundingClientRect();
			const imageRect = image.getBoundingClientRect();
			expect(overlay.querySelector('[data-state-primary]')?.textContent).toBe(
				m.gift_received_badge(),
			);
			expect(overlay.querySelector('[data-reservation-support]')).toBeNull();
			expect(host.textContent).not.toMatch(/rezerv|Soukromá osoba/i);
			return {
				html: overlay.innerHTML,
				left: overlayRect.left - imageRect.left,
				top: overlayRect.top - imageRect.top,
				width: overlayRect.width,
				height: overlayRect.height,
				cardHeight: host.firstElementChild!.getBoundingClientRect().height,
			};
		});
		for (const snapshot of snapshots.slice(1)) {
			expect(snapshot).toEqual(snapshots[0]);
		}
	});

	it('shows two pills but no reservation actions or identity to a self-promoted recipient', async () => {
		await page.viewport(800, 720);
		const host = document.createElement('div');
		host.style.width = '280px';
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift({
					received: true,
					quantity: 3,
					reservedCount: 1,
					myReservationId: null,
					reserverNames: ['Soukromá osoba'],
				}),
				role: WISHLIST_ROLES.recipient,
				hideReservationState: false,
				onreceived: () => {},
			},
			{ baseElement: host },
		);

		const overlay = host.querySelector('[data-testid="gift-state-overlay"]') as HTMLElement;
		expect(overlay.children).toHaveLength(2);
		expect(overlay.querySelector('[data-state-primary]')?.textContent).toBe(
			m.gift_received_badge(),
		);
		expect(overlay.querySelector('[data-reservation-support]')?.textContent).toBe(
			m.gift_remaining_capacity({ remaining: 2, total: 3 }),
		);
		expect(host.textContent).not.toContain('Soukromá osoba');
		expect(host.querySelector('[data-testid="reserve-button"]')).toBeNull();
		expect(host.querySelector('[data-like-heart]')).toBeNull();
		expect(host.querySelector('[data-testid="gift-received-toggle"]')).toBeTruthy();
	});

	it('retains the overlay while contextual mode suppresses card actions', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift({ isFullyReserved: true }),
				role: WISHLIST_ROLES.visitor,
				contextualMode: true,
				onunreserve: () => {},
			},
			{ baseElement: host },
		);

		expect(host.querySelector('[data-testid="gift-state-overlay"]')).toBeTruthy();
		expect(host.querySelector('[data-testid="gift-card-footer"]')).toBeNull();
		expect(host.querySelector('[data-like-heart]')).toBeNull();
	});

	it('keeps moderator reserver names in the body during contextual mode', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		fixedHosts.add(host);
		await render(
			GiftCardTestHost,
			{
				gift: makeVisitorGift({ reserverNames: ['Babička'], isFullyReserved: true }),
				role: WISHLIST_ROLES.moderator,
				contextualMode: true,
				onreceived: () => {},
				onreserve: () => {},
			},
			{ baseElement: host },
		);

		const overlay = host.querySelector('[data-testid="gift-state-overlay"]') as HTMLElement;
		expect(textOutsideOverlay(host)).toContain('Babička');
		expect(overlay.textContent).not.toContain('Babička');
		expect(host.querySelector('[data-testid="gift-card-footer"]')).toBeNull();
		expect(host.querySelector('[data-like-heart]')).toBeNull();
		expect(host.querySelector('[data-testid="reserve-button"]')).toBeNull();
	});

	it('derives received with partial-capacity support through the public card component', async () => {
		const host = await renderCardInGridColumn(
			makeVisitorGift({
				received: true,
				quantity: 3,
				reservedCount: 1,
				isFullyReserved: false,
				myReservationId: null,
			}),
			WISHLIST_ROLES.visitor,
		);
		const overlays = host.querySelectorAll('[data-testid="gift-state-overlay"]');
		const overlay = overlays[0] as HTMLElement;

		expect(overlays).toHaveLength(1);
		expect(overlay.querySelector('[data-state-primary]')?.textContent).toBe(
			m.gift_received_badge(),
		);
		expect(overlay.querySelector('[data-reservation-support]')?.textContent).toBe(
			m.gift_remaining_capacity({ remaining: 2, total: 3 }),
		);
	});

	it('renders one received-first overlay with reservation support', async () => {
		await page.viewport(390, 720);
		const host = await renderCardInGridColumn(
			makeVisitorGift({ received: true, isFullyReserved: true, myReservationId: 'mine' }),
		);

		const overlays = host.querySelectorAll('[data-testid="gift-state-overlay"]');
		expect(overlays).toHaveLength(1);
		expect(overlays[0]?.textContent).toContain(m.gift_received_badge());
		expect(overlays[0]?.textContent).toContain(m.gift_reserved_by_me_overlay());
		expect(host.querySelector('[data-testid="gift-reserved-sticker"]')).toBeNull();
		expect(host.querySelector('[data-testid="gift-received-sticker"]')).toBeNull();
	});

	it.each([
		{
			label: 'own reservation',
			gift: { quantity: 3, reservedCount: 1, isFullyReserved: false },
			requiredLabels: [m.gift_reserved_by_me_overlay()],
		},
		{
			label: 'received plus unavailable',
			gift: {
				received: true,
				quantity: 3,
				reservedCount: 3,
				isFullyReserved: true,
				myReservationId: null,
			},
			requiredLabels: [m.gift_received_badge(), m.gift_reserved_by_other_overlay()],
		},
	])(
		'keeps $label overlay clear of Like at real mobile width',
		async ({ gift, requiredLabels }) => {
			await page.viewport(390, 720);
			const host = document.createElement('div');
			host.style.width = '179px';
			document.body.appendChild(host);
			fixedHosts.add(host);
			await render(
				GiftCardTestHost,
				{
					gift: makeVisitorGift(gift),
					role: WISHLIST_ROLES.visitor,
				},
				{ baseElement: host },
			);
			const overlay = host.querySelector('[data-testid="gift-state-overlay"]') as HTMLElement;
			const likeButton = host.querySelector('[data-like-heart]')
				?.parentElement as HTMLElement;

			expect(host.getBoundingClientRect().width).toBeCloseTo(179, 0);
			for (const requiredLabel of requiredLabels) {
				expect(overlay.textContent).toContain(requiredLabel);
			}
			expect(likeButton.getBoundingClientRect().width).toBeGreaterThanOrEqual(40);
			for (const pill of overlay.querySelectorAll<HTMLElement>(':scope > span')) {
				for (const likePart of likeButton.querySelectorAll<HTMLElement>(
					'[data-like-heart], [data-like-count]',
				)) {
					expect(
						rectanglesIntersect(
							pill.getBoundingClientRect(),
							likePart.getBoundingClientRect(),
						),
					).toBe(false);
				}
			}
		},
	);

	it('keeps a long unavailable overlay clear of the visible mobile Like control', async () => {
		await page.viewport(390, 720);
		const host = await renderCardInGridColumn(
			makeVisitorGift({
				quantity: 3,
				reservedCount: 3,
				isFullyReserved: true,
				myReservationId: null,
			}),
		);
		const badge = host.querySelector(
			'[data-testid="gift-state-overlay"] > span',
		) as HTMLElement;
		const likeButton = host.querySelector('[data-like-heart]')?.parentElement as HTMLElement;

		await expect
			.element(page.getByText(m.gift_reserved_by_other_overlay(), { exact: true }))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: /Přidat do oblíbených/ }))
			.toBeVisible();
		expect(likeButton.getBoundingClientRect().width).toBeCloseTo(40, 0);
		expect(
			rectanglesIntersect(badge.getBoundingClientRect(), likeButton.getBoundingClientRect()),
		).toBe(false);
	});

	it.each([
		{
			dark: false,
			received: false,
			primary: m.gift_reserved_by_other_overlay(),
			support: null,
		},
		{
			dark: true,
			received: true,
			primary: m.gift_received_badge(),
			support: m.gift_reserved_by_me_overlay(),
		},
	])(
		'keeps no-image dimmed overlay text visible in a $dark dark host',
		async ({ dark, received, primary, support }) => {
			await page.viewport(390, 720);
			await renderCardInGridColumn(
				makeVisitorGift({
					received,
					isFullyReserved: true,
					myReservationId: support === null ? null : 'mine',
				}),
				WISHLIST_ROLES.visitor,
				{ palette: 'sky', dark },
			);

			await expect.element(page.getByText(primary, { exact: true })).toBeVisible();
			if (support !== null) {
				await expect.element(page.getByText(support, { exact: true })).toBeVisible();
			}
		},
	);

	it.each([
		{
			label: 'fully reserved',
			gift: { quantity: 3, reservedCount: 3, isFullyReserved: true, myReservationId: null },
			overlay: m.gift_reserved_by_other_overlay(),
		},
		{
			label: 'partially reserved',
			gift: { quantity: 3, reservedCount: 1, isFullyReserved: false, myReservationId: null },
			overlay: m.gift_remaining_capacity({ remaining: 2, total: 3 }),
		},
	])('centralizes $label quantity status in the overlay', async ({ gift, overlay }) => {
		await page.viewport(800, 720);
		const host = await renderCardInGridColumn(makeVisitorGift(gift));
		const primary = host.querySelector('[data-state-primary]') as HTMLElement;
		const pieceCount = host.querySelector('[data-testid="gift-piece-count"]') as HTMLElement;
		const outsideText = textOutsideOverlay(host);

		expect(primary.textContent).toBe(overlay);
		expect(pieceCount.textContent?.trim()).toBe('3 kusy');
		expect(outsideText).not.toMatch(/Volné|Plně rezervováno|\d+\s+rezervováno/i);
	});
});

describe('GiftCard approved Like geometry (issue #357)', () => {
	it.each([
		{ viewport: 390, width: 179, count: 0 },
		{ viewport: 800, width: 280, count: 7 },
		{ viewport: 1440, width: 360, count: 123 },
	])(
		'overlays count $count beside the ghost heart at $viewport px without changing image geometry',
		async ({ viewport, width, count }) => {
			await page.viewport(viewport, 720);
			const host = document.createElement('div');
			host.style.width = `${width}px`;
			document.body.appendChild(host);
			fixedHosts.add(host);
			await render(
				GiftCardTestHost,
				{
					gift: makeVisitorGift({ likeCount: count }),
					role: WISHLIST_ROLES.visitor,
					onmore: () => {},
				},
				{ baseElement: host },
			);

			const image = host.querySelector(
				'[data-testid="gift-card-image-frame"]',
			) as HTMLElement;
			const card = image.parentElement as HTMLElement;
			const footer = host.querySelector('[data-testid="gift-card-footer"]') as HTMLElement;
			const like = host.querySelector('[data-like-heart]')?.closest('button') as HTMLElement;
			const heart = like.querySelector('[data-like-heart]') as HTMLElement;
			const countNode = like.querySelector('[data-like-count]') as HTMLElement;
			const imageRect = image.getBoundingClientRect();
			const likeRect = like.getBoundingClientRect();

			expect(card.contains(like)).toBe(true);
			expect(image.contains(like)).toBe(false);
			expect(footer.contains(like)).toBe(false);
			expect(imageRect.width / imageRect.height).toBeCloseTo(4 / 3, 2);
			const cardRect = card.getBoundingClientRect();
			expect(likeRect.top).toBeLessThan(imageRect.top + imageRect.height / 2);
			expect(likeRect.right).toBeLessThanOrEqual(cardRect.right);
			expect(likeRect.top - cardRect.top).toBeCloseTo(cardRect.right - likeRect.right, 1);
			expect(countNode.textContent).toBe(String(count));
			expect(heart.getBoundingClientRect().right).toBeLessThanOrEqual(
				countNode.getBoundingClientRect().left,
			);
			expect(hasVisibleBoxShadow(like.querySelector('.elevation-surface')!)).toBe(false);
		},
	);
});
