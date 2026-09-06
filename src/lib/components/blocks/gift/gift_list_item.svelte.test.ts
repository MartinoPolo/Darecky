// Layout-invariant suite (issue #211): measures real computed geometry, so the compiled
// Tailwind utilities must be present (mirrors gift_detail_form.svelte.test.ts).
import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { IMAGE_FIT_MODES, type ImageMetadata } from '$lib/modules/images/index.js';
import * as m from '$lib/paraglide/messages.js';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: GiftListItemTestHost } = await import('./GiftListItemTestHost.svelte');

const REALISTIC_LONG_NAME =
	'Bezdrátová herní myš s RGB podsvícením a vyměnitelnými tlačítky pro praváky i leváky';
const IMAGE_URL =
	'data:image/svg+xml,' +
	encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="64"/>');

function imageMeta(bgColor: string | null): ImageMetadata {
	return {
		fitMode: IMAGE_FIT_MODES.containPadded,
		cropRect: null,
		focal: { x: 50, y: 50 },
		zoom: 1,
		bgColor,
	};
}

function makeVisitorGift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: REALISTIC_LONG_NAME,
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
		likeCount: 0,
		reservedCount: 1,
		isFullyReserved: false,
		reserverNames: [],
		// Non-null myReservationId puts the visitor in the "reserved by me" state (#211
		// REQ-1/2): both PurchasedToggle and ReserveButton render together.
		myReservationId: 'reservation-1',
		myReservationPurchasedAt: null,
		...overrides,
	};
}

async function renderItem(
	gift: GiftForVisitor,
	role: (typeof WISHLIST_ROLES)[keyof typeof WISHLIST_ROLES],
	theme: { palette: string; dark: boolean } | null = null,
) {
	const host = document.createElement('div');
	host.style.width = '640px';
	if (theme !== null) {
		host.dataset.palette = theme.palette;
		host.classList.toggle('dark', theme.dark);
	}
	document.body.appendChild(host);
	await render(GiftListItemTestHost, { gift, role, isArchived: false }, { baseElement: host });
	return host;
}

function rectanglesIntersect(first: DOMRect, second: DOMRect): boolean {
	return (
		first.left < second.right &&
		first.right > second.left &&
		first.top < second.bottom &&
		first.bottom > second.top
	);
}

function textOutsideOverlay(host: HTMLElement): string {
	const clone = host.cloneNode(true) as HTMLElement;
	clone.querySelector('[data-testid="gift-state-overlay"]')?.remove();
	return clone.textContent ?? '';
}

function firstNonBlankTextNode(element: HTMLElement): Text {
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();
	while (node !== null) {
		if ((node.textContent?.trim().length ?? 0) > 0) {
			return node as Text;
		}
		node = walker.nextNode();
	}
	throw new Error(`Expected visible text inside ${element.outerHTML}`);
}

function expectRaisedActionShadowInside(action: HTMLElement, boundary: HTMLElement): void {
	const surface = action.querySelector(':scope > .elevation-surface') as HTMLElement;
	const surfaceStyle = getComputedStyle(surface);
	const boundaryStyle = getComputedStyle(boundary);
	const shadowOffset = Number.parseFloat(
		surfaceStyle.getPropertyValue('--elevation-ordinary-offset'),
	);
	const surfaceRect = surface.getBoundingClientRect();
	const boundaryRect = boundary.getBoundingClientRect();
	const innerRight = boundaryRect.right - Number.parseFloat(boundaryStyle.borderRightWidth);
	const innerBottom = boundaryRect.bottom - Number.parseFloat(boundaryStyle.borderBottomWidth);

	expect(surfaceStyle.boxShadow).not.toBe('none');
	expect(shadowOffset).toBeGreaterThan(0);
	expect(surfaceRect.right + shadowOffset).toBeLessThanOrEqual(innerRight + 0.5);
	expect(surfaceRect.bottom + shadowOffset).toBeLessThanOrEqual(innerBottom + 0.5);
}

