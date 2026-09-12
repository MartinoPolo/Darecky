import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { addGift, createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

const DEPTHS = ['soft', 'ink', 'black'] as const;

async function shadowState(locator: Locator) {
	return locator.evaluate((element) => {
		const style = getComputedStyle(element);
		const layers = style.boxShadow.match(/(?:[^,(]|\([^)]*\))+/g) ?? [];
		const isVisibleLayer = (layer: string) => {
			if (layer.trim() === 'none' || /\btransparent\b/.test(layer)) {
				return false;
			}
			const alpha =
				layer.match(/rgba\([^)]*,\s*([\d.]+)%?\s*\)/)?.[1] ??
				layer.match(/\([^)]*\/\s*([\d.]+)%?\s*\)/)?.[1];
			return alpha === undefined || Number.parseFloat(alpha) !== 0;
		};
		const visibleLayers = layers.filter(isVisibleLayer);
		const raisedLayer =
			visibleLayers.find((layer) => {
				if (/\binset\b/.test(layer)) {
					return false;
				}
				const lengths = layer.match(/-?\d+(?:\.\d+)?px/g) ?? [];
				return (
					Number.parseFloat(lengths[0] ?? '0') !== 0 ||
					Number.parseFloat(lengths[1] ?? '0') !== 0
				);
			}) ?? '';
		const lengths = raisedLayer.match(/-?\d+(?:\.\d+)?px/g) ?? [];
		return {
			shadow: style.boxShadow,
			hasVisibleShadow: visibleLayers.length > 0,
			x: Number.parseFloat(lengths[0] ?? '0'),
			y: Number.parseFloat(lengths[1] ?? '0'),
			blur: Number.parseFloat(lengths[2] ?? '0'),
			borderWidth: Number.parseFloat(style.borderTopWidth),
			translate: style.translate,
		};
	});
}

async function setDepth(page: Page, depth: (typeof DEPTHS)[number]) {
	await page.locator('html').evaluate((element, value) => {
		element.dataset.depth = value;
	}, depth);
	await page.mouse.move(0, 0);
}

async function expectOffset(locator: Locator, offset: number) {
	await expect
		.poll(async () => shadowState(locator))
		.toMatchObject({
			x: offset,
			y: offset,
			blur: 0,
		});
}

