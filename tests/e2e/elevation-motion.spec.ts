import { expect, test, type Locator } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage, waitForAppHydration } from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	waitForDialogMotionToSettle,
} from './fixtures/wishlist-helpers.js';

interface RectSnapshot {
	x: number;
	y: number;
	width: number;
	height: number;
}

function visualSurface(owner: Locator) {
	return owner.locator(':scope > .elevation-surface');
}

async function rect(locator: Locator): Promise<RectSnapshot> {
	return locator.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
	});
}

function expectSameRect(actual: RectSnapshot, expected: RectSnapshot) {
	for (const key of ['x', 'y', 'width', 'height'] as const) {
		expect(Math.abs(actual[key] - expected[key])).toBeLessThan(0.25);
	}
}

async function sampleFrameRects(locator: Locator, frameCount = 12): Promise<RectSnapshot[]> {
	return locator.evaluate(async (element, count) => {
		const samples: RectSnapshot[] = [];
		for (let frame = 0; frame < count; frame += 1) {
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			const bounds = element.getBoundingClientRect();
			samples.push({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
		}
		return samples;
	}, frameCount);
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Elevated interaction behavior', () => {
	test('account menu opens through native activation and its owner remains anchored', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('elevation-account');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.goto('/my-lists');
		await waitForAppHydration(page);

		const account = page.getByRole('button', { name: new RegExp(user.name) });
		await expect(account).toBeVisible();
		const resting = await rect(account);
		await account.focus();
		await page.keyboard.press('Enter');
		await expect(account).toHaveAttribute('aria-expanded', 'true');
		await expect(page.locator('[data-slot="dropdown-menu-content"]')).toBeVisible();

		for (const sample of await sampleFrameRects(account)) {
			expectSameRect(sample, resting);
		}
		await page.context().close();
	});

	test('raised button remains reachable and stationary through a held lower-edge press', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('elevation-held-press');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto('/my-lists');
		await waitForAppHydration(page);

		const button = page.getByRole('button', { name: 'Vytvořit', exact: true });
		await expect(button).toBeVisible();
		const resting = await rect(button);
		const surface = visualSurface(button);
		const restingSurface = await rect(surface);
		const ordinaryShadowOffset = await button.evaluate((element) =>
			Number.parseFloat(
				getComputedStyle(element).getPropertyValue('--elevation-ordinary-offset'),
			),
		);
		expect(ordinaryShadowOffset).toBeGreaterThan(0);
		const point = {
			x: resting.x + resting.width / 2,
			// Exercise the visible lower shadow extension, where hit-region regressions occur.
			y: resting.y + resting.height + ordinaryShadowOffset - 0.25,
		};
		await page.mouse.move(point.x, point.y);
		await expect
			.poll(() =>
				button.evaluate((element, location) => {
					const target = document.elementFromPoint(location.x, location.y);
					return target === element || (target !== null && element.contains(target));
				}, point),
			)
			.toBe(true);

		await expect.poll(async () => (await rect(surface)).y).toBeLessThan(restingSurface.y);
		const hoveredSurface = await rect(surface);
		await page.mouse.down();
		try {
			const samples = await button.evaluate(async (element, location) => {
				const evidence: Array<{ active: boolean; hit: boolean; rect: RectSnapshot }> = [];
				for (let frame = 0; frame < 20; frame += 1) {
					await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
					const target = document.elementFromPoint(location.x, location.y);
					const bounds = element.getBoundingClientRect();
					evidence.push({
						active: element.matches(':active'),
						hit: target === element || (target !== null && element.contains(target)),
						rect: {
							x: bounds.x,
							y: bounds.y,
							width: bounds.width,
							height: bounds.height,
						},
					});
				}
				return evidence;
			}, point);
			expect(samples.every(({ active, hit }) => active && hit)).toBe(true);
			for (const sample of samples) {
				expectSameRect(sample.rect, resting);
			}
			expect(
				(await rect(surface)).y,
				'press feedback moves the lifted face back toward its owner',
			).toBeGreaterThan(hoveredSurface.y);
		} finally {
			await page.mouse.up();
		}
		await expect(page.getByRole('dialog', { name: 'Nový seznam přání' })).toBeVisible();
		await page.context().close();
	});

	test('representative elevated surfaces stay at rest with reduced motion', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('elevation-reduced-motion');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await createWishlistAndNavigate(page, 'Reduced motion surface');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/my-lists');
		await waitForAppHydration(page);

		const create = page.getByRole('button', { name: 'Vytvořit', exact: true });
		const card = page
			.getByTestId('wishlist-card')
			.filter({ hasText: 'Reduced motion surface' });
		for (const owner of [create, card]) {
			const surface = visualSurface(owner);
			const resting = await rect(surface);
			await owner.hover({ force: true });
			for (const sample of await sampleFrameRects(surface)) {
				expectSameRect(sample, resting);
			}
			await page.mouse.move(0, 500);
		}

		await create.click();
		const dialog = page.getByRole('dialog', { name: 'Nový seznam přání' });
		await waitForDialogMotionToSettle(dialog);
		const close = dialog.getByRole('button', { name: 'Zavřít' });
		const closeSurface = visualSurface(close);
		const restingClose = await rect(closeSurface);
		await close.hover();
		for (const sample of await sampleFrameRects(closeSurface)) {
			expectSameRect(sample, restingClose);
		}
		await page.context().close();
	});
});
