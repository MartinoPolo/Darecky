import { render } from 'vitest-browser-svelte';
import { expect, vi } from 'vitest';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { IMAGE_FIT_MODES, type ImageMetadata } from '$lib/modules/images/index.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

export const { default: GiftListItemTestHost } = await import('./GiftListItemTestHost.svelte');

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
		// REQ-1/2): both PurchasedToggle and ReserveButton render together.
		myReservationId: 'reservation-1',
		myReservationPurchasedAt: null,
		...overrides,
	};
}

export async function renderItem(
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

export function firstNonBlankTextNode(element: HTMLElement): Text {
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

export function expectRaisedActionShadowInside(action: HTMLElement, boundary: HTMLElement): void {
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
