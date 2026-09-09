import '../../../../app.css';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { SvelteMap } from 'svelte/reactivity';
import * as m from '$lib/paraglide/messages.js';

const mocks = vi.hoisted(() => ({
	useLikes: vi.fn(),
	toggleLike: vi.fn(),
}));

vi.mock('$lib/modules/likes/likes.context.svelte.js', () => ({
	useLikes: mocks.useLikes,
}));

vi.mock('$lib/modules/likes/likes.remote.js', () => ({
	toggleLike: mocks.toggleLike,
}));

const { default: LikeButton } = await import('./LikeButton.svelte');

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

function likesContext(initiallyLiked = false) {
	const overrides = new SvelteMap<string, boolean>();
	const revertToggle = vi.fn((giftId: string, wasLiked: boolean) => {
		overrides.set(giftId, wasLiked);
	});
	const context = {
		isLiked: (giftId: string) => overrides.get(giftId) ?? initiallyLiked,
		optimisticToggle: vi.fn((giftId: string) => {
			const next = !(overrides.get(giftId) ?? initiallyLiked);
			overrides.set(giftId, next);
			return next;
		}),
		revertToggle,
		isAuthenticated: () => true,
		requireAuth: vi.fn(),
		toggleLike: mocks.toggleLike,
	};
	mocks.useLikes.mockReturnValue(context);
	return context;
}

function animation() {
	return {
		cancel: vi.fn(),
		finished: Promise.resolve(),
	} as unknown as Animation;
}

function mockReducedMotion(matches: boolean) {
	vi.spyOn(window, 'matchMedia').mockReturnValue({ matches } as MediaQueryList);
}

function mockElementAnimations(heartAnimation = animation()) {
	return vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(heartAnimation);
}

async function renderLikeButton(likeCount = 4) {
	return render(LikeButton, {
		giftId: 'gift-1',
		giftName: 'Stolní lampa',
		likeCount,
	});
}