describe('GiftListItem centralized state overlay parity (issue #224 REQ-7)', () => {
	it('does not render the grid-only category badge for a categorized gift (issue #265)', async () => {
		const host = await renderItem(
			makeVisitorGift({
				categoryId: 'category-sport',
				category: {
					id: 'category-sport',
					presetKey: null,
					customLabel: 'Sport',
					color: '#0369A1',
					sortOrder: 0,
				},
			}),
			WISHLIST_ROLES.visitor,
		);

		expect(host.querySelector('[data-testid="gift-category-badge"]')).toBeNull();
	});

	it('paints the visible list thumbnail frame with explicit black', async () => {
		const host = await renderItem(
			makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta('#000000') }),
			WISHLIST_ROLES.visitor,
		);

		const imageFrame = host.querySelector('[data-testid="image-frame"]') as HTMLElement;
		expect(imageFrame).toBeTruthy();
		expect(getComputedStyle(imageFrame).backgroundColor).toBe('rgb(0, 0, 0)');
	});

	it.each([null, 'transparent'])(
		'uses the theme fallback for default %s metadata',
		async (bgColor) => {
			const root = document.documentElement;
			const previousValue = root.style.getPropertyValue('--secondary');
			const previousPriority = root.style.getPropertyPriority('--secondary');
			root.style.setProperty('--secondary', 'rgb(12, 34, 56)');

			try {
				const host = await renderItem(
					makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta(bgColor) }),
					WISHLIST_ROLES.visitor,
				);
				const imageFrame = host.querySelector('[data-testid="image-frame"]') as HTMLElement;
				expect(imageFrame).toBeTruthy();
				expect(getComputedStyle(imageFrame).backgroundColor).toBe('rgb(12, 34, 56)');
			} finally {
				if (previousValue) {
					root.style.setProperty('--secondary', previousValue, previousPriority);
				} else {
					root.style.removeProperty('--secondary');
				}
			}
		},
	);

	it('shows the full-text reservation overlay and a veil on the thumb for a fully-reserved gift', async () => {
		await renderItem(
			makeVisitorGift({ isFullyReserved: true, reservedCount: 1, myReservationId: null }),
			WISHLIST_ROLES.visitor,
		);

		const thumb = document.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		expect(thumb.querySelector('[data-testid="gift-reserved-veil"]')).toBeTruthy();

		const overlayBadge = Array.from(document.querySelectorAll('span')).find((element) =>
			element.textContent?.includes('Rezervováno'),
		);
		expect(overlayBadge).toBeTruthy();
		// The overlay lives on the thumb, not buried in the content column.
		expect(thumb.contains(overlayBadge!)).toBe(true);
	});

	it('dims the content column but keeps the overlay crisp outside the dimmed wrapper', async () => {
		await renderItem(
			makeVisitorGift({ isFullyReserved: true, reservedCount: 1, myReservationId: null }),
			WISHLIST_ROLES.visitor,
		);

		const row = document.querySelector('[data-testid="gift-list-item"]') as HTMLElement;
		// Row root no longer carries the dim — it moved to the content column (card semantics).
		expect(row.className).not.toContain('opacity-55');

		const dimmed = document.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
		expect(dimmed.className).toContain('opacity-55');

		const overlayBadge = Array.from(document.querySelectorAll('span')).find((element) =>
			element.textContent?.includes('Rezervováno'),
		);
		expect(dimmed.contains(overlayBadge!)).toBe(false);
	});

	it('visitors receive no standalone reserver line', async () => {
		await renderItem(
			makeVisitorGift({ isFullyReserved: true, reservedCount: 1, myReservationId: null }),
			WISHLIST_ROLES.visitor,
		);
		// The visitor never gets reserver names anywhere.
		expect(document.body.textContent).not.toContain('rezervoval');
	});

	it('shows moderator reserver names in body text, never in the image overlay', async () => {
		await renderItem(
			makeVisitorGift({
				isFullyReserved: true,
				reservedCount: 1,
				reserverNames: ['Babička'],
				myReservationId: null,
			}),
			WISHLIST_ROLES.moderator,
		);
		const image = document.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		const content = document.querySelector('[data-testid="gift-list-content"]') as HTMLElement;
		expect(content.textContent).toContain('Babička');
		expect(image.textContent).not.toContain('Babička');
		expect(image.textContent).toContain('Rezervováno');

		document.body.innerHTML = '';

		await renderItem(
			makeVisitorGift({
				isFullyReserved: true,
				reservedCount: 1,
				reserverNames: ['Babička'],
				myReservationId: null,
			}),
			WISHLIST_ROLES.visitor,
		);
		expect(document.body.textContent).not.toContain('Babička');
	});
});

