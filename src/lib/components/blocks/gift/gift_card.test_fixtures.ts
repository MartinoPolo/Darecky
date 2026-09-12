// Layout-invariant suite (issue #211): measures real computed geometry, so the compiled
// Tailwind utilities must be present (mirrors gift_detail_form.svelte.test.ts).
import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { expect, vi } from 'vitest';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
import { IMAGE_FIT_MODES, type ImageMetadata } from '$lib/modules/images/index.js';

// GiftImage transitively imports the images module barrel, which reads `$env/dynamic/public`.
// vitest-browser-svelte mounts without SvelteKit's page bootstrap, so the virtual module
// throws unless stubbed (same workaround as gift_detail_form.svelte.test.ts).
vi.mock('$env/dynamic/public', () => ({ env: {} }));

export const { default: GiftCardTestHost } = await import('./GiftCardTestHost.svelte');

// Realistic long multi-word Czech name (issue #211 REQ-2 fixture) – long enough to stress
// the footer/name rows in a way that mirrors real content. (An unbroken 90-char run is
// also safe here: `name`'s `line-clamp-2` implies `overflow: hidden`, which per the CSS
// Sizing spec zeroes the grid item's automatic minimum size on that axis, so it can't drag
// the card wider either — see GiftCard.stories.svelte's hostile-name fixture.)
export const REALISTIC_LONG_NAME =
	'Bezdrátová herní myš s RGB podsvícením a vyměnitelnými tlačítky pro praváky i leváky';
export const IMAGE_URL =
	'data:image/svg+xml,' +
	encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="64"/>');

export function imageMeta(bgColor: string | null): ImageMetadata {
	return {
		fitMode: IMAGE_FIT_MODES.containPadded,
		cropRect: null,
		focal: { x: 50, y: 50 },
		zoom: 1,
		bgColor,
	};
}

export function parseCssRgb(color: string): [number, number, number] {
	const channels = color
		.match(/[\d.]+/g)
		?.slice(0, 3)
		.map(Number);
	if (!channels || channels.length !== 3) {
		throw new Error(`Expected an RGB color, received: ${color}`);
	}
	return channels as [number, number, number];
}

export function contrastRatio(
	first: [number, number, number],
	second: [number, number, number],
): number {
	const luminance = ([red, green, blue]: [number, number, number]) => {
		const [r, g, b] = [red, green, blue].map((channel) => {
			const normalized = channel / 255;
			return normalized <= 0.04045
				? normalized / 12.92
				: ((normalized + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const firstLuminance = luminance(first);
	const secondLuminance = luminance(second);
	return (
		(Math.max(firstLuminance, secondLuminance) + 0.05) /
		(Math.min(firstLuminance, secondLuminance) + 0.05)
	);
}

export function rectanglesIntersect(first: DOMRect, second: DOMRect): boolean {
	return (
		first.left < second.right &&
		first.right > second.left &&
		first.top < second.bottom &&
		first.bottom > second.top
	);
}

export function hasVisibleBoxShadow(element: Element): boolean {
	const boxShadow = getComputedStyle(element).boxShadow;
	if (boxShadow === 'none') {
		return false;
	}
	const alphas = Array.from(boxShadow.matchAll(/rgba\([^)]*, ([\d.]+)\)/g), (match) =>
		Number(match[1]),
	);
	return alphas.length === 0 || alphas.some((alpha) => alpha > 0);
}

export function textOutsideOverlay(host: HTMLElement): string {
	const clone = host.cloneNode(true) as HTMLElement;
	clone.querySelector('[data-testid="gift-state-overlay"]')?.remove();
	return clone.textContent ?? '';
}

export function firstNonBlankTextNode(surface: HTMLElement): Text {
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

export function expectRaisedActionShadowInside(action: HTMLElement, boundary: HTMLElement): void {
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

export function makeVisitorGift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
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
export const fixedHosts = new Set<HTMLElement>();

export async function renderCardInGridColumn(
	gift: GiftForVisitor,
	role: WishlistRole = WISHLIST_ROLES.visitor,
	theme: { palette: string; dark: boolean } = { palette: 'sky', dark: false },
): Promise<HTMLElement> {
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

export function cleanupCardHosts(): void {
	for (const host of fixedHosts) {
		host.remove();
	}
	fixedHosts.clear();
}
