import { expect, test, type Locator } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { loginViaApi } from './fixtures/auth-helpers.js';
import { openDesktopDisplaySubmenu, startGiftReorder } from './fixtures/wishlist-helpers.js';
import {
	BROWSER_ZOOMS,
	DEPTHS,
	bottomToTopSweep,
	expectNoStationaryTransitions,
	expectReachable,
	expectSafeClick,
	expectStableLift,
	launchZoomableContext,
	setRealBrowserZoom,
	stationaryLowerEdge,
	type StationaryEvidence,
} from './hover-stability.helpers.js';

test.describe('Issue #346 stable hover hit regions', () => {
	test.describe.configure({ mode: 'default', timeout: 180_000 });

	test('focused gift consumers retain nested hit targets at 1/soft', async ({
		request,
		baseURL,
	}, testInfo) => {
		const cookies = await loginViaApi(request, baseURL!, {
			email: 'martin@test.cz',
			password: ['password', '123'].join(''),
		});
		const context = await launchZoomableContext(testInfo, cookies, baseURL!);
		const page = context.pages()[0] ?? (await context.newPage());
		try {
			await setRealBrowserZoom(page, baseURL!, 1, null);
			await page.locator('html').evaluate((html) => {
				html.dataset.depth = 'soft';
			});
			const cardView = page
				.getByTestId('wishlist-toolbar')
				.getByRole('radio', { name: 'Karta', exact: true })
				.filter({ visible: true });
			await expect(cardView).toBeVisible();
			await cardView.click();
			await expect(page.getByTestId('wishlist-gift-card-grid')).toBeVisible();
			const card = page.locator('[data-gift-item] .elevation-owner-raised').first();
			await expect(card).toBeVisible();
			const stationary = await stationaryLowerEdge(page, card, 'Gift card');
			expectStableLift(stationary);
			const sweep = await bottomToTopSweep(page, card, 'Gift card');
			expect(sweep.interveningUnhovered).toEqual([]);
			const groupingMenu = await openDesktopDisplaySubmenu(page, /^Seskupení/);
			const ungrouped = groupingMenu.getByRole('menuitemradio', {
				name: 'Bez seskupení',
				exact: true,
			});
			await ungrouped.click();
			await expect(ungrouped).toHaveAttribute('aria-checked', 'true');
			await page.keyboard.press('Escape');
			await page.keyboard.press('Escape');
			// Reorder grips only exist while the explicit reorder mode is active.
			await startGiftReorder(page);
			const grip = page
				.getByRole('button', { name: 'Přesunout dárek', exact: true })
				.filter({ visible: true })
				.first();
			await expect(grip).toBeVisible();
			await expectReachable(grip);
			expect(
				await grip.evaluate((element) =>
					element.closest('[data-gift-item]')?.matches(':hover'),
				),
			).toBe(true);
			await writeFile(
				testInfo.outputPath('focused-gift.json'),
				JSON.stringify({ stationary, sweep }, null, 2),
			);
		} finally {
			await context.close();
		}
	});

	test('visitor detail sticker, link row, and circular close retain hit targets at 1/soft', async ({
		baseURL,
	}, testInfo) => {
		const context = await launchZoomableContext(testInfo, [], baseURL!);
		const page = context.pages()[0] ?? (await context.newPage());
		try {
			await setRealBrowserZoom(page, baseURL!, 1, null);
			await page.locator('html').evaluate((html) => {
				html.dataset.depth = 'soft';
			});
			const heading = page.locator('[data-gift-item]').first().getByRole('heading');
			await expect(heading).toBeVisible();
			const giftName = await heading.innerText();
			await page.getByText(giftName, { exact: true }).first().click();
			const dialog = page.getByRole('dialog');
			await expect(dialog).toBeVisible();
			const like = dialog.getByRole('button', {
				name: /(?:Přidat do|Odebrat z) oblíbených:/,
			});
			await expect(like).toBeVisible();
			await expect(like).toHaveClass(/elevation-owner-like/);
			const stationary = await stationaryLowerEdge(page, like, 'Sticker Like');
			expectStableLift(stationary, 1.08);
			const likeSweep = await bottomToTopSweep(page, like, 'Sticker Like');
			expect(likeSweep.interveningUnhovered).toEqual([]);
			await expectSafeClick(page, like);
			const link = dialog.locator('a.elevation-owner-raised[target="_blank"]').first();
			await expect(link).toBeVisible();
			await expect(link).toHaveAttribute('href', /^https?:\/\//);
			const linkSweep = await bottomToTopSweep(page, link, 'Gift link row');
			expect(linkSweep.interveningUnhovered).toEqual([]);
			await expectSafeClick(page, link);
			const close = dialog.getByRole('button', { name: 'Zavřít', exact: true });
			await expect(close).toBeVisible();
			const closeSweep = await bottomToTopSweep(page, close, 'Circular close');
			expect(closeSweep.interveningUnhovered).toEqual([]);
			await expectSafeClick(page, close);
			await expect(dialog).toBeVisible();
			await writeFile(
				testInfo.outputPath('focused-visitor.json'),
				JSON.stringify({ stationary, likeSweep, linkSweep, closeSweep }, null, 2),
			);
		} finally {
			await context.close();
		}
	});

	test('focused dashboard card and depth choice at 1/soft', async ({
		request,
		baseURL,
	}, testInfo) => {
		const cookies = await loginViaApi(request, baseURL!, {
			email: 'martin@test.cz',
			password: ['password', '123'].join(''),
		});
		const context = await launchZoomableContext(testInfo, cookies, baseURL!);
		const page = context.pages()[0] ?? (await context.newPage());
		try {
			await page.goto(`${baseURL}/home?browserZoom=1`, { waitUntil: 'domcontentloaded' });
			await page.locator('html').evaluate((html) => {
				html.dataset.depth = 'soft';
			});
			const card = page.getByTestId('wishlist-card').filter({ visible: true }).first();
			await expect(card).toBeVisible();
			const sweep = await bottomToTopSweep(page, card, 'Dashboard wishlist card');
			expect(sweep.interveningUnhovered).toEqual([]);
			await expect(card).toHaveAttribute('href', /\/w\//);
			await expectSafeClick(page, card);
			await page.goto(`${baseURL}/my-lists?browserZoom=1`, { waitUntil: 'domcontentloaded' });
			const listToggle = page.getByRole('radio', { name: 'Seznam', exact: true });
			await expect(listToggle).toBeVisible();
			await listToggle.click();
			const row = page.locator('main a.elevation-owner-raised[href*="/w/"]').first();
			await expect(row).toBeVisible();
			expect(
				(await bottomToTopSweep(page, row, 'Dashboard list row')).interveningUnhovered,
			).toEqual([]);
			await page.goto(`${baseURL}/settings?browserZoom=1`, { waitUntil: 'domcontentloaded' });
			const depth = page.getByRole('radio', { name: 'Jemné', exact: true });
			await expect(depth).toBeVisible();
			expect(
				(await bottomToTopSweep(page, depth, 'Depth choice')).interveningUnhovered,
			).toEqual([]);
			await writeFile(
				testInfo.outputPath('focused-dashboard.json'),
				JSON.stringify({ sweep }, null, 2),
			);
		} finally {
			await context.close();
		}
	});
	test('stationary lower-edge pointer does not oscillate Display at real zoom/depth combinations', async ({
		request,
		baseURL,
	}, testInfo) => {
		const rawCookies = await loginViaApi(request, baseURL!, {
			email: 'martin@test.cz',
			password: ['password', '123'].join(''),
		});
		const context = await launchZoomableContext(testInfo, rawCookies, baseURL!);
		const page = context.pages()[0] ?? (await context.newPage());
		const evidence: Array<{
			zoom: number;
			depth: (typeof DEPTHS)[number];
			zoomMetrics: { dpr: number; innerWidth: number; outerWidth: number };
			controls: StationaryEvidence[];
		}> = [];
		try {
			let baseline: { dpr: number; innerWidth: number } | null = null;
			for (const zoom of BROWSER_ZOOMS) {
				const zoomMetrics = await setRealBrowserZoom(page, baseURL!, zoom, baseline);
				baseline ??= zoomMetrics;
				for (const depth of DEPTHS) {
					await page
						.locator('html')
						.evaluate((html, value) => (html.dataset.depth = value), depth);
					const controls = [
						await stationaryLowerEdge(
							page,
							page.getByTestId('desktop-display-trigger'),
							'Display',
						),
						await stationaryLowerEdge(
							page,
							page.getByRole('button', { name: /Přidat dárek/ }).first(),
							'Add gift button',
						),
					];
					evidence.push({ zoom, depth, zoomMetrics, controls });
					await page.screenshot({
						path: testInfo.outputPath(`stationary-zoom-${zoom}-${depth}.png`),
					});
				}
			}
			await writeFile(
				testInfo.outputPath('stationary-event-geometry.json'),
				JSON.stringify(evidence, null, 2),
			);

			for (const scenario of evidence) {
				for (const control of scenario.controls) {
					expectNoStationaryTransitions(
						control,
						` at zoom ${scenario.zoom}, depth ${scenario.depth}`,
					);
					expect(control.samples.every(({ hovered }) => hovered)).toBe(true);
					expect(control.hoverTransitions).toBe(0);
					if (control.control === 'Add gift button') {
						expectStableLift(control);
					} else {
						expect(control.verticalTravel).toBeLessThanOrEqual(0.25);
					}
				}
			}
		} finally {
			await context.close();
		}
	});

	test('bottom-to-top traversal has one contiguous hover interval for representative elevated consumers', async ({
		request,
		baseURL,
	}, testInfo) => {
		const rawCookies = await loginViaApi(request, baseURL!, {
			email: 'martin@test.cz',
			password: ['password', '123'].join(''),
		});
		const context = await launchZoomableContext(testInfo, rawCookies, baseURL!);
		const page = context.pages()[0] ?? (await context.newPage());
		const evidence: unknown[] = [];
		try {
			let baseline: { dpr: number; innerWidth: number } | null = null;
			for (const zoom of BROWSER_ZOOMS) {
				const zoomMetrics = await setRealBrowserZoom(page, baseURL!, zoom, baseline);
				baseline ??= zoomMetrics;
				for (const depth of DEPTHS) {
					await page.evaluate(() => window.scrollTo(0, 0));
					await page
						.locator('html')
						.evaluate((html, value) => (html.dataset.depth = value), depth);
					const display = page.getByTestId('desktop-display-trigger');
					await expect(display).toBeVisible();
					const candidates: Array<readonly [string, Locator]> = [
						['Display', display],
						[
							'Add gift button',
							page.getByRole('button', { name: /Přidat dárek/ }).first(),
						],
					];
					if (zoom === 1 && depth === 'soft') {
						candidates.push([
							'Gift card',
							page.locator('[data-gift-item] .elevation-owner-raised').first(),
						]);
					}
					const controls = [];
					for (const [name, locator] of candidates) {
						await expect(locator).toBeVisible();
						await locator.scrollIntoViewIfNeeded();
						controls.push(await bottomToTopSweep(page, locator, name));
					}
					const consumerAudit = await page
						.locator('.elevation-owner-raised')
						.evaluateAll((elements) =>
							elements.slice(0, 30).map((element) => {
								const style = getComputedStyle(element);
								const after = getComputedStyle(element, '::after');
								return {
									tag: element.tagName,
									label:
										element.getAttribute('aria-label') ??
										element.textContent?.trim().slice(0, 80),
									classes: element.className,
									translate: style.translate,
									shadow: style.boxShadow,
									pseudoAfterHeight:
										after.content === 'none'
											? 0
											: Number.parseFloat(after.height) || 0,
								};
							}),
						);
					evidence.push({ zoom, depth, zoomMetrics, controls, consumerAudit });
					await page.screenshot({
						path: testInfo.outputPath(`sweep-zoom-${zoom}-${depth}.png`),
					});
				}
			}
			await writeFile(
				testInfo.outputPath('sweep-event-geometry.json'),
				JSON.stringify(evidence, null, 2),
			);
			for (const scenario of evidence as Array<{
				zoom: number;
				depth: string;
				controls: Awaited<ReturnType<typeof bottomToTopSweep>>[];
			}>) {
				for (const control of scenario.controls) {
					expect(
						control.interveningUnhovered,
						`${control.control} has an unhovered band at zoom ${scenario.zoom}, depth ${scenario.depth}`,
					).toEqual([]);
				}
			}
		} finally {
			await context.close();
		}
	});
});
