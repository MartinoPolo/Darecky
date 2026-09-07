import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { ManagedGiftCategorySettingsRow } from '$lib/modules/gift-categories/types.js';

const remote = vi.hoisted(() => ({
	query: null as unknown as { current: ManagedGiftCategorySettingsRow[] },
}));

vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/gift-categories/gift_category_queries.remote.js', () => ({
	getGiftCategorySettingsRows: vi.fn(() => ({
		...remote.query,
		refresh: () => Promise.resolve(),
	})),
}));
vi.mock('$lib/modules/gift-categories/gift_categories.remote.js', () => ({
	saveGiftCategorySettingsCommand: vi.fn(),
}));

import WishlistCategorySettings from './WishlistCategorySettings.svelte';
import { createCategorySettingsMotion } from './wishlist_category_settings_motion.svelte.js';

const RECT = {
	left: 20,
	top: 30,
	right: 220,
	bottom: 110,
	width: 200,
	height: 80,
	x: 20,
	y: 30,
	toJSON: () => ({}),
} satisfies DOMRect;

function row(id: string, rectangle: DOMRect = RECT) {
	const element = document.createElement('div');
	element.dataset.categoryRow = '';
	element.dataset.categoryId = id;
	element.innerHTML = `<label id="label-${id}" for="input-${id}">Category</label><input id="input-${id}">`;
	document.body.append(element);
	vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rectangle);
	return element;
}

function animation() {
	return {
		finished: Promise.resolve(),
		cancel: vi.fn(),
		addEventListener: vi.fn(),
	} as unknown as Animation;
}

