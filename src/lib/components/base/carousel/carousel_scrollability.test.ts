import { describe, expect, it, vi } from 'vitest';
import type { CarouselAPI, CarouselOptions } from './context.js';
import { resolveCarouselScrollability } from './carousel_scrollability.js';

function createApi({
	progress = 0,
	snapCount = 3,
	canScrollPrev = false,
	canScrollNext = true,
} = {}) {
	return {
		scrollProgress: vi.fn(() => progress),
		scrollSnapList: vi.fn(() => Array.from({ length: snapCount }, (_, index) => index)),
		canScrollPrev: vi.fn(() => canScrollPrev),
		canScrollNext: vi.fn(() => canScrollNext),
	} as unknown as CarouselAPI;
}

describe('resolveCarouselScrollability', () => {
	it('uses Embla snap state for a snapping carousel', () => {
		const api = createApi({ canScrollPrev: true, canScrollNext: false });

		expect(resolveCarouselScrollability(api, {})).toEqual({
			canScrollPrev: true,
			canScrollNext: false,
		});
	});

	it('uses Embla snap state for looping free-scroll carousels', () => {
		const api = createApi({ progress: 0, canScrollPrev: true, canScrollNext: true });
		const options = { dragFree: true, loop: true } satisfies CarouselOptions;

		expect(resolveCarouselScrollability(api, options)).toEqual({
			canScrollPrev: true,
			canScrollNext: true,
		});
	});

	it('does not expose controls when the content has no overflow', () => {
		const api = createApi({ progress: 0.5, snapCount: 1 });
		const options = { dragFree: true } satisfies CarouselOptions;

		expect(resolveCarouselScrollability(api, options)).toEqual({
			canScrollPrev: false,
			canScrollNext: false,
		});
	});

	it.each([
		{ progress: 0, canScrollPrev: false, canScrollNext: true },
		{ progress: 0.5, canScrollPrev: true, canScrollNext: true },
		{ progress: 1, canScrollPrev: true, canScrollNext: false },
		{ progress: -0.1, canScrollPrev: false, canScrollNext: true },
		{ progress: 1.1, canScrollPrev: true, canScrollNext: false },
	])(
		'resolves physical boundaries at progress $progress',
		({ progress, canScrollPrev, canScrollNext }) => {
			const api = createApi({ progress });
			const options = { dragFree: true } satisfies CarouselOptions;

			expect(resolveCarouselScrollability(api, options)).toEqual({
				canScrollPrev,
				canScrollNext,
			});
		},
	);
});