test('semantic depth stays responsive and color-only across representative wishlist surfaces', async ({
	browser,
	request,
	baseURL,
}, testInfo) => {
	const user = createTestUser('responsive-shadow-depth');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	await createWishlistAndNavigate(page, 'Responsive shadow depth');
	await addGift(page, 'Representative raised gift');

	const button = page.getByRole('button', { name: /Přidat dárek/ }).first();
	const card = page
		.locator('[data-gift-item] .elevation-owner-raised > .elevation-surface')
		.first();
	const toolbar = page.locator('.wishlist-toolbar');
	const tray = page.getByTestId('gift-view-switcher');
	const account = page.getByRole('button', { name: new RegExp(user.name) });
	// Semantic owners are intentionally shadowless and stationary; depth is paint on the surface.
	// The view tray is deliberately flat because the containing toolbar owns this depth level.
	const surfaces = [
		button.locator(':scope > .elevation-surface'),
		card,
		toolbar,
		account.locator(':scope > .elevation-surface'),
	];
	await expect
		.poll(() => shadowState(tray).then(({ hasVisibleShadow }) => hasVisibleShadow))
		.toBe(false);

	for (const { width, offset } of [
		{ width: 390, offset: 3 },
		{ width: 1280, offset: 4 },
	]) {
		await page.setViewportSize({ width, height: 900 });
		const geometryByDepth: Array<
			Array<Pick<Awaited<ReturnType<typeof shadowState>>, 'x' | 'y' | 'blur'>>
		> = [];
		const colors: string[] = [];

		for (const depth of DEPTHS) {
			await setDepth(page, depth);
			for (const surface of surfaces) {
				await expectOffset(surface, offset);
			}
			const states = await Promise.all(surfaces.map(shadowState));
			geometryByDepth.push(states.map(({ x, y, blur }) => ({ x, y, blur })));
			colors.push(states[0].shadow);
			await page.screenshot({
				path: testInfo.outputPath(`shadow-${width}-${depth}-light.png`),
				fullPage: true,
			});
		}

		expect(geometryByDepth[1]).toEqual(geometryByDepth[0]);
		expect(geometryByDepth[2]).toEqual(geometryByDepth[0]);
		expect(new Set(colors).size).toBe(3);
	}

	for (const width of [320, 390, 640, 1280]) {
		await page.setViewportSize({ width, height: 900 });
		await setDepth(page, 'black');
		const expectedOffset = width < 640 ? 3 : 4;
		for (const surface of surfaces) {
			await expectOffset(surface, expectedOffset);
			const paintBounds = await surface.evaluate((element) => {
				const rect = element.getBoundingClientRect();
				const style = getComputedStyle(element);
				const layers = style.boxShadow.match(/(?:[^,(]|\([^)]*\))+/g) ?? [];
				const raisedLayer =
					layers.find((layer) => {
						if (/\binset\b/.test(layer)) {
							return false;
						}
						const lengths = layer.match(/-?\d+(?:\.\d+)?px/g) ?? [];
						return (
							Number.parseFloat(lengths[0] ?? '0') !== 0 ||
							Number.parseFloat(lengths[1] ?? '0') !== 0
						);
					}) ?? '';
				const lengths = raisedLayer.match(/-?\d+(?:\.\d+)?px/g) ?? [];
				const x = Number.parseFloat(lengths[0] ?? '0');
				const y = Number.parseFloat(lengths[1] ?? '0');
				return {
					left: rect.left + Math.min(0, x),
					right: rect.right + Math.max(0, x),
					top: rect.top + Math.min(0, y),
					viewportWidth: document.documentElement.clientWidth,
				};
			});
			expect(paintBounds.left).toBeGreaterThanOrEqual(0);
			expect(paintBounds.right).toBeLessThanOrEqual(paintBounds.viewportWidth);
			expect(paintBounds.top).toBeGreaterThanOrEqual(0);
		}
	}

	await page.setViewportSize({ width: 1280, height: 900 });
	await setDepth(page, 'black');
	await card.hover();
	await expectOffset(card, 7);
	await page.mouse.move(0, 0);
	await button.hover();
	await page.mouse.down();
	await expectOffset(button.locator(':scope > .elevation-surface'), 2);
	await page.mouse.move(0, 0);
	await page.mouse.up();
	await button.evaluate((element) => element.setAttribute('disabled', ''));
	await expect
		.poll(() =>
			shadowState(button.locator(':scope > .elevation-surface')).then(
				({ hasVisibleShadow }) => hasVisibleShadow,
			),
		)
		.toBe(false);
	await button.evaluate((element) => element.removeAttribute('disabled'));

	const restingBox = await account.boundingBox();
	await account.click();
	await expect(account).toHaveAttribute('aria-expanded', 'true');
	await expectOffset(account.locator(':scope > .elevation-surface'), 4);
	const openBox = await account.boundingBox();
	expect(Math.abs(openBox!.y - restingBox!.y)).toBeLessThan(0.25);
	const accountLayers = await account.evaluate((element) => {
		const surface = element.querySelector(':scope > .elevation-surface');
		const avatar = element.querySelector('[data-slot="avatar"]');
		return {
			owner: shadowStateValue(getComputedStyle(element)),
			surface: surface === null ? null : shadowStateValue(getComputedStyle(surface)),
			avatar: avatar === null ? null : shadowStateValue(getComputedStyle(avatar)),
		};

		function shadowStateValue(style: CSSStyleDeclaration) {
			const layers = style.boxShadow.match(/(?:[^,(]|\([^)]*\))+/g) ?? [];
			const hasVisibleShadow = layers.some((layer) => {
				if (layer.trim() === 'none' || /\btransparent\b/.test(layer)) {
					return false;
				}
				const alpha =
					layer.match(/rgba\([^)]*,\s*([\d.]+)%?\s*\)/)?.[1] ??
					layer.match(/\([^)]*\/\s*([\d.]+)%?\s*\)/)?.[1];
				return alpha === undefined || Number.parseFloat(alpha) !== 0;
			});
			return {
				hasVisibleShadow,
				borderWidth: Number.parseFloat(style.borderTopWidth),
			};
		}
	});
	expect(accountLayers.owner).toEqual({ hasVisibleShadow: false, borderWidth: 0 });
	expect(accountLayers.surface?.hasVisibleShadow).toBe(true);
	expect(accountLayers.surface!.borderWidth).toBeGreaterThan(0);
	expect(accountLayers.avatar).toEqual({ hasVisibleShadow: false, borderWidth: 0 });

	await page.keyboard.press('Escape');
	await page.locator('html').evaluate((element) => element.classList.add('dark'));
	await page.screenshot({
		path: testInfo.outputPath('shadow-1280-black-dark-nested-palette.png'),
		fullPage: true,
	});
	await page.context().close();
});
