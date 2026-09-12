import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import { ReserveGiftInputSchema } from './reservations/types.js';
import {
	ImageMetadataSchema,
	WishlistImageSlotsSchema,
	IMAGE_FIT_MODE_VALUES,
} from './images/types.js';

function parseSuccess(
	schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
	input: unknown,
) {
	return v.safeParse(schema, input);
}

describe('ReserveGiftInputSchema', () => {
	it('accepts valid reservation', () => {
		const result = parseSuccess(ReserveGiftInputSchema, {
			giftId: 'gift-1',
			quantity: 2,
		});
		expect(result.success).toBe(true);
	});

	it('rejects quantity of 0', () => {
		const result = parseSuccess(ReserveGiftInputSchema, {
			giftId: 'gift-1',
			quantity: 0,
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('rejects negative quantity', () => {
		const result = parseSuccess(ReserveGiftInputSchema, {
			giftId: 'gift-1',
			quantity: -3,
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('rejects non-integer quantity', () => {
		const result = parseSuccess(ReserveGiftInputSchema, {
			giftId: 'gift-1',
			quantity: 2.7,
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('accepts quantity of 1', () => {
		const result = parseSuccess(ReserveGiftInputSchema, {
			giftId: 'gift-1',
			quantity: 1,
		});
		expect(result.success).toBe(true);
	});

	it('accepts optional anonymous fields', () => {
		const result = parseSuccess(ReserveGiftInputSchema, {
			giftId: 'gift-1',
			quantity: 1,
			anonymousName: 'Jane',
			anonymousEmail: 'jane@example.com',
		});
		expect(result.success).toBe(true);
	});

	it('accepts reservation without anonymous fields', () => {
		const result = parseSuccess(ReserveGiftInputSchema, {
			giftId: 'gift-1',
			quantity: 3,
		});
		expect(result.success).toBe(true);
	});
});

describe('ImageMetadataSchema', () => {
	it('accepts metadata with only the required fit mode', () => {
		const result = parseSuccess(ImageMetadataSchema, { fitMode: 'auto' });
		expect(result.success).toBe(true);
	});

	it('accepts every valid fit mode', () => {
		for (const fitMode of IMAGE_FIT_MODE_VALUES) {
			const result = parseSuccess(ImageMetadataSchema, { fitMode });
			expect(result.success, `fitMode "${fitMode}" should be valid`).toBe(true);
		}
	});

	it('rejects an unknown fit mode', () => {
		const result = parseSuccess(ImageMetadataSchema, { fitMode: 'stretch' });
		expect(result.success).toBe(false);
	});

	it('accepts a fully specified metadata object', () => {
		const result = parseSuccess(ImageMetadataSchema, {
			fitMode: 'cover-crop',
			cropRect: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 },
			focal: { x: 50, y: 40 },
			zoom: 2,
			bgColor: '#ffffff',
		});
		expect(result.success).toBe(true);
	});

	it('accepts null cropRect and null bgColor', () => {
		const result = parseSuccess(ImageMetadataSchema, {
			fitMode: 'auto',
			cropRect: null,
			bgColor: null,
		});
		expect(result.success).toBe(true);
	});

	it('accepts a zoomed-out crop rectangle extending past the image (#116 round 2)', () => {
		const result = parseSuccess(ImageMetadataSchema, {
			fitMode: 'cover-crop',
			cropRect: { x: -0.25, y: 0, w: 1.5, h: 1 },
			targets: {
				card: {
					cropRect: { x: -0.125, y: 0.1875, w: 1.25, h: 0.625 },
					focal: { x: 50, y: 50 },
					zoom: 0.8,
				},
			},
		});
		expect(result.success).toBe(true);
	});

	it('rejects a crop rectangle beyond the zoom-out floor bounds', () => {
		const result = parseSuccess(ImageMetadataSchema, {
			fitMode: 'cover-crop',
			cropRect: { x: 0, y: 0, w: 25, h: 1 },
		});
		expect(result.success).toBe(false);
	});

	it('rejects a focal point outside the 0..100 percent range', () => {
		const result = parseSuccess(ImageMetadataSchema, {
			fitMode: 'cover-crop',
			focal: { x: 120, y: 50 },
		});
		expect(result.success).toBe(false);
	});

	it('accepts a zoomed-out factor down to the letterbox floor (#116 round 2)', () => {
		const result = parseSuccess(ImageMetadataSchema, { fitMode: 'cover-crop', zoom: 0.5 });
		expect(result.success).toBe(true);
	});

	it('rejects a zoom factor below the zoom-out floor', () => {
		const result = parseSuccess(ImageMetadataSchema, { fitMode: 'cover-crop', zoom: 0.01 });
		expect(result.success).toBe(false);
	});

	it('rejects a zoom factor above the maximum', () => {
		const result = parseSuccess(ImageMetadataSchema, { fitMode: 'cover-crop', zoom: 4 });
		expect(result.success).toBe(false);
	});
});

describe('WishlistImageSlotsSchema', () => {
	it('accepts an empty slots object', () => {
		const result = parseSuccess(WishlistImageSlotsSchema, {});
		expect(result.success).toBe(true);
	});

	it('accepts per-slot metadata for all four slots', () => {
		const result = parseSuccess(WishlistImageSlotsSchema, {
			card: { fitMode: 'cover-crop', focal: { x: 50, y: 40 } },
			thumbnail: { fitMode: 'cover-crop' },
			banner: { fitMode: 'contain-padded', cropRect: { x: 0, y: 0.1, w: 1, h: 0.5 } },
			social: { fitMode: 'auto', bgColor: '#0b3d2e' },
		});
		expect(result.success).toBe(true);
	});

	it('rejects a slot carrying invalid metadata', () => {
		const result = parseSuccess(WishlistImageSlotsSchema, {
			card: { fitMode: 'bogus' },
		});
		expect(result.success).toBe(false);
	});
});
