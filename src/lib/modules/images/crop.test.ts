import { describe, it, expect } from 'vitest';
import {
	containZoomForAspect,
	cropRectToFocalZoom,
	focalZoomToWindowRect,
	normalizedCropAspect,
	centeredCropRect,
	panCropRect,
	zoomCropRect,
	fitCropRectToAspect,
	seedCropRectFromLegacyMeta,
	FULL_CROP_RECT,
} from './crop.js';
import { IMAGE_ZOOM_MAX, IMAGE_ZOOM_OUT_MIN, type ImageCropRect } from './types.js';
import { expectRectClose } from './crop.test_fixtures.js';

describe('normalizedCropAspect', () => {
	it('relates the target pixel aspect to the source image ratio', () => {
		// 1:1 target on a 16:9 image: the normalized rect is half as wide as tall.
		expect(normalizedCropAspect(1, 16 / 9)).toBeCloseTo(9 / 16, 10);
	});

	it('falls back to square for degenerate inputs', () => {
		expect(normalizedCropAspect(0, 1.5)).toBe(1);
		expect(normalizedCropAspect(1.5, 0)).toBe(1);
		expect(normalizedCropAspect(Number.NaN, 1)).toBe(1);
	});
});

describe('containZoomForAspect', () => {
	it('is the zoom at which the whole image exactly fits the window', () => {
		expect(containZoomForAspect(1)).toBe(1);
		expect(containZoomForAspect(2)).toBeCloseTo(0.5, 10);
		expect(containZoomForAspect(0.5)).toBeCloseTo(0.5, 10);
	});

	it('never drops below the absolute zoom-out floor', () => {
		expect(containZoomForAspect(1000)).toBe(IMAGE_ZOOM_OUT_MIN);
	});

	it('falls back to the cover baseline for degenerate aspects', () => {
		expect(containZoomForAspect(0)).toBe(1);
		expect(containZoomForAspect(Number.NaN)).toBe(1);
	});
});

describe('cropRectToFocalZoom', () => {
	it('maps the full frame to a centered focal point at zoom 1', () => {
		expect(cropRectToFocalZoom({ x: 0, y: 0, w: 1, h: 1 })).toEqual({
			focal: { x: 50, y: 50 },
			zoom: 1,
		});
	});

	it('keeps the focal centered for a centered crop and zooms by the larger side', () => {
		expect(cropRectToFocalZoom({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 })).toEqual({
			focal: { x: 50, y: 50 },
			zoom: 2,
		});
	});

	it('maps a corner-anchored crop to a corner focal (exact renderer semantics)', () => {
		// object-position 0% pins the window to the left/top edge, so origin 0 → focal 0,
		// NOT the rect-center 25% the pre-#116 conversion produced (which the renderer
		// then displaced to origin 0.125).
		expect(cropRectToFocalZoom({ x: 0, y: 0, w: 0.5, h: 0.5 })).toEqual({
			focal: { x: 0, y: 0 },
			zoom: 2,
		});
	});

	it('maps a zoomed-out (oversized) window to the same exact-inverse focal (#116 round 2)', () => {
		// A centered contain window on normalized aspect 2: both origin and (1 - size)
		// are negative, so focal = origin / (1 - size) still positions the image.
		expect(cropRectToFocalZoom({ x: -0.5, y: 0, w: 2, h: 1 })).toEqual({
			focal: { x: 50, y: 50 },
			zoom: 0.5,
		});
		// Image flush with the window's left edge → focal 0, flush right → focal 100.
		expect(cropRectToFocalZoom({ x: 0, y: 0, w: 2, h: 1 }).focal.x).toBe(0);
		expect(cropRectToFocalZoom({ x: -1, y: 0, w: 2, h: 1 }).focal.x).toBe(100);
	});

	it('clamps zoom to the maximum for tiny crops', () => {
		expect(cropRectToFocalZoom({ x: 0.45, y: 0.45, w: 0.05, h: 0.05 }).zoom).toBe(
			IMAGE_ZOOM_MAX,
		);
	});

	it('falls back to centre/zoom-1 for a degenerate rect', () => {
		expect(cropRectToFocalZoom({ x: 0, y: 0, w: 0, h: 0 })).toEqual({
			focal: { x: 50, y: 50 },
			zoom: 1,
		});
	});
});

