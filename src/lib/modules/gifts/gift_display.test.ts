import { describe, it, expect, beforeAll } from 'vitest';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';
import {
	adjustGiftPriceByMagnitude,
	czechPluralCategory,
	formatPieceCount,
	formatPrice,
	finalizeGiftPrice,
	finalizeGiftQuantity,
	getGiftPriceMagnitude,
} from './gift_display.js';

beforeAll(() => {
	overwriteGetLocale(() => 'cs');
});

/** Collapses ICU's non-breaking/narrow-no-break spaces (U+00A0, U+202F) to a plain space. */
function normalizeSpaces(value: string): string {
	return value.replace(/[  ]/g, ' ');
}

describe('formatPrice', () => {
	it('returns the "not listed" hint for a null price', () => {
		expect(formatPrice(null, 'CZK')).toBe('Cena neuvedena');
	});

	it.each([undefined, null])('formats a single price when priceMax is %s', (priceMax) => {
		expect(normalizeSpaces(formatPrice(1000, 'CZK', priceMax))).toBe('1 000 Kč');
	});

	it('displays a decimal single price without rounding (issue #250 REQ-4)', () => {
		expect(normalizeSpaces(formatPrice(19.5, 'EUR'))).toBe('19,5 €');
	});

	// REQ-3: a set range renders as "min–max <currency>" via Intl.NumberFormat.formatRange -
	// currency shown once, locale-correct separator, no "cca"/"~" approximation marker.
	it('formats a price range via Intl.NumberFormat.formatRange (REQ-3)', () => {
		const result = normalizeSpaces(formatPrice(1200, 'CZK', 1500));
		expect(result).toContain('1 200');
		expect(result).toContain('1 500');
		expect(result).toContain('Kč');
		// Currency symbol appears exactly once (not duplicated per bound).
		expect(result.match(/Kč/g)).toHaveLength(1);
		expect(result).not.toContain('cca');
		expect(result).not.toContain('~');
	});

	it('displays decimal range bounds without rounding (issue #250 REQ-4)', () => {
		const result = normalizeSpaces(formatPrice(19.5, 'EUR', 29.95));
		expect(result).toContain('19,5');
		expect(result).toContain('29,95');
	});

	it('falls back to a single formatted price when priceMax equals price', () => {
		expect(normalizeSpaces(formatPrice(1000, 'CZK', 1000))).toBe('1 000 Kč');
	});

	it('falls back to a single formatted price when priceMax is below price', () => {
		// Defensive: the form/schema prevent this from ever being saved, but formatPrice
		// itself never renders a backwards range.
		expect(normalizeSpaces(formatPrice(1500, 'CZK', 1000))).toBe('1 500 Kč');
	});

	it('defaults to CZK when currency is null', () => {
		expect(formatPrice(1000, null, 1500)).toContain('Kč');
	});
});

describe('getGiftPriceMagnitude', () => {
	it.each([
		[null, 1],
		[0, 1],
		[0.01, 1],
		[9.99, 1],
		[10, 1],
		[99.99, 1],
		[100, 10],
		[999.99, 10],
		[1000, 100],
	])('derives the second-highest integer decimal order for %s', (value, expected) => {
		expect(getGiftPriceMagnitude(value)).toBe(expected);
	});
});

