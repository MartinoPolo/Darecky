import { describe, expect, it, vi } from 'vitest';
import type { CarouselAPI } from './context.js';
import { SoftenedDragMomentum } from './softened_drag_momentum.js';

type CarouselEventListener = Parameters<CarouselAPI['on']>[1];

function setup({ location = 40, target = 100, remainingMomentum = 0.5 } = {}) {
	let pointerUpListener: CarouselEventListener | undefined;
	const setTarget = vi.fn();
	const api = {
		internalEngine: () => ({
			location: { get: () => location },
			target: { get: () => target, set: setTarget },
		}),
		on: vi.fn((event: string, listener: CarouselEventListener) => {
			if (event === 'pointerUp') {
				pointerUpListener = listener;
			}
			return api;
		}),
		off: vi.fn(() => api),
	} as unknown as CarouselAPI;
	const plugin = SoftenedDragMomentum({ remainingMomentum });
	plugin.init(api, undefined as never);

	return {
		api,
		plugin,
		setTarget,
		release() {
			pointerUpListener?.(api, 'pointerUp');
		},
	};
}

describe('SoftenedDragMomentum plugin', () => {
	it('retains the configured portion of the remaining target travel on release', () => {
		const { setTarget, release } = setup();

		release();

		expect(setTarget).toHaveBeenCalledWith(70);
	});

	it.each([
		{ configured: -1, expected: 40 },
		{ configured: 2, expected: 100 },
	])('clamps $configured to a valid momentum factor', ({ configured, expected }) => {
		const { setTarget, release } = setup({ remainingMomentum: configured });

		release();

		expect(setTarget).toHaveBeenCalledWith(expected);
	});

	it('removes its pointer-up listener when destroyed', () => {
		const { api, plugin } = setup();

		plugin.destroy();

		expect(api.off).toHaveBeenCalledWith('pointerUp', expect.any(Function));
	});
});
