import { expect } from 'vitest';
import type { ImageCropRect } from './types.js';

/** Assert two rects are equal within floating-point tolerance. */
export function expectRectClose(actual: ImageCropRect, expected: ImageCropRect) {
	expect(actual.x).toBeCloseTo(expected.x, 10);
	expect(actual.y).toBeCloseTo(expected.y, 10);
	expect(actual.w).toBeCloseTo(expected.w, 10);
	expect(actual.h).toBeCloseTo(expected.h, 10);
}