describe('focalZoomToWindowRect', () => {
	it('returns the centered cover window at zoom 1', () => {
		// Normalized aspect 0.5 (e.g. a 1:1 slot on a 2:1 image): full height, half width.
		expectRectClose(focalZoomToWindowRect({ x: 50, y: 50 }, 1, 0.5), {
			x: 0.25,
			y: 0,
			w: 0.5,
			h: 1,
		});
	});

	it('pins the window to the edge for an edge focal point', () => {
		expectRectClose(focalZoomToWindowRect({ x: 0, y: 0 }, 2, 1), {
			x: 0,
			y: 0,
			w: 0.5,
			h: 0.5,
		});
	});

	it('round-trips any aspect-matched rect losslessly (REQ-3/D5)', () => {
		// Rects drawn per target always match the target aspect; the focal+zoom
		// persisted from them must reproduce the exact same window at render time.
		const cases: { rect: ImageCropRect; aspect: number }[] = [
			{ rect: { x: 0.1, y: 0, w: 0.6, h: 1 }, aspect: 0.6 },
			{ rect: { x: 0, y: 0.3, w: 1, h: 0.4 }, aspect: 2.5 },
			{ rect: { x: 0.42, y: 0.13, w: 0.5, h: 0.25 }, aspect: 2 },
			{ rect: { x: 0.65, y: 0.61, w: 0.35, h: 0.39 }, aspect: 0.35 / 0.39 },
		];
		for (const { rect, aspect } of cases) {
			const { focal, zoom } = cropRectToFocalZoom(rect);
			expectRectClose(focalZoomToWindowRect(focal, zoom, aspect), rect);
		}
	});

	it('round-trips zoomed-out (letterboxed) rects losslessly (#116 round 2)', () => {
		const cases: { rect: ImageCropRect; aspect: number }[] = [
			// Contain window on a wide normalized aspect, centered and edge-pinned.
			{ rect: { x: -0.5, y: 0, w: 2, h: 1 }, aspect: 2 },
			{ rect: { x: 0, y: 0, w: 2, h: 1 }, aspect: 2 },
			// In-between zoom-out: horizontal overhang, vertical still cropped.
			{ rect: { x: -0.125, y: 0.1875, w: 1.25, h: 0.625 }, aspect: 2 },
			// Tall normalized aspect letterboxes vertically instead.
			{ rect: { x: 0.2, y: -0.3, w: 0.8, h: 1.6 }, aspect: 0.5 },
		];
		for (const { rect, aspect } of cases) {
			const { focal, zoom } = cropRectToFocalZoom(rect);
			expect(zoom).toBeLessThan(1);
			expectRectClose(focalZoomToWindowRect(focal, zoom, aspect), rect);
		}
	});

	it('renders exactly the contain framing at the contain zoom', () => {
		const aspect = 2.5;
		const rect = focalZoomToWindowRect({ x: 50, y: 50 }, containZoomForAspect(aspect), aspect);
		// The image spans the window fully on one axis and is centered on the other.
		expectRectClose(rect, { x: -0.75, y: 0, w: 2.5, h: 1 });
	});

	it('never discards a full-width strip crop on a narrower slot (F7 regression)', () => {
		// F7 worked example: a strip crop y=[0.3..0.7] over the full width. In the
		// pre-#116 model zoom collapsed to 1 and a 1:1 slot rendered x=[0.22..0.78]
		// full-height instead of the drawn band. Per-target rects make the drawn
		// band exactly reproducible on its own target.
		const strip: ImageCropRect = { x: 0, y: 0.3, w: 1, h: 0.4 };
		const { focal, zoom } = cropRectToFocalZoom(strip);
		expect(zoom).toBeCloseTo(1, 10);
		// Rendered on the surface the strip was drawn for (normalized aspect 2.5):
		const rendered = focalZoomToWindowRect(focal, zoom, 1 / 0.4);
		expectRectClose(rendered, strip);
	});
});

describe('seedCropRectFromLegacyMeta', () => {
	it('restores an exact per-target/slot cropRect verbatim', () => {
		const cropRect: ImageCropRect = { x: 0.1, y: 0.2, w: 0.6, h: 0.5 };
		expectRectClose(seedCropRectFromLegacyMeta({ cropRect }), cropRect);
	});

	it('restores a base-level cropRect verbatim', () => {
		const cropRect: ImageCropRect = { x: 0.05, y: 0, w: 0.9, h: 1 };
		expectRectClose(seedCropRectFromLegacyMeta({ cropRect }), cropRect);
	});

	it('issue #123: reconstructs a legacy focal/zoom row instead of discarding it', () => {
		// An off-center legacy focal point with no cropRect must NOT seed as the
		// always-centered FULL_CROP_RECT — that is the silent square/center-ify bug:
		// the reconstructed rect's center must reflect the persisted focal point.
		const focal = { x: 20, y: 80 };
		const zoom = 1.5;
		const seeded = seedCropRectFromLegacyMeta({ focal, zoom });
		expect(seeded).not.toEqual(FULL_CROP_RECT);
		expectRectClose(seeded, focalZoomToWindowRect(focal, zoom, 1));
	});

	it('falls back to FULL_CROP_RECT only when neither cropRect nor focal/zoom exist', () => {
		expectRectClose(seedCropRectFromLegacyMeta({}), FULL_CROP_RECT);
		expectRectClose(seedCropRectFromLegacyMeta({ focal: { x: 50, y: 50 } }), FULL_CROP_RECT);
		expectRectClose(seedCropRectFromLegacyMeta({ zoom: 1 }), FULL_CROP_RECT);
	});

	it('prefers cropRect over focal/zoom when both are present', () => {
		const cropRect: ImageCropRect = { x: 0.3, y: 0.3, w: 0.4, h: 0.4 };
		expectRectClose(
			seedCropRectFromLegacyMeta({ cropRect, focal: { x: 90, y: 10 }, zoom: 2 }),
			cropRect,
		);
	});
});

