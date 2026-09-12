import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import {
	CreateGiftInputSchema,
	UpdateGiftInputSchema,
	GIFT_CURRENCY_VALUES,
	GiftPriceSchema,
} from './gifts/types.js';

function parseSuccess(
	schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
	input: unknown,
) {
	return v.safeParse(schema, input);
}

describe('GiftPriceSchema', () => {
	it.each([0, 2.01, 4_935_710_322.64, 1e2, 1e-2, 9_999_999_999.99])(
		'accepts persistence-safe price %s',
		(price) => {
			expect(v.safeParse(GiftPriceSchema, price).success).toBe(true);
		},
	);

	it.each([2.011, 19.999, 999_998.990_001, 1e-7])(
		'rejects price %s with more than two canonical decimal places',
		(price) => {
			expect(v.safeParse(GiftPriceSchema, price).success).toBe(false);
		},
	);

	it.each([Number.POSITIVE_INFINITY, Number.NaN, -0.01, 10_000_000_000])(
		'rejects non-finite or out-of-range price %s',
		(price) => {
			expect(v.safeParse(GiftPriceSchema, price).success).toBe(false);
		},
	);
});

describe('CreateGiftInputSchema', () => {
	it('rejects caller-supplied sortOrder because append ordering is server-owned', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			sortOrder: 99,
		});

		expect(result.success).toBe(false);
	});

	it('accepts valid input with required fields only', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty gift name', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: '',
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('rejects whitespace-only gift name (trimmed to empty)', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: '   ',
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('rejects a link with an invalid URL format', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			links: [{ url: 'not-a-url' }],
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('accepts links with valid URLs and optional labels', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			links: [
				{ url: 'https://example.com/product' },
				{ url: 'https://other.example.com/product', label: 'Alternative' },
			],
		});
		expect(result.success).toBe(true);
	});

	it('accepts null links', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			links: null,
		});
		expect(result.success).toBe(true);
	});

	it('rejects more than 10 links', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			links: Array.from({ length: 11 }, (_, i) => ({ url: `https://example.com/${i}` })),
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('rejects negative price', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			price: -1,
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('accepts zero price', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			price: 0,
		});
		expect(result.success).toBe(true);
	});

	it('accepts a finite non-negative decimal price (issue #250 REQ-1)', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			price: 19.5,
			currency: 'EUR',
		});
		expect(result.success).toBe(true);
	});

	it('rejects quantity of 0', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			quantity: 0,
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('rejects non-integer quantity (e.g., 1.5)', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			quantity: 1.5,
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('accepts quantity of 1', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			quantity: 1,
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid currency', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			currency: 'GBP',
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('accepts all valid currencies (CZK, EUR, USD)', () => {
		for (const currency of GIFT_CURRENCY_VALUES) {
			const result = parseSuccess(CreateGiftInputSchema, {
				wishlistId: 'wl-1',
				name: 'Nice Book',
				currency,
			});
			expect(result.success, `currency "${currency}" should be valid`).toBe(true);
		}
	});

	it('accepts null currency', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			currency: null,
		});
		expect(result.success).toBe(true);
	});

	// Issue #155 REQ-4: price_max is an additive, optional range upper bound.
	describe('priceMax (price range)', () => {
		it('accepts a valid range (priceMax >= price)', () => {
			const result = parseSuccess(CreateGiftInputSchema, {
				wishlistId: 'wl-1',
				name: 'Nice Book',
				price: 1200,
				priceMax: 1500,
			});
			expect(result.success).toBe(true);
		});

		it('accepts decimal range bounds (issue #250 REQ-4)', () => {
			const result = parseSuccess(CreateGiftInputSchema, {
				wishlistId: 'wl-1',
				name: 'Nice Book',
				price: 19.5,
				priceMax: 29.95,
				currency: 'EUR',
			});
			expect(result.success).toBe(true);
		});

		it('accepts equal bounds (priceMax === price)', () => {
			const result = parseSuccess(CreateGiftInputSchema, {
				wishlistId: 'wl-1',
				name: 'Nice Book',
				price: 1000,
				priceMax: 1000,
			});
			expect(result.success).toBe(true);
		});

		it('accepts a gift without priceMax (single price, unaffected)', () => {
			const result = parseSuccess(CreateGiftInputSchema, {
				wishlistId: 'wl-1',
				name: 'Nice Book',
				price: 1000,
			});
			expect(result.success).toBe(true);
		});

		it('accepts null priceMax', () => {
			const result = parseSuccess(CreateGiftInputSchema, {
				wishlistId: 'wl-1',
				name: 'Nice Book',
				price: 1000,
				priceMax: null,
			});
			expect(result.success).toBe(true);
		});

		it('rejects priceMax below price', () => {
			const result = parseSuccess(CreateGiftInputSchema, {
				wishlistId: 'wl-1',
				name: 'Nice Book',
				price: 1500,
				priceMax: 1200,
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it('rejects a negative priceMax', () => {
			const result = parseSuccess(CreateGiftInputSchema, {
				wishlistId: 'wl-1',
				name: 'Nice Book',
				priceMax: -1,
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it('accepts priceMax without price (both-bounds rule is enforced by the form, not the wire schema)', () => {
			const result = parseSuccess(CreateGiftInputSchema, {
				wishlistId: 'wl-1',
				name: 'Nice Book',
				priceMax: 1500,
			});
			expect(result.success).toBe(true);
		});
	});
});

describe('CreateGiftInputSchema – image metadata', () => {
	it('accepts a gift with valid image metadata', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Camera',
			imageKey: 'gifts/camera.jpg',
			imageMeta: { fitMode: 'cover-crop', focal: { x: 60, y: 40 }, zoom: 1.5 },
		});
		expect(result.success).toBe(true);
	});

	it('accepts null image metadata', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Camera',
			imageMeta: null,
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid image metadata on a gift', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Camera',
			imageMeta: { fitMode: 'auto', zoom: 99 },
		});
		expect(result.success).toBe(false);
	});
});

describe('UpdateGiftInputSchema – image metadata', () => {
	it('accepts updating only image metadata', () => {
		const result = parseSuccess(UpdateGiftInputSchema, {
			id: 'gift-1',
			imageMeta: { fitMode: 'contain-padded' },
		});
		expect(result.success).toBe(true);
	});
});

// Issue #155 REQ-4: same cross-field rule as CreateGiftInputSchema, applied to the partial
// update shape (fields absent from the payload are simply skipped by the check).
describe('UpdateGiftInputSchema – priceMax (price range)', () => {
	it('accepts a valid range update', () => {
		const result = parseSuccess(UpdateGiftInputSchema, {
			id: 'gift-1',
			price: 1200,
			priceMax: 1500,
		});
		expect(result.success).toBe(true);
	});

	it('rejects priceMax below price', () => {
		const result = parseSuccess(UpdateGiftInputSchema, {
			id: 'gift-1',
			price: 1500,
			priceMax: 1200,
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('accepts clearing the range back to a single price (priceMax: null)', () => {
		const result = parseSuccess(UpdateGiftInputSchema, {
			id: 'gift-1',
			price: 1000,
			priceMax: null,
		});
		expect(result.success).toBe(true);
	});

	it('accepts updating only priceMax without price present', () => {
		const result = parseSuccess(UpdateGiftInputSchema, {
			id: 'gift-1',
			priceMax: 1500,
		});
		expect(result.success).toBe(true);
	});
});