describe('GiftListItem unified state presentation (issue #328)', () => {
	it('uses the shared centered state overlay on desktop without an inline Received badge', async () => {
		await page.viewport(800, 720);
		const host = await renderItem(
			makeVisitorGift({ received: true, isFullyReserved: true }),
			WISHLIST_ROLES.visitor,
		);

		expect(host.querySelectorAll('[data-testid="gift-state-overlay"]')).toHaveLength(1);
		expect(host.querySelector('[data-testid="gift-reserved-sticker"]')).toBeNull();
		expect(host.querySelector('[data-testid="gift-received-sticker"]')).toBeNull();
		expect(host.querySelector('[data-testid="gift-state-overlay"]')?.textContent).toContain(
			m.gift_received_badge(),
		);
	});

	it('keeps moderator reserver names in the body during contextual mode', async () => {
		const host = document.createElement('div');
		host.style.width = '320px';
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ reserverNames: ['Babička'], isFullyReserved: true }),
				role: WISHLIST_ROLES.moderator,
				contextualMode: true,
				onreceived: () => {},
				onreserve: () => {},
			},
			{ baseElement: host },
		);

		const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		expect(host.querySelector('[data-testid="gift-list-content"]')?.textContent).toContain(
			'Babička',
		);
		expect(image.textContent).not.toContain('Babička');
		expect(host.querySelector('[data-like-heart]')).toBeNull();
		expect(host.querySelector('[data-testid="reserve-button"]')).toBeNull();
		expect(host.querySelector('[data-testid="gift-received-toggle"]')).toBeNull();
	});

	it('derives received with partial-capacity support through the public list component', async () => {
		const host = await renderItem(
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

	it('shows received with own-reservation support in the unified list overlay', async () => {
		const host = await renderItem(
			makeVisitorGift({ received: true, isFullyReserved: true, myReservationId: 'mine' }),
			WISHLIST_ROLES.visitor,
		);
		const overlay = host.querySelector('[data-testid="gift-state-overlay"]') as HTMLElement;

		expect(overlay.textContent).toContain(m.gift_received_badge());
		expect(overlay.querySelector('[data-reservation-support]')?.textContent).toBe(
			m.gift_reserved_by_me_overlay(),
		);
	});

	it('keeps received recipient DOM and relative geometry identical across private reservation states', async () => {
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
				renderItem(
					makeVisitorGift({ ...state, reserverNames: ['Soukromá osoba'] }),
					WISHLIST_ROLES.recipient,
				),
			),
		);
		const snapshots = hosts.map((host) => {
			const overlay = host.querySelector('[data-testid="gift-state-overlay"]') as HTMLElement;
			const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
			const overlayRect = overlay.getBoundingClientRect();
			const imageRect = image.getBoundingClientRect();
			expect(overlay.querySelector('[data-state-primary]')?.textContent).toBe(
				m.gift_received_badge(),
			);
			expect(overlay.querySelector('[data-reservation-support]')).toBeNull();
			expect(host.querySelector('[data-testid="reserve-button"]')).toBeNull();
			expect(host.querySelector('[aria-pressed]')).toBeNull();
			expect(host.textContent).not.toMatch(/rezerv|koupen|Soukromá osoba/i);
			return {
				html: overlay.innerHTML,
				left: overlayRect.left - imageRect.left,
				top: overlayRect.top - imageRect.top,
				width: overlayRect.width,
				height: overlayRect.height,
				rowHeight: host.firstElementChild!.getBoundingClientRect().height,
			};
		});
		for (const snapshot of snapshots.slice(1)) {
			expect(snapshot).toEqual(snapshots[0]);
		}
	});

	it('shows two pills but no reservation actions or identity to a self-promoted recipient', async () => {
		const host = document.createElement('div');
		host.style.width = '640px';
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
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
		expect(overlay.querySelector('[data-reservation-support]')?.textContent).toBe(
			m.gift_remaining_capacity({ remaining: 2, total: 3 }),
		);
		expect(host.textContent).not.toContain('Soukromá osoba');
		expect(host.querySelector('[data-testid="reserve-button"]')).toBeNull();
		expect(host.querySelector('[data-like-heart]')).toBeNull();
		expect(host.querySelector('[data-testid="gift-received-toggle"]')).toBeTruthy();
		host.remove();
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
		'keeps $label overlay clear of Like on the responsive square thumbnail',
		async ({ gift, requiredLabels }) => {
			await page.viewport(390, 720);
			const host = await renderItem(makeVisitorGift(gift), WISHLIST_ROLES.visitor);
			const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
			const overlay = host.querySelector('[data-testid="gift-state-overlay"]') as HTMLElement;
			const likeButton = host.querySelector('[data-like-heart]')
				?.parentElement as HTMLElement;

			const imageRect = image.getBoundingClientRect();
			expect(imageRect.width).toBeGreaterThanOrEqual(144);
			expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
			for (const requiredLabel of requiredLabels) {
				expect(overlay.textContent).toContain(requiredLabel);
			}
			expect(likeButton.getBoundingClientRect().width).toBeCloseTo(40, 0);
			for (const pill of overlay.querySelectorAll<HTMLElement>(':scope > span')) {
				expect(
					rectanglesIntersect(
						pill.getBoundingClientRect(),
						likeButton.getBoundingClientRect(),
					),
				).toBe(false);
			}
		},
	);

	it('keeps a long unavailable overlay clear of the visible Like control on a mobile square thumbnail', async () => {
		await page.viewport(390, 720);
		const host = await renderItem(
			makeVisitorGift({
				quantity: 3,
				reservedCount: 3,
				isFullyReserved: true,
				myReservationId: null,
			}),
			WISHLIST_ROLES.visitor,
		);
		const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
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
		const imageRect = image.getBoundingClientRect();
		expect(imageRect.width).toBeGreaterThanOrEqual(144);
		expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
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
			await renderItem(
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
		const host = await renderItem(makeVisitorGift(gift), WISHLIST_ROLES.visitor);
		const primary = host.querySelector('[data-state-primary]') as HTMLElement;
		const pieceCount = host.querySelector('[data-testid="gift-piece-count"]') as HTMLElement;
		const outsideText = textOutsideOverlay(host);

		expect(primary.textContent).toBe(overlay);
		expect(pieceCount.textContent?.trim()).toBe('3 kusy');
		expect(outsideText).not.toMatch(/Volné|Plně rezervováno|\d+\s+rezervováno/i);
	});
});

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

	it('puts manager Reserve above Received and More on mobile, outside the image', async () => {
		await page.viewport(390, 720);
		const onreserve = vi.fn();
		const onreceived = vi.fn();
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
				onmore: () => {},
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
		expect(getComputedStyle(item).flexDirection).toBe('column');
		expect(reserve.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			received.getBoundingClientRect().top,
		);
		for (const action of [reserve, received, more]) {
			expect(action.getBoundingClientRect().height).toBeCloseTo(48, 0);
		}
		reserve.click();
		received.click();
		expect(onreserve).toHaveBeenCalledOnce();
		expect(onreceived).toHaveBeenCalledWith('gift-1', true);

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

describe('GiftListItem Like geometry (issue #330 follow-up)', () => {
	it('contains a long centered state label beside the 40px Like on the responsive image', async () => {
		await page.viewport(390, 720);
		const host = document.createElement('div');
		host.style.width = '366px';
		document.body.appendChild(host);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({
					likeCount: 12,
					isFullyReserved: true,
					myReservationId: 'mine',
				}),
				role: WISHLIST_ROLES.visitor,
				isArchived: false,
				showLikeCount: false,
			},
			{ baseElement: host },
		);
		await document.fonts.ready;

		const image = host.querySelector('[data-testid="gift-list-image"]') as HTMLElement;
		const like = host.querySelector('[data-like-heart]')?.closest('button') as HTMLElement;
		const overlay = host.querySelector('[data-testid="gift-state-overlay"]') as HTMLElement;
		const sticker = overlay.firstElementChild as HTMLElement;
		const label = sticker;
		const imageRect = image.getBoundingClientRect();
		const likeRect = like.getBoundingClientRect();
		const overlayRect = overlay.getBoundingClientRect();
		const stickerRect = sticker.getBoundingClientRect();
		const labelRange = document.createRange();
		labelRange.selectNodeContents(label);
		const labelRect = labelRange.getBoundingClientRect();

		expect(imageRect.width).toBeGreaterThanOrEqual(144);
		expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
		expect(likeRect.width).toBeCloseTo(40, 0);
		expect(overlayRect.left).toBeCloseTo(imageRect.left, 0);
		expect(overlayRect.right).toBeCloseTo(imageRect.right - 2, 0);
		expect(stickerRect.left + stickerRect.width / 2).toBeCloseTo(
			overlayRect.left + overlayRect.width / 2,
			0,
		);
		expect(rectanglesIntersect(stickerRect, likeRect)).toBe(false);
		expect(labelRect.left).toBeGreaterThanOrEqual(stickerRect.left);
		expect(labelRect.right).toBeLessThanOrEqual(stickerRect.right);
		expect(labelRect.top).toBeGreaterThanOrEqual(stickerRect.top);
		expect(labelRect.bottom).toBeLessThanOrEqual(stickerRect.bottom);
		expect(sticker.scrollWidth).toBeLessThanOrEqual(sticker.clientWidth);
		host.remove();
	});

	it('keeps the counted variant 40px square on mobile and allows growth only on desktop', async () => {
		await page.viewport(390, 720);
		const mobileHost = document.createElement('div');
		mobileHost.style.width = '640px';
		document.body.appendChild(mobileHost);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ likeCount: 12 }),
				role: WISHLIST_ROLES.visitor,
				isArchived: false,
				showLikeCount: true,
			},
			{ baseElement: mobileHost },
		);
		const mobileLike = mobileHost
			.querySelector('[data-like-heart]')
			?.closest('button') as HTMLElement;
		expect(mobileLike.getBoundingClientRect().width).toBeCloseTo(40, 0);
		expect(mobileLike.getBoundingClientRect().height).toBeCloseTo(40, 0);
		const mobileCount = mobileHost.querySelector('[data-like-count]') as HTMLElement;
		expect(mobileCount).toBeTruthy();
		expect(getComputedStyle(mobileCount).display).toBe('none');

		await page.viewport(800, 720);
		const desktopHost = document.createElement('div');
		desktopHost.style.width = '640px';
		document.body.appendChild(desktopHost);
		await render(
			GiftListItemTestHost,
			{
				gift: makeVisitorGift({ id: 'desktop-like', likeCount: 12 }),
				role: WISHLIST_ROLES.visitor,
				isArchived: false,
				showLikeCount: true,
			},
			{ baseElement: desktopHost },
		);
		const desktopLike = desktopHost
			.querySelector('[data-like-heart]')
			?.closest('button') as HTMLElement;
		expect(desktopLike.getBoundingClientRect().width).toBeGreaterThanOrEqual(40);
		expect(desktopLike.getBoundingClientRect().height).toBeCloseTo(40, 0);
		const desktopCount = desktopHost.querySelector('[data-like-count]') as HTMLElement;
		expect(desktopCount).toBeTruthy();
		expect(getComputedStyle(desktopCount).display).not.toBe('none');
		mobileHost.remove();
		desktopHost.remove();
	});

	it('keeps the centered state label clear of the top-right Like on the 128px image', async () => {
		await page.viewport(390, 720);
		const host = await renderItem(
			makeVisitorGift({
				likeCount: 12,
				received: true,
				isFullyReserved: true,
				myReservationId: 'mine',
			}),
			WISHLIST_ROLES.visitor,
		);
		const like = host.querySelector('[data-like-heart]')?.closest('button') as HTMLElement;
		const pills = host.querySelectorAll<HTMLElement>(
			'[data-testid="gift-state-overlay"] > span',
		);
		const likeRect = like.getBoundingClientRect();
		for (const pill of pills) {
			expect(rectanglesIntersect(likeRect, pill.getBoundingClientRect())).toBe(false);
		}
		host.remove();
	});
});