function deferredAnimation() {
	let finish!: () => void;
	const finished = new Promise<void>((resolve) => {
		finish = resolve;
	});
	return {
		animation: { finished, cancel: vi.fn(), addEventListener: vi.fn() } as unknown as Animation,
		finish,
	};
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe('wishlist category settings motion', () => {
	it('FLIPs only continuously present visible database identities after reorder', async () => {
		const stable = row('category-db-1');
		const removed = row('category-db-2', { ...RECT, top: 130, bottom: 210, y: 130 });
		row('category-db-hidden', {
			...RECT,
			top: 230,
			bottom: 230,
			y: 230,
			height: 0,
		});
		const animate = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(animation());
		const motion = createCategorySettingsMotion({ reducedMotion: () => false });
		const snapshot = motion.capture(document.body);

		removed.remove();
		vi.mocked(stable.getBoundingClientRect).mockReturnValue({
			...RECT,
			top: 150,
			bottom: 230,
			y: 150,
		});
		row('category-db-inserted', { ...RECT, top: 250, bottom: 330, y: 250 });
		await motion.play(snapshot, document.body);

		expect(animate).toHaveBeenCalledOnce();
		expect(animate.mock.contexts[0]).toBe(stable);
		expect(animate).toHaveBeenCalledWith(
			[{ transform: 'translate(0px, -120px)' }, { transform: 'translate(0, 0)' }],
			{ duration: 520, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
		);
		motion.destroy();
	});

	it('settles local custom-category reordering by stable persisted identity', async () => {
		remote.query = {
			current: [
				{
					id: 'category-db-1',
					presetKey: null,
					customLabel: 'First',
					color: '#111111',
					sortOrder: 0,
					usedCount: 0,
					enabled: true,
				},
				{
					id: 'category-db-2',
					presetKey: null,
					customLabel: 'Second',
					color: '#222222',
					sortOrder: 1,
					usedCount: 0,
					enabled: true,
				},
			],
		};
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-db-1' });
		const firstRow = document.querySelector<HTMLElement>('[data-category-id="category-db-1"]')!;
		const secondRow = document.querySelector<HTMLElement>(
			'[data-category-id="category-db-2"]',
		)!;
		vi.spyOn(firstRow, 'getBoundingClientRect')
			.mockReturnValueOnce(RECT)
			.mockReturnValue({ ...RECT, top: 130, bottom: 210, y: 130 });
		vi.spyOn(secondRow, 'getBoundingClientRect')
			.mockReturnValueOnce({ ...RECT, top: 130, bottom: 210, y: 130 })
			.mockReturnValue(RECT);
		const animate = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(animation());

		await screen.getByRole('button', { name: m.move_down() }).all()[0].click();
		await expect.poll(() => animate.mock.calls.length).toBe(2);
		expect(animate.mock.contexts).toEqual([secondRow, firstRow]);
	});

	it('animates an unsaved draft exit and surviving draft settlement', async () => {
		remote.query = { current: [] };
		const screen = render(WishlistCategorySettings, { wishlistId: 'wishlist-db-1' });
		const input = screen.getByPlaceholder(m.gift_category_custom_placeholder());
		await input.fill('First draft');
		await screen.getByRole('button', { name: m.gift_category_create() }).click();
		await input.fill('Second draft');
		await screen.getByRole('button', { name: m.gift_category_create() }).click();

		const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-category-row]'));
		const deleted = rows[0]!;
		const survivor = rows[1]!;
		vi.spyOn(deleted, 'getBoundingClientRect').mockReturnValue(RECT);
		vi.spyOn(survivor, 'getBoundingClientRect')
			.mockReturnValueOnce({ ...RECT, top: 130, bottom: 210, y: 130 })
			.mockReturnValue(RECT);
		const animate = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(animation());

		await screen.getByRole('button', { name: m.delete() }).all()[0].click();
		await expect.poll(() => animate.mock.calls.length).toBe(2);

		expect(animate.mock.contexts[0]).toBe(survivor);
		expect(animate.mock.calls[0]).toEqual([
			[{ transform: 'translate(0px, 100px)' }, { transform: 'translate(0, 0)' }],
			{ duration: 520, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
		]);
		expect(animate.mock.contexts[1]).not.toBe(deleted);
		expect(animate.mock.calls[1]).toEqual([
			[
				{ opacity: 1, transform: 'scaleY(1)' },
				{ opacity: 0, transform: 'scaleY(0)' },
			],
			{ duration: 440, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' },
		]);
	});

	it('retains an inert ID-stripped deleted row while its local exit and survivor settlement run', async () => {
		const deleted = row('category-db-deleted');
		const survivor = row('category-db-survivor', {
			...RECT,
			top: 130,
			bottom: 210,
			y: 130,
		});
		const exit = deferredAnimation();
		const settle = deferredAnimation();
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValueOnce(settle.animation)
			.mockReturnValueOnce(exit.animation);
		const motion = createCategorySettingsMotion({ reducedMotion: () => false });
		const snapshot = motion.capture(document.body, 'category-db-deleted');

		expect(snapshot.retainedVisual?.isConnected).toBe(false);
		deleted.remove();
		vi.mocked(survivor.getBoundingClientRect).mockReturnValue(RECT);
		const playing = motion.play(snapshot, document.body);

		const clone = snapshot.retainedVisual!;
		expect(clone.isConnected).toBe(true);
		expect(clone.inert).toBe(true);
		expect(clone.getAttribute('aria-hidden')).toBe('true');
		expect(clone.querySelectorAll('[id]')).toHaveLength(0);
		expect(animate.mock.calls[0]).toEqual([
			[{ transform: 'translate(0px, 100px)' }, { transform: 'translate(0, 0)' }],
			{ duration: 520, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
		]);
		expect(animate.mock.calls[1]).toEqual([
			[
				{ opacity: 1, transform: 'scaleY(1)' },
				{ opacity: 0, transform: 'scaleY(0)' },
			],
			{ duration: 440, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' },
		]);

		exit.finish();
		settle.finish();
		await playing;
		expect(clone.isConnected).toBe(false);
		expect(clone.getAttribute('style')).toBeNull();
		motion.destroy();
	});

	it('cancels a retained-visual play without leaving clones or animations', () => {
		const source = row('category-db-1');
		const pending = deferredAnimation();
		vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(pending.animation);
		const motion = createCategorySettingsMotion({ reducedMotion: () => false });
		const active = motion.capture(document.body, 'category-db-1');
		source.remove();
		void motion.play(active, document.body);

		expect(active.retainedVisual?.isConnected).toBe(true);
		motion.cancel();

		expect(pending.animation.cancel).toHaveBeenCalledOnce();
		expect(active.retainedVisual?.isConnected).toBe(false);
		expect(active.retainedVisual?.getAttribute('style')).toBeNull();
		motion.destroy();
	});

	it('applies the final reduced-motion state without transforms or retained visuals', async () => {
		const source = row('category-db-1');
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		const motion = createCategorySettingsMotion({ reducedMotion: () => true });
		const snapshot = motion.capture(document.body, 'category-db-1');
		source.remove();

		await motion.play(snapshot, document.body);

		expect(snapshot.retainedVisual).toBeNull();
		expect(animate).not.toHaveBeenCalled();
		expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
		motion.destroy();
	});
});
