// Layout-invariant suite (issue #211): measures real computed geometry, so the compiled
// Tailwind utilities must be present (mirrors gift_detail_form.svelte.test.ts).
import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
import { IMAGE_FIT_MODES, type ImageMetadata } from '$lib/modules/images/index.js';
import * as m from '$lib/paraglide/messages.js';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';

// GiftImage transitively imports the images module barrel, which reads `$env/dynamic/public`.
// vitest-browser-svelte mounts without SvelteKit's page bootstrap, so the virtual module
// throws unless stubbed (same workaround as gift_detail_form.svelte.test.ts).
vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: GiftCardTestHost } = await import('./GiftCardTestHost.svelte');

// Realistic long multi-word Czech name (issue #211 REQ-2 fixture) – long enough to stress
// the footer/name rows in a way that mirrors real content. (An unbroken 90-char run is
// also safe here: `name`'s `line-clamp-2` implies `overflow: hidden`, which per the CSS
// Sizing spec zeroes the grid item's automatic minimum size on that axis, so it can't drag
// the card wider either — see GiftCard.stories.svelte's hostile-name fixture.)
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

type CssRgb = readonly [red: number, green: number, blue: number];

function parseCssRgb(value: string): CssRgb {
	const match = value.match(
		/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)$/,
	);
	if (!match) {
		throw new Error(`Expected a computed CSS rgb color, received: ${value}`);
	}
	return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function linearizeSrgbChannel(channel: number): number {
	const normalizedChannel = channel / 255;
	return normalizedChannel <= 0.04045
		? normalizedChannel / 12.92
		: ((normalizedChannel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([red, green, blue]: CssRgb): number {
	return (
		0.2126 * linearizeSrgbChannel(red) +
		0.7152 * linearizeSrgbChannel(green) +
		0.0722 * linearizeSrgbChannel(blue)
	);
}

function contrastRatio(firstColor: CssRgb, secondColor: CssRgb): number {
	const lighterLuminance = Math.max(
		relativeLuminance(firstColor),
		relativeLuminance(secondColor),
	);
	const darkerLuminance = Math.min(relativeLuminance(firstColor), relativeLuminance(secondColor));
	return (lighterLuminance + 0.05) / (darkerLuminance + 0.05);
}

function rectanglesIntersect(first: DOMRect, second: DOMRect): boolean {
	return (
		first.left < second.right &&
		first.right > second.left &&
		first.top < second.bottom &&
		first.bottom > second.top
	);
}

function hasVisibleBoxShadow(element: Element): boolean {
	const boxShadow = getComputedStyle(element).boxShadow;
	if (boxShadow === 'none') {
		return false;
	}
	const alphas = Array.from(boxShadow.matchAll(/rgba\([^)]*, ([\d.]+)\)/g), (match) =>
		Number(match[1]),
	);
	return alphas.length === 0 || alphas.some((alpha) => alpha > 0);
}

function textOutsideOverlay(host: HTMLElement): string {
	const clone = host.cloneNode(true) as HTMLElement;
	clone.querySelector('[data-testid="gift-state-overlay"]')?.remove();
	return clone.textContent ?? '';
}

function firstNonBlankTextNode(surface: HTMLElement): Text {
	const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
	let current = walker.nextNode();
	while (current !== null) {
		if ((current.textContent?.trim().length ?? 0) > 0) {
			return current as Text;
		}
		current = walker.nextNode();
	}
	throw new Error(
		`Expected a nonblank text node inside the direct elevation surface: ${surface.outerHTML}`,
	);
}

function expectRaisedActionShadowInside(action: HTMLElement, boundary: HTMLElement): void {
	const surface = action.querySelector(':scope > .elevation-surface') as HTMLElement;
	const surfaceStyle = getComputedStyle(surface);
	const shadowOffset = Number.parseFloat(
		surfaceStyle.getPropertyValue('--elevation-ordinary-offset'),
	);
	const surfaceRect = surface.getBoundingClientRect();
	const boundaryRect = boundary.getBoundingClientRect();

	expect(surfaceStyle.boxShadow).not.toBe('none');
	expect(shadowOffset).toBeGreaterThan(0);
	expect(surfaceRect.right + shadowOffset).toBeLessThanOrEqual(boundaryRect.right + 0.5);
	expect(surfaceRect.bottom + shadowOffset).toBeLessThanOrEqual(boundaryRect.bottom + 0.5);
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
		// REQ-1/2): both PurchasedToggle ("mark as bought") and ReserveButton ("cancel
		// reservation") render together – the exact case that overflowed.
		myReservationId: 'reservation-1',
		myReservationPurchasedAt: null,
		...overrides,
	};
}

/** Renders `GiftCardTestHost` inside a fixed-width host that mirrors the real
 *  `WishlistGiftCardGrid` column (`minmax(280px, 1fr)`), so the card sits in a
 *  constrained track the same way it does on the wishlist page. */
const fixedHosts = new Set<HTMLElement>();

async function renderCardInGridColumn(
	gift: GiftForVisitor,
	role: WishlistRole = WISHLIST_ROLES.visitor,
	theme: { palette: string; dark: boolean } = { palette: 'sky', dark: false },
) {
	const host = document.createElement('div');
	host.style.display = 'grid';
	host.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
	host.style.width = '280px';
	host.dataset.palette = theme.palette;
	host.classList.toggle('dark', theme.dark);
	document.body.appendChild(host);
	fixedHosts.add(host);

	await render(GiftCardTestHost, { gift, role, isArchived: false }, { baseElement: host });

	return host;
}

afterEach(() => {
	for (const host of fixedHosts) {
		host.remove();
	}
	fixedHosts.clear();
});

describe('GiftCard category badge (issue #265)', () => {
	it.each([
		{
			color: '#000000',
			expectedBackground: 'rgb(0, 0, 0)',
			expectedForeground: 'rgb(255, 255, 255)',
			palette: 'sky',
			dark: false,
		},
		{
			color: '#FFFFFF',
			expectedBackground: 'rgb(255, 255, 255)',
			expectedForeground: 'rgb(0, 0, 0)',
			palette: 'grape',
			dark: true,
		},
		{
			color: '#777777',
			expectedBackground: 'rgb(119, 119, 119)',
			expectedForeground: 'rgb(0, 0, 0)',
			palette: 'honey',
			dark: false,
		},
	])(
		'keeps $color readable in the $palette palette (dark: $dark)',
		async ({ color, expectedBackground, expectedForeground, palette, dark }) => {
			await page.viewport(800, 720);
			const label = 'Velmi dlouhá kategorie sportovního vybavení pro celou rodinu';
			const host = await renderCardInGridColumn(
				makeVisitorGift({
					categoryId: 'category-sport',
					category: {
						id: 'category-sport',
						presetKey: null,
						customLabel: label,
						color,
						sortOrder: 0,
					},
					isFullyReserved: true,
					received: true,
				}),
				WISHLIST_ROLES.moderator,
				{ palette, dark },
			);

			const badge = host.querySelector('[data-testid="gift-category-badge"]') as HTMLElement;
			const imageFrame = host.querySelector(
				'[data-testid="gift-card-image-frame"]',
			) as HTMLElement;
			expect(badge).toBeTruthy();
			expect(imageFrame).toBeTruthy();
			expect(host.getBoundingClientRect().width).toBeCloseTo(280, 1);
			expect(badge.title).toBe(label);
			expect(badge.className).toContain('truncate');
			const style = getComputedStyle(badge);
			expect(style.backgroundColor).toBe(expectedBackground);
			expect(style.color).toBe(expectedForeground);
			expect(
				contrastRatio(parseCssRgb(style.backgroundColor), parseCssRgb(style.color)),
			).toBeGreaterThanOrEqual(4.5);
			expect(style.rotate).not.toBe('none');
			expect(Number.parseFloat(style.rotate)).toBeLessThan(0);

			const badgeRect = badge.getBoundingClientRect();
			const imageFrameRect = imageFrame.getBoundingClientRect();
			expect(imageFrameRect.width / imageFrameRect.height).toBeCloseTo(4 / 3, 2);
			const overlayRects = Array.from(
				host.querySelectorAll<HTMLElement>('[data-testid="gift-state-overlay"] > span'),
				(pill) => pill.getBoundingClientRect(),
			);
			const overlaps = (a: DOMRect, b: DOMRect) =>
				a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
			expect(badgeRect.left).toBeGreaterThanOrEqual(imageFrameRect.left);
			expect(badgeRect.top).toBeGreaterThanOrEqual(imageFrameRect.top);
			expect(badgeRect.right).toBeLessThanOrEqual(imageFrameRect.right);
			expect(badgeRect.bottom).toBeLessThanOrEqual(imageFrameRect.bottom);
			expect(badgeRect.left + badgeRect.width / 2).toBeLessThan(
				imageFrameRect.left + imageFrameRect.width / 2,
			);
			expect(badgeRect.top + badgeRect.height / 2).toBeLessThan(
				imageFrameRect.top + imageFrameRect.height / 2,
			);
			for (const overlayRect of overlayRects) {
				expect(overlaps(badgeRect, overlayRect)).toBe(false);
			}
		},
	);

	it('hides a moderator gift category only in contextual mode while preserving state and body details', async () => {
		await page.viewport(800, 720);
		const categorizedGift = makeVisitorGift({
			received: true,
			quantity: 3,
			reservedCount: 3,
			isFullyReserved: true,
			myReservationId: null,
			reserverNames: ['Babička'],
			categoryId: 'category-sport',
			category: {
				id: 'category-sport',
				presetKey: null,
				customLabel: 'Sport',
				color: '#0369A1',
				sortOrder: 0,
			},
		});
		const normalHost = await renderCardInGridColumn(categorizedGift, WISHLIST_ROLES.moderator);
		const contextualHost = document.createElement('div');
		contextualHost.style.width = '280px';
		document.body.appendChild(contextualHost);
		fixedHosts.add(contextualHost);
		await render(
			GiftCardTestHost,
			{
				gift: categorizedGift,
				role: WISHLIST_ROLES.moderator,
				contextualMode: true,
			},
			{ baseElement: contextualHost },
		);

		expect(normalHost.querySelector('[data-testid="gift-category-badge"]')).toBeTruthy();
		expect(contextualHost.querySelector('[data-testid="gift-category-badge"]')).toBeNull();
		const overlay = contextualHost.querySelector(
			'[data-testid="gift-state-overlay"]',
		) as HTMLElement;
		expect(overlay.querySelector('[data-state-primary]')?.textContent).toBe(
			m.gift_received_badge(),
		);
		expect(textOutsideOverlay(contextualHost)).toContain('Babička');
	});

	it('renders no category badge while keeping the unchanged image frame for an uncategorized gift', async () => {
		const host = await renderCardInGridColumn(makeVisitorGift());
		expect(host.querySelector('[data-testid="gift-category-badge"]')).toBeNull();
		expect(
			host.querySelector(
				'[data-testid="gift-card-image-frame"] > [data-testid="image-frame"]',
			),
		).toBeTruthy();
	});
});

describe('GiftCard image background fill (issue #252)', () => {
	it('paints the visible outer card frame with explicit black and removes the pattern', async () => {
		const host = await renderCardInGridColumn(
			makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta('#000000') }),
		);

		const cardFrame = host.querySelector(
			'[data-testid="gift-card-image-frame"]',
		) as HTMLElement;
		const imageFrame = cardFrame.querySelector('[data-testid="image-frame"]') as HTMLElement;

		expect(cardFrame).toBeTruthy();
		expect(imageFrame).toBeTruthy();
		expect(getComputedStyle(cardFrame).backgroundColor).toBe('rgb(0, 0, 0)');
		expect(getComputedStyle(imageFrame).backgroundColor).toBe('rgb(0, 0, 0)');
		expect(cardFrame.querySelector('[data-testid="gift-card-image-pattern"]')).toBeNull();
	});

	it.each([null, 'transparent'])('keeps the pattern for default %s fill', async (bgColor) => {
		const host = await renderCardInGridColumn(
			makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta(bgColor) }),
		);

		const cardFrame = host.querySelector(
			'[data-testid="gift-card-image-frame"]',
		) as HTMLElement;
		expect(cardFrame).toBeTruthy();
		expect(cardFrame.querySelector('[data-testid="gift-card-image-pattern"]')).toBeTruthy();
	});

	it('removes only the mobile Fit mat padding while preserving desktop framing', async () => {
		await page.viewport(390, 720);
		const host = await renderCardInGridColumn(
			makeVisitorGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta('#ffffff') }),
		);
		const image = host.querySelector('img') as HTMLImageElement;
		const frame = host.querySelector('[data-testid="image-frame"]') as HTMLElement;
		const outerFrame = host.querySelector(
			'[data-testid="gift-card-image-frame"]',
		) as HTMLElement;

		expect(getComputedStyle(image).padding).toBe('0px');
		expect(frame.getBoundingClientRect().width).toBeCloseTo(outerFrame.clientWidth, 0);
		expect(frame.getBoundingClientRect().height).toBeCloseTo(outerFrame.clientHeight, 0);
		await page.viewport(800, 720);
		expect(getComputedStyle(image).padding).toBe('8px');
	});
});

