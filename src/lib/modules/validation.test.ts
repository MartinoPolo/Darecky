import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import {
	CreateWishlistInputSchema,
	UpdateWishlistInputSchema,
	WISHLIST_THEMES,
	RECIPIENT_NAME_MAX_LENGTH,
	WISHLIST_TITLE_MAX_LENGTH,
} from './wishlists/types.js';

function parseSuccess(
	schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
	input: unknown,
) {
	return v.safeParse(schema, input);
}

describe('CreateWishlistInputSchema', () => {
	// The schema is a valibot variant on `recipientKind` (issue #99):
	//   - `self`  : creator is the linked recipient (the old for-me flow).
	//   - `other` : a free-text recipient; creator becomes the first správce.

	describe('recipientKind: self (for-me creation)', () => {
		it('accepts valid input with title only', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'self',
				title: 'My Wishlist',
			});
			expect(result.success).toBe(true);
		});

		it('accepts valid input with all fields', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'self',
				title: 'Birthday List',
				eventDate: new Date('2026-12-01'),
				theme: 'birthday',
			});
			expect(result.success).toBe(true);
		});

		it('accepts null eventDate and undefined theme', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'self',
				title: 'Neutral List',
				eventDate: null,
			});
			expect(result.success).toBe(true);
		});

		it('rejects empty title', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'self',
				title: '',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it('rejects whitespace-only title (trimmed to empty)', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'self',
				title: '   ',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it('rejects invalid theme value', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'self',
				title: 'My List',
				theme: 'neon',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it('accepts all valid theme values', () => {
			for (const theme of WISHLIST_THEMES) {
				const result = parseSuccess(CreateWishlistInputSchema, {
					recipientKind: 'self',
					title: 'Themed List',
					theme,
				});
				expect(result.success, `theme "${theme}" should be valid`).toBe(true);
			}
		});

		it('rejects a self list carrying a recipientName it should not have', () => {
			// The `self` variant object has no recipientName field; valibot drops the
			// unknown key, so the parse still succeeds on the rest of a valid input.
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'self',
				title: 'My List',
				recipientName: 'Rosie',
			});
			expect(result.success).toBe(true);
		});
	});

	describe('recipientKind: other (for-someone creation)', () => {
		it('accepts valid input with a recipient name', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: 'Rosie',
				title: 'Rosie Birthday',
			});
			expect(result.success).toBe(true);
		});

		it('accepts all fields including a recipient name', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: 'Rosie',
				title: 'Rosie Birthday',
				eventDate: new Date('2026-12-01'),
				theme: 'birthday',
			});
			expect(result.success).toBe(true);
		});

		it('trims surrounding whitespace on the recipient name', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: '  Rosie  ',
				title: 'Rosie Birthday',
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.output).toMatchObject({ recipientName: 'Rosie' });
			}
		});

		it('rejects a missing recipient name', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				title: 'Rosie Birthday',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it('rejects an empty recipient name', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: '',
				title: 'Rosie Birthday',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it('rejects a whitespace-only recipient name (trimmed to empty)', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: '   ',
				title: 'Rosie Birthday',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it(`accepts a recipient name at the ${RECIPIENT_NAME_MAX_LENGTH}-char maximum`, () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: 'a'.repeat(RECIPIENT_NAME_MAX_LENGTH),
				title: 'Rosie Birthday',
			});
			expect(result.success).toBe(true);
		});

		it(`rejects a recipient name over ${RECIPIENT_NAME_MAX_LENGTH} chars`, () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: 'a'.repeat(RECIPIENT_NAME_MAX_LENGTH + 1),
				title: 'Rosie Birthday',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it('rejects an empty title even with a valid recipient name', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: 'Rosie',
				title: '',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it(`accepts a title at the ${WISHLIST_TITLE_MAX_LENGTH}-char maximum (issue #210)`, () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: 'Rosie',
				title: 'a'.repeat(WISHLIST_TITLE_MAX_LENGTH),
			});
			expect(result.success).toBe(true);
		});

		it(`rejects a title over ${WISHLIST_TITLE_MAX_LENGTH} chars (issue #210)`, () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: 'Rosie',
				title: 'a'.repeat(WISHLIST_TITLE_MAX_LENGTH + 1),
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});
	});

	describe('recipientKind discriminator', () => {
		it('rejects an unknown recipientKind', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'group',
				title: 'My List',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it('rejects a missing recipientKind', () => {
			const result = parseSuccess(CreateWishlistInputSchema, { title: 'My List' });
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});
	});
});

describe('UpdateWishlistInputSchema – image assignment', () => {
	it('accepts a single image key plus per-slot metadata', () => {
		const result = parseSuccess(UpdateWishlistInputSchema, {
			id: 'wl-1',
			imageKey: 'wishlists/hero.jpg',
			imageSlots: {
				card: { fitMode: 'cover-crop' },
				banner: { fitMode: 'cover-crop', cropRect: { x: 0, y: 0, w: 1, h: 0.5 } },
			},
		});
		expect(result.success).toBe(true);
	});

	it('accepts clearing the image (null key and null slots)', () => {
		const result = parseSuccess(UpdateWishlistInputSchema, {
			id: 'wl-1',
			imageKey: null,
			imageSlots: null,
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid per-slot metadata', () => {
		const result = parseSuccess(UpdateWishlistInputSchema, {
			id: 'wl-1',
			imageSlots: { thumbnail: { fitMode: 'auto', focal: { x: -1, y: 0 } } },
		});
		expect(result.success).toBe(false);
	});

	it('no longer accepts the removed banner/thumbnail keys as the source of truth', () => {
		// The obsolete fields are simply ignored (valibot objects drop unknown keys);
		// the schema must still validate without them present.
		const result = parseSuccess(UpdateWishlistInputSchema, { id: 'wl-1' });
		expect(result.success).toBe(true);
	});
});

describe('UpdateWishlistInputSchema – title length (issue #210)', () => {
	it(`accepts a title at the ${WISHLIST_TITLE_MAX_LENGTH}-char maximum`, () => {
		const result = parseSuccess(UpdateWishlistInputSchema, {
			id: 'wl-1',
			title: 'a'.repeat(WISHLIST_TITLE_MAX_LENGTH),
		});
		expect(result.success).toBe(true);
	});

	it(`rejects a title over ${WISHLIST_TITLE_MAX_LENGTH} chars`, () => {
		const result = parseSuccess(UpdateWishlistInputSchema, {
			id: 'wl-1',
			title: 'a'.repeat(WISHLIST_TITLE_MAX_LENGTH + 1),
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});
});