describe('centeredCropRect', () => {
	it('produces the automatic center cover window (D1/REQ-1)', () => {
		expectRectClose(centeredCropRect(0.5), { x: 0.25, y: 0, w: 0.5, h: 1 });
		expectRectClose(centeredCropRect(2), { x: 0, y: 0.25, w: 1, h: 0.5 });
		expectRectClose(centeredCropRect(1), FULL_CROP_RECT);
	});
});

describe('panCropRect', () => {
	it('translates and clamps inside the unit square', () => {
		const rect: ImageCropRect = { x: 0.2, y: 0, w: 0.5, h: 1 };
		expectRectClose(panCropRect(rect, 0.1, 0.5), { x: 0.3, y: 0, w: 0.5, h: 1 });
		expectRectClose(panCropRect(rect, 9, 0), { x: 0.5, y: 0, w: 0.5, h: 1 });
		expectRectClose(panCropRect(rect, -9, 0), { x: 0, y: 0, w: 0.5, h: 1 });
	});

	it('keeps the image inside an oversized (zoomed-out) window', () => {
		// Window twice as wide as the image: the image slides between flush-left
		// (origin 0) and flush-right (origin 1 - size = -1), never outside.
		const rect: ImageCropRect = { x: -0.5, y: 0, w: 2, h: 1 };
		expectRectClose(panCropRect(rect, 0.2, 0), { x: -0.3, y: 0, w: 2, h: 1 });
		expectRectClose(panCropRect(rect, 9, 0), { x: 0, y: 0, w: 2, h: 1 });
		expectRectClose(panCropRect(rect, -9, 0), { x: -1, y: 0, w: 2, h: 1 });
	});
});

describe('zoomCropRect', () => {
	it('resizes around the current center preserving the aspect', () => {
		const rect: ImageCropRect = { x: 0.25, y: 0, w: 0.5, h: 1 };
		const zoomed = zoomCropRect(rect, 0.5, 2);
		expectRectClose(zoomed, { x: 0.375, y: 0.25, w: 0.25, h: 0.5 });
	});

	it('clamps back inside bounds when zooming out near an edge', () => {
		const rect: ImageCropRect = { x: 0.75, y: 0.5, w: 0.25, h: 0.5 };
		const zoomed = zoomCropRect(rect, 0.5, 1);
		expectRectClose(zoomed, { x: 0.5, y: 0, w: 0.5, h: 1 });
	});

	it('zooms out below 100 % but floors at the contain zoom (#116 round 2)', () => {
		const centered = centeredCropRect(2);
		// 80 % keeps the covered axis covered while the other overhangs.
		expectRectClose(zoomCropRect(centered, 2, 0.8), {
			x: -0.125,
			y: 0.1875,
			w: 1.25,
			h: 0.625,
		});
		// Requests below the contain zoom stop exactly at contain: whole image,
		// white space on one axis only.
		expectRectClose(zoomCropRect(centered, 2, 0.1), { x: -0.5, y: 0, w: 2, h: 1 });
	});
});

describe('fitCropRectToAspect', () => {
	it('returns aspect-matched rects unchanged', () => {
		const rect: ImageCropRect = { x: 0.1, y: 0.2, w: 0.4, h: 0.8 };
		expectRectClose(fitCropRectToAspect(rect, 0.5), rect);
	});

	it('re-shapes a legacy square rect around its center', () => {
		// Legacy pre-#116 restore rects were square; editing a 2:1-normalized target
		// keeps the center and covers the old extent.
		const legacy: ImageCropRect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
		expectRectClose(fitCropRectToAspect(legacy, 2), { x: 0, y: 0.25, w: 1, h: 0.5 });
	});

	it('respects the renderer zoom bounds so no saved crop can exceed max zoom', () => {
		const tiny: ImageCropRect = { x: 0.5, y: 0.5, w: 0.02, h: 0.02 };
		const fitted = fitCropRectToAspect(tiny, 1);
		expect(Math.max(fitted.w, fitted.h)).toBeGreaterThanOrEqual(1 / IMAGE_ZOOM_MAX - 1e-9);
	});

	it('preserves aspect-matched zoomed-out rects (one-axis letterbox)', () => {
		const contain: ImageCropRect = { x: -0.5, y: 0, w: 2, h: 1 };
		expectRectClose(fitCropRectToAspect(contain, 2), contain);
	});

	it('shrinks a window oversized on both axes back to the contain limit', () => {
		// White space on both axes is unrepresentable: min(w, h) must come back to 1.
		const oversized: ImageCropRect = { x: -1, y: -1, w: 3, h: 3 };
		expectRectClose(fitCropRectToAspect(oversized, 2), { x: -0.5, y: 0, w: 2, h: 1 });
	});

	it('falls back to the centered window for degenerate rects', () => {
		expectRectClose(
			fitCropRectToAspect({ x: 0, y: 0, w: 0, h: 0 }, 0.5),
			centeredCropRect(0.5),
		);
	});
});