describe('GiftListItem approved action geometry (issue #350)', () => {
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
			const expectedControlSize = viewport < 640 ? 48 : 32;
			const actions = Array.from(row.querySelectorAll<HTMLElement>('button'));
			expect(primary).toBeTruthy();
			expect(more).toBeTruthy();
			for (const action of actions) {
				expect(action.getBoundingClientRect().height).toBeCloseTo(expectedControlSize, 0);
			}
			expect(primary.getBoundingClientRect().right).toBeLessThanOrEqual(
				more.getBoundingClientRect().left,
			);
			const surface = primary.querySelector(':scope > .elevation-surface') as HTMLElement;
			const textRange = document.createRange();
			textRange.selectNodeContents(firstNonBlankTextNode(surface));
			const textRect = textRange.getBoundingClientRect();
			const surfaceRect = surface.getBoundingClientRect();
			expect(textRect.left).toBeGreaterThanOrEqual(surfaceRect.left + 2.5);
			expect(textRect.right).toBeLessThanOrEqual(surfaceRect.right - 2.5);
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
				expect(imageRect.bottom).toBeCloseTo(itemRect.bottom - 2, 0);
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
				expect(widths[1]).toBeCloseTo(widths[0]!, 0);
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
		'contains localized manager actions after stacking a 320px desktop container for $locale (received: $received)',
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
				expect(getComputedStyle(item).display).toBe('flex');
				expect(getComputedStyle(item).flexDirection).toBe('column');
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
					expect(actionRects[index]!.height).toBeCloseTo(actionRects[0]!.height, 0);
					expect(actionRects[index]!.height).toBeGreaterThanOrEqual(32);
					expect(actionRects[index]!.height).toBeLessThan(48);
					expect(actionRects[index]!.width).toBeCloseTo(
						index === 2 ? 32 : actionRects[0]!.width,
						0,
					);
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
			const imageRect = image.getBoundingClientRect();
			expect(getComputedStyle(item).flexDirection).toBe('column');
			expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
			expect(content.getBoundingClientRect().top).toBeGreaterThanOrEqual(imageRect.bottom);
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

	it('stacks the complete square image above content when actual narrow space is insufficient', async () => {
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
		expect(getComputedStyle(item).flexDirection).toBe('column');
		expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
		expect(content.getBoundingClientRect().top).toBeGreaterThanOrEqual(imageRect.bottom);
		expect(host.querySelector('[data-testid="reserve-button"]')).toBeTruthy();
		expect(host.querySelector('[data-testid="gift-more-actions"]')).toBeTruthy();
		host.remove();
	});
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
			if (viewport === 640) {
				expect(itemStyle.flexDirection).toBe('column');
				expect(contentRect.top).toBeGreaterThanOrEqual(imageRect.bottom);
			} else {
				expect(itemStyle.display).toBe('grid');
				expect(imageRect.bottom).toBeCloseTo(itemRect.bottom - 2, 0);
				expect(contentRect.left).toBeCloseTo(imageRect.right, 0);
			}
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
	it('stacks the mark-as-bought and cancel-reservation actions vertically at equal width', async () => {
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
		// Equal width: both get `w-full` inside the stacked column, matching the
		// widest label instead of each shrink-wrapping to its own text.
		expect(reserveRect.width).toBeCloseTo(purchasedRect.width, 1);
	});
});
