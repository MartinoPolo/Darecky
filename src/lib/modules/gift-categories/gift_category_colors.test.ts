import { describe, expect, it } from 'vitest';
import {
	contrastRatio,
	foregroundForCategoryColor,
	giftCategoryColorForIndex,
} from './gift_category_colors.js';

describe('gift category colors', () => {
	it('preserves the original deterministic custom defaults after the picker expands', () => {
		const originalDefaults = [
			'#0369A1',
			'#047857',
			'#A21CAF',
			'#C2410C',
			'#4F46E5',
			'#B91C1C',
			'#0F766E',
			'#7E22CE',
		];
		expect(originalDefaults.map((_, index) => giftCategoryColorForIndex(index))).toEqual(
			originalDefaults,
		);
		expect(giftCategoryColorForIndex(originalDefaults.length)).toBe(originalDefaults[0]);
	});

	it.each(['#000000', '#FFFFFF', '#777777'])('%s gets black or white text at 4.5:1', (color) => {
		const foreground = foregroundForCategoryColor(color);
		expect(['#000000', '#FFFFFF']).toContain(foreground);
		expect(contrastRatio(color, foreground)).toBeGreaterThanOrEqual(4.5);
	});
});