beforeEach(() => {
	mocks.useLikes.mockReset();
	mocks.toggleLike.mockReset();
	mockReducedMotion(false);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('LikeButton approved image treatment (issue #357)', () => {
	it.each([0, 7, 123])(
		'renders count %d beside the heart with an accessible ghost target',
		async (likeCount) => {
			likesContext(true);
			await renderLikeButton(likeCount);

			const button = page.getByRole('button');
			const buttonElement = button.element() as HTMLButtonElement;
			const surface = buttonElement.querySelector(
				':scope > .elevation-surface',
			) as HTMLElement;
			const heart = buttonElement.querySelector('[data-like-heart]') as HTMLElement;
			const icon = heart.querySelector('svg') as SVGElement;
			const count = buttonElement.querySelector('[data-like-count]') as HTMLElement;
			const buttonRect = buttonElement.getBoundingClientRect();
			const heartRect = heart.getBoundingClientRect();
			const countRect = count.getBoundingClientRect();
			const surfaceStyle = getComputedStyle(surface);

			expect(count.textContent).toBe(String(likeCount));
			expect(heartRect.right).toBeLessThanOrEqual(countRect.left);
			expect(buttonElement.getAttribute('aria-describedby')).toBe(count.id);
			await expect.element(button).toHaveAttribute('aria-pressed', 'true');
			expect(buttonRect.width).toBeGreaterThanOrEqual(40);
			expect(buttonRect.height).toBeGreaterThanOrEqual(40);
			expect(surfaceStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
			const shadowAlphas = Array.from(
				surfaceStyle.boxShadow.matchAll(/rgba\([^)]*, ([\d.]+)\)/g),
				(match) => Number(match[1]),
			);
			expect(
				surfaceStyle.boxShadow === 'none' || shadowAlphas.every((alpha) => alpha === 0),
			).toBe(true);
			expect(surfaceStyle.borderTopWidth).toBe('0px');
			expect(getComputedStyle(icon).fill).not.toBe('none');
			expect(getComputedStyle(count).filter).not.toBe('none');
		},
	);
});

describe('LikeButton acknowledgement', () => {
	it('updates optimistically but waits for successful persistence before acknowledging the like', async () => {
		likesContext();
		const remote = deferred<{ liked: boolean; likeCount: number }>();
		mocks.toggleLike.mockReturnValue(remote.promise);
		const heartAnimation = animation();
		await renderLikeButton();
		const animate = mockElementAnimations(heartAnimation);
		const button = page.getByRole('button');

		await button.click();

		await expect.element(button).toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(button)
			.toHaveAccessibleName(m.gift_like_remove_aria({ name: 'Stolní lampa' }));
		await expect.element(button).toHaveTextContent('5');
		expect(animate).not.toHaveBeenCalled();

		remote.resolve({ liked: true, likeCount: 9 });
		await expect.element(button).toHaveTextContent('9');

		expect(animate.mock.contexts[0]).toBe(document.querySelector('[data-like-heart]'));
		expect(animate.mock.calls[0]).toEqual([
			[{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }],
			{ duration: 160 },
		]);
		expect(animate).toHaveBeenCalledOnce();
	});

	it('keeps one count node stable through prop acknowledgement and repeated like changes', async () => {
		likesContext();
		const like = deferred<{ liked: boolean; likeCount: number }>();
		const unlike = deferred<{ liked: boolean; likeCount: number }>();
		mocks.toggleLike.mockReturnValueOnce(like.promise).mockReturnValueOnce(unlike.promise);
		const screen = await renderLikeButton();
		const animate = mockElementAnimations();
		const button = page.getByRole('button');

		await button.click();
		await expect.element(button).toHaveTextContent('5');
		const countNode = document.querySelector('[data-like-count]');
		expect(countNode).not.toBeNull();

		await screen.rerender({
			giftId: 'gift-1',
			giftName: 'Stolní lampa',
			likeCount: 5,
		});
		expect(document.querySelector('[data-like-count]')).toBe(countNode);
		expect(countNode?.textContent).toBe('5');

		like.resolve({ liked: true, likeCount: 5 });
		await expect.element(button).toHaveTextContent('5');
		expect(document.querySelector('[data-like-count]')).toBe(countNode);
		await vi.waitFor(() => expect(animate).toHaveBeenCalledOnce());
		expect(animate.mock.contexts[0]).toBe(document.querySelector('[data-like-heart]'));

		await button.click();
		await expect.element(button).toHaveTextContent('4');
		await screen.rerender({
			giftId: 'gift-1',
			giftName: 'Stolní lampa',
			likeCount: 4,
		});
		expect(document.querySelector('[data-like-count]')).toBe(countNode);
		unlike.resolve({ liked: false, likeCount: 4 });
		await expect.element(button).toHaveTextContent('4');
		expect(document.querySelector('[data-like-count]')).toBe(countNode);
		expect(animate).toHaveBeenCalledOnce();
	});

	it('replaces the optimistic count with the authoritative remote count', async () => {
		likesContext();
		mocks.toggleLike.mockResolvedValue({ liked: true, likeCount: 9 });
		const screen = await renderLikeButton();
		mockElementAnimations();

		await page.getByRole('button').click();

		await expect.element(page.getByRole('button')).toHaveTextContent('9');
		await screen.unmount();
	});

	it('ignores a stale response without acknowledgement after a rapid double click', async () => {
		likesContext();
		const first = deferred<{ liked: boolean; likeCount: number }>();
		const second = deferred<{ liked: boolean; likeCount: number }>();
		mocks.toggleLike.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		await renderLikeButton();
		const animate = mockElementAnimations();
		const button = page.getByRole('button');

		await button.click();
		await button.click();
		second.resolve({ liked: false, likeCount: 4 });
		await expect.element(button).toHaveAttribute('aria-pressed', 'false');
		await expect.element(button).toHaveTextContent('4');
		first.resolve({ liked: true, likeCount: 99 });
		await Promise.resolve();
		await Promise.resolve();

		expect(button.element().textContent).toContain('4');
		expect(animate).not.toHaveBeenCalled();
	});

	it('rolls back state and count without success animation when persistence fails', async () => {
		const context = likesContext();
		const remote = deferred<{ liked: boolean; likeCount: number }>();
		mocks.toggleLike.mockReturnValue(remote.promise);
		await renderLikeButton();
		const animate = mockElementAnimations();
		const button = page.getByRole('button');

		await button.click();
		expect(animate).not.toHaveBeenCalled();
		remote.reject(new Error('remote failed'));

		await expect.element(button).toHaveAttribute('aria-pressed', 'false');
		await expect.element(button).toHaveTextContent('4');
		expect(context.revertToggle).toHaveBeenCalledWith('gift-1', false);
		expect(animate).not.toHaveBeenCalled();
	});

	it('cancels element-bound animations when the surface is torn down', async () => {
		likesContext();
		const remote = deferred<{ liked: boolean; likeCount: number }>();
		mocks.toggleLike.mockReturnValue(remote.promise);
		const pop = animation();
		const screen = await renderLikeButton();
		mockElementAnimations(pop);

		await page.getByRole('button').click();
		remote.resolve({ liked: true, likeCount: 9 });
		await expect.element(page.getByRole('button')).toHaveTextContent('9');
		await screen.unmount();

		expect(pop.cancel).toHaveBeenCalledOnce();
	});

	it('updates immediately without transform animation when reduced motion is preferred', async () => {
		likesContext();
		mockReducedMotion(true);
		mocks.toggleLike.mockResolvedValue({ liked: true, likeCount: 5 });
		await renderLikeButton();
		const animate = mockElementAnimations();
		const button = page.getByRole('button');

		await button.click();

		await expect.element(button).toHaveAttribute('aria-pressed', 'true');
		await expect.element(button).toHaveTextContent('5');
		expect(animate).not.toHaveBeenCalled();
	});
});