describe('adjustGiftPriceByMagnitude', () => {
	it.each([
		[0, 1, 1],
		[0, -1, 0],
		[0.5, 1, 1.5],
		[0.5, -1, 0],
		[9, 1, 10],
		[9, -1, 8],
		[9.99, 1, 10.99],
		[9.99, -1, 8.99],
		[10, 1, 11],
		[10, -1, 9],
		[99, 1, 100],
		[99, -1, 98],
		[99.99, 1, 100.99],
		[99.99, -1, 98.99],
		[100, 1, 110],
		[100, -1, 99],
		[100.99, 1, 110.99],
		[100.99, -1, 99.99],
		[109, 1, 119],
		[109, -1, 99],
		[110, 1, 120],
		[110, -1, 100],
		[999, 1, 1009],
		[999, -1, 989],
		[1000, 1, 1100],
		[1000, -1, 990],
		[1009, 1, 1109],
		[1009, -1, 999],
	])('adjusts %s in direction %s to %s', (value, direction, expected) => {
		expect(adjustGiftPriceByMagnitude(value, direction as 1 | -1)).toBe(expected);
	});

	it.each([99, 100, 999, 99.99, 100.99])(
		'reverses an increment from %s across magnitude boundaries',
		(value) => {
			const incremented = adjustGiftPriceByMagnitude(value, 1);
			expect(adjustGiftPriceByMagnitude(incremented, -1)).toBe(value);
		},
	);

	it('preserves two-decimal precision without floating-point drift', () => {
		expect(adjustGiftPriceByMagnitude(100.08, -1)).toBe(99.08);
		expect(adjustGiftPriceByMagnitude(999.99, 1)).toBe(1009.99);
	});

	it('clamps adjustments to the persistence-safe upper price limit', () => {
		expect(adjustGiftPriceByMagnitude(9_999_999_999.99, 1)).toBe(9_999_999_999.99);
	});

	it.each([
		[null, 1, 1],
		[null, -1, 0],
	])('handles empty price %s in direction %s', (value, direction, expected) => {
		expect(adjustGiftPriceByMagnitude(value, direction as 1 | -1)).toBe(expected);
	});
});

describe('finalizeGiftPrice', () => {
	it.each([
		[500, 500],
		[0, 0],
		[null, null],
		[NaN, null],
	])('normalizes numeric input %s to %s', (value, expected) => {
		expect(finalizeGiftPrice(value)).toBe(expected);
	});
});

describe('finalizeGiftQuantity', () => {
	it.each([
		[3, 3],
		[NaN, 1],
		[0, 1],
		[-2, 1],
	])('normalizes quantity input %s to %s', (value, expected) => {
		expect(finalizeGiftQuantity(value)).toBe(expected);
	});
});

describe('czechPluralCategory', () => {
	it.each([
		[1, 'one'],
		[2, 'few'],
		[3, 'few'],
		[4, 'few'],
		[0, 'other'],
		[5, 'other'],
		[100, 'other'],
	] as const)('maps %s to the %s plural category', (count, expected) => {
		expect(czechPluralCategory(count)).toBe(expected);
	});
});

describe('formatPieceCount', () => {
	it('returns null for null quantity', () => {
		expect(formatPieceCount(null, 'recipient')).toBeNull();
	});

	it('returns "1 kus" for quantity 1 as recipient', () => {
		const result = formatPieceCount(1, 'recipient');
		expect(result).toEqual({ pieceText: '1 kus', reservedText: null });
	});

	it('returns no reserved info for recipient even with reservedCount', () => {
		const result = formatPieceCount(3, 'recipient', 2);
		expect(result).toEqual({ pieceText: '3 kusy', reservedText: null });
	});

	it('returns reserved count for visitor', () => {
		const result = formatPieceCount(3, 'visitor', 2);
		expect(result).toEqual({ pieceText: '3 kusy', reservedText: '2 rezervováno' });
	});

	it('returns reserved count for moderator (same as visitor)', () => {
		const result = formatPieceCount(3, 'moderator', 2);
		expect(result).toEqual({ pieceText: '3 kusy', reservedText: '2 rezervováno' });
	});

	it('returns fully reserved for visitor when all reserved', () => {
		const result = formatPieceCount(5, 'visitor', 5);
		expect(result).toEqual({ pieceText: '5 kusů', reservedText: 'plně rezervováno' });
	});

	it('returns null reservedText for visitor when reservedCount is 0', () => {
		const result = formatPieceCount(5, 'visitor', 0);
		expect(result).toEqual({ pieceText: '5 kusů', reservedText: null });
	});

	it('returns null reservedText for visitor when reservedCount is omitted', () => {
		const result = formatPieceCount(5, 'visitor');
		expect(result).toEqual({ pieceText: '5 kusů', reservedText: null });
	});

	it('returns fully reserved for visitor when quantity is 1 and reserved is 1', () => {
		const result = formatPieceCount(1, 'visitor', 1);
		expect(result).toEqual({ pieceText: '1 kus', reservedText: 'plně rezervováno' });
	});

	it('returns null reservedText for recipient even at scale', () => {
		const result = formatPieceCount(10, 'recipient', 8);
		expect(result).toEqual({ pieceText: '10 kusů', reservedText: null });
	});
});
