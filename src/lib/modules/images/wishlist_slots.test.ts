import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as v from 'valibot';

// ── Hoisted mock state (available inside vi.mock factories) ─────────────────
const { mockEnv } = vi.hoisted(() => {
	const mockEnv: Record<string, string | undefined> = {};
	return { mockEnv };
});

vi.mock('$env/dynamic/public', () => ({
	env: new Proxy(mockEnv, {
		get: (_target, prop: string) => mockEnv[prop],
	}),
}));

import {
	wishlistImageUrl,
	createDefaultWishlistSlots,
	wishlistSlotToFrameProps,
	socialSlotFocalPoint,
	wishlistSocialImageUrl,
} from './wishlist_slots.js';
import { WISHLIST_EDITOR_SLOTS } from './crop_targets.js';
import { WishlistImageSlotsSchema, type WishlistImageSlots } from './types.js';
import { IMAGE_FIT_MODES } from '$lib/components/derived/image-frame/index.js';

const PUBLIC_BASE = 'https://images.example.com';
const FALLBACK = 'https://prejemesi.cz/social-preview.png';

beforeEach(() => {
	for (const key of Object.keys(mockEnv)) {
		delete mockEnv[key];
	}
});

describe('wishlistImageUrl', () => {
	it('returns null for an unset image key', () => {
		expect(wishlistImageUrl(null)).toBeNull();
		expect(wishlistImageUrl(undefined)).toBeNull();
		expect(wishlistImageUrl('')).toBeNull();
	});

	it('resolves an object key to the same-origin upload route', () => {
		expect(wishlistImageUrl('wishlists/banners/abc.jpg')).toBe(
			'/api/upload/wishlists/banners/abc.jpg',
		);
	});
});

describe('createDefaultWishlistSlots', () => {
	it('seeds every editor slot with centered cover-crop metadata', () => {
		const slots = createDefaultWishlistSlots();
		for (const slot of WISHLIST_EDITOR_SLOTS) {
			const meta = slots[slot];
			expect(meta).toBeDefined();
			expect(meta?.fitMode).toBe(IMAGE_FIT_MODES.coverCrop);
			expect(meta?.focal).toEqual({ x: 50, y: 50 });
		}
	});

	it('does not seed the orphan banner slot (#116 D3)', () => {
		expect(createDefaultWishlistSlots().banner).toBeUndefined();
	});

	it('produces metadata that validates against the persisted schema', () => {
		const slots = createDefaultWishlistSlots();
		expect(() => v.parse(WishlistImageSlotsSchema, slots)).not.toThrow();
	});

	it('returns independent metadata objects per slot (editing one never mutates another)', () => {
		const slots = createDefaultWishlistSlots();
		expect(slots.card).not.toBe(slots.thumbnail);
	});
});

describe('wishlistSlotToFrameProps', () => {
	it('falls back to renderer defaults when the slot is unset', () => {
		expect(wishlistSlotToFrameProps(null, 'card')).toEqual({
			fitMode: IMAGE_FIT_MODES.auto,
			focal: { x: 50, y: 50 },
			zoom: 1,
			fillColor: null,
		});
		expect(wishlistSlotToFrameProps({}, 'banner')).toEqual({
			fitMode: IMAGE_FIT_MODES.auto,
			focal: { x: 50, y: 50 },
			zoom: 1,
			fillColor: null,
		});
	});

	it('selects each slot independently and still renders retained banner data', () => {
		const slots: WishlistImageSlots = {
			card: {
				fitMode: IMAGE_FIT_MODES.coverCrop,
				focal: { x: 10, y: 10 },
				zoom: 1,
			},
			banner: {
				fitMode: IMAGE_FIT_MODES.containPadded,
				focal: { x: 90, y: 90 },
				zoom: 1,
			},
		};
		expect(wishlistSlotToFrameProps(slots, 'card').focal).toEqual({ x: 10, y: 10 });
		expect(wishlistSlotToFrameProps(slots, 'banner').fitMode).toBe(
			IMAGE_FIT_MODES.containPadded,
		);
	});
});

describe('socialSlotFocalPoint', () => {
	it('returns the centered default when no slots are set (issue #117)', () => {
		expect(socialSlotFocalPoint(null)).toEqual({ x: 50, y: 50 });
		expect(socialSlotFocalPoint(undefined)).toEqual({ x: 50, y: 50 });
		expect(socialSlotFocalPoint({})).toEqual({ x: 50, y: 50 });
	});

	it("reads the social slot's own focal point, independent of other slots", () => {
		const slots: WishlistImageSlots = {
			card: { fitMode: IMAGE_FIT_MODES.coverCrop, focal: { x: 10, y: 10 }, zoom: 1 },
			social: { fitMode: IMAGE_FIT_MODES.coverCrop, focal: { x: 80, y: 20 }, zoom: 1.5 },
		};
		expect(socialSlotFocalPoint(slots)).toEqual({ x: 80, y: 20 });
	});
});

describe('wishlistSocialImageUrl', () => {
	it('returns the fallback preview when no image is assigned (issue #117)', () => {
		expect(wishlistSocialImageUrl(null, null, FALLBACK)).toBe(FALLBACK);
		expect(wishlistSocialImageUrl(undefined, undefined, FALLBACK)).toBe(FALLBACK);
		expect(wishlistSocialImageUrl('', {}, FALLBACK)).toBe(FALLBACK);
	});

	it("crops the assigned image to the social slot's saved focal point", () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;
		const slots: WishlistImageSlots = {
			social: { fitMode: IMAGE_FIT_MODES.coverCrop, focal: { x: 30, y: 70 }, zoom: 1 },
		};

		expect(wishlistSocialImageUrl('wishlists/a.jpg', slots, FALLBACK)).toBe(
			`${PUBLIC_BASE}/cdn-cgi/image/width=1200,height=630,fit=cover,gravity=0.30x0.70,format=jpeg/wishlists/a.jpg`,
		);
	});

	it('falls back to a centered crop when an image is assigned but the social slot is unset', () => {
		mockEnv['PUBLIC_R2_URL'] = PUBLIC_BASE;

		expect(wishlistSocialImageUrl('wishlists/a.jpg', {}, FALLBACK)).toBe(
			`${PUBLIC_BASE}/cdn-cgi/image/width=1200,height=630,fit=cover,gravity=0.50x0.50,format=jpeg/wishlists/a.jpg`,
		);
	});
});