describe('GiftCard unified state presentation (issues #328 and #330)', () => {
	it.each([
		['available', { reservedCount: 0, isFullyReserved: false, myReservationId: null }],
		[
			'partial',
			{ quantity: 3, reservedCount: 1, isFullyReserved: false, myReservationId: null },
		],
		['fully reserved', { reservedCount: 1, isFullyReserved: true, myReservationId: null }],
		['own reserved', { reservedCount: 1, isFullyReserved: true, myReservationId: 'mine' }],
		['received', { received: true, reservedCount: 1, isFullyReserved: true }],
	])(
		'anchors the normal Like to the image clear of footer actions when %s',
		async (_state, overrides) => {
			await page.viewport(390, 720);
			const host = document.createElement('div');
			host.style.width = '179px';
			document.body.appendChild(host);
			fixedHosts.add(host);
			await render(
				GiftCardTestHost,
				{
					gift: makeVisitorGift({ likeCount: 12, ...overrides }),
					role: WISHLIST_ROLES.moderator,
					onreceived: () => {},
					onmore: () => {},
				},
				{ baseElement: host },
			);

			const image = host.querySelector(
				'[data-testid="gift-card-image-frame"]',
			) as HTMLElement;
			const footer = host.querySelector('[data-testid="gift-card-footer"]') as HTMLElement;
			const like = host
				.querySelector('[data-like-heart]')
				?.closest('button') as HTMLButtonElement;
			const likeRect = like.getBoundingClientRect();
			const imageRect = image.getBoundingClientRect();
			const footerRect = footer.getBoundingClientRect();
			const intersectionArea = (a: DOMRect, b: DOMRect) =>
				Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
				Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

			expect(likeRect.left).toBeGreaterThanOrEqual(imageRect.left);
			expect(likeRect.right).toBeLessThanOrEqual(imageRect.right);
			expect(likeRect.top).toBeGreaterThanOrEqual(imageRect.top);
			expect(likeRect.bottom).toBeLessThanOrEqual(imageRect.bottom);
			expect(intersectionArea(likeRect, footerRect)).toBe(0);
			for (const action of footer.querySelectorAll<HTMLButtonElement>('button')) {
				if (action !== like) {
					expect(intersectionArea(likeRect, action.getBoundingClientRect())).toBe(0);
				}
			}
		},
	);

	it('reserves a collision-free image region between the top-right Like and every centered state label', async () => {
		await page.viewport(320, 720);
		const states: Partial<GiftForVisitor>[] = [
			{ quantity: 3, reservedCount: 1, isFullyReserved: false, myReservationId: null },
			{ reservedCount: 1, isFullyReserved: true, myReservationId: null },
			{ reservedCount: 1, isFullyReserved: true, myReservationId: 'mine' },
			{ received: true, reservedCount: 1, isFullyReserved: true, myReservationId: 'mine' },
		];

		for (const [index, overrides] of states.entries()) {
			const host = document.createElement('div');
			host.style.width = '144px';
			document.body.appendChild(host);
			fixedHosts.add(host);
			await render(
				GiftCardTestHost,
				{
					gift: makeVisitorGift({
						id: `gift-state-${index}`,
						likeCount: 12,
						...overrides,
					}),
					role: WISHLIST_ROLES.visitor,
					onmore: () => {},
				},
				{ baseElement: host },
			);

			const likeParts = host.querySelectorAll<HTMLElement>(
				'[data-like-heart], [data-like-count]',
			);
			const pills = host.querySelectorAll<HTMLElement>(
				'[data-testid="gift-state-overlay"] > span',
			);
			for (const pill of pills) {
				const pillRect = pill.getBoundingClientRect();
				for (const likePart of likeParts) {
					const likePartRect = likePart.getBoundingClientRect();
					expect(
						rectanglesIntersect(likePartRect, pillRect),
						`state ${index}; like ${JSON.stringify(likePartRect.toJSON())}; pill ${JSON.stringify(pillRect.toJSON())}`,
					).toBe(false);
				}
			}
		}
	});

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
				expect(reserve.getBoundingClientRect().right).toBeLessThanOrEqual(
					primary.getBoundingClientRect().left,
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
