import {
	expect,
	test,
	chromium,
	type BrowserContext,
	type Locator,
	type Page,
	type TestInfo,
} from '@playwright/test';
import { rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginViaApi, parseCookiesForContext } from './fixtures/auth-helpers.js';

const DEPTHS = ['soft', 'ink', 'black'] as const;
const BROWSER_ZOOMS = [1, 1.25, 1.5] as const;
const EXTENSION_PATH = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'fixtures/browser-zoom-extension',
);

interface PointerSample {
	time: number;
	hovered: boolean;
	reachable: boolean;
	y: number;
	translateY: number;
}

interface StationaryEvidence {
	control: string;
	coordinate: { x: number; y: number };
	restingRect: { x: number; y: number; width: number; height: number };
	pseudoAfter: { content: string; height: number; top: string };
	events: { enter: number; leave: number; over: number; out: number };
	lowerBoundaryReachable: boolean;
	hoverTransitions: number;
	verticalTravel: number;
	samples: PointerSample[];
}

async function launchZoomableContext(
	testInfo: TestInfo,
	rawCookies: string[],
	baseURL: string,
): Promise<BrowserContext> {
	const profile = testInfo.outputPath('chromium-profile');
	await rm(profile, { recursive: true, force: true });
	const context = await chromium.launchPersistentContext(profile, {
		// Chromium's unpacked-extension support requires headed mode. Linux CI
		// supplies the display with xvfb-run in checks.yml.
		headless: false,
		viewport: { width: 1602, height: 1100 },
		deviceScaleFactor: 2,
		args: [
			`--disable-extensions-except=${EXTENSION_PATH}`,
			`--load-extension=${EXTENSION_PATH}`,
			'--window-size=1602,1100',
		],
	});
	await context.addCookies(parseCookiesForContext(rawCookies, baseURL));
	return context;
}

async function setRealBrowserZoom(
	page: Page,
	baseURL: string,
	zoom: number,
	baseline: { dpr: number; innerWidth: number } | null,
) {
	await page.goto(`${baseURL}/w/xmas2026?browserZoom=${zoom}`, {
		waitUntil: 'domcontentloaded',
	});
	await expect(page.getByTestId('wishlist-toolbar')).toBeVisible();

	await expect
		.poll(() => page.evaluate(() => window.devicePixelRatio))
		.toBeCloseTo((baseline?.dpr ?? 2) * zoom, 1);

	const metrics = await page.evaluate(() => ({
		dpr: window.devicePixelRatio,
		innerWidth: window.innerWidth,
		outerWidth: window.outerWidth,
	}));
	if (baseline !== null) {
		expect(metrics.innerWidth, 'browser zoom must shrink the CSS layout viewport').toBeCloseTo(
			baseline.innerWidth / zoom,
			-1,
		);
	}
	return metrics;
}

async function stationaryLowerEdge(
	page: Page,
	control: Locator,
	controlName: string,
): Promise<StationaryEvidence> {
	await page.mouse.move(1, 1);
	await expect(control).toBeVisible();
	await control.scrollIntoViewIfNeeded();
	await page.waitForTimeout(250);
	const box = await control.boundingBox();
	expect(box).not.toBeNull();
	const restingAfter = await control.evaluate((element) => {
		const after = getComputedStyle(element, '::after');
		return {
			content: after.content,
			height: after.content === 'none' ? 0 : Number.parseFloat(after.height) || 0,
			top: after.top,
		};
	});
	const ordinaryShadowOffset = await control.evaluate((element) =>
		Number.parseFloat(
			getComputedStyle(element).getPropertyValue('--elevation-ordinary-offset'),
		),
	);
	const coordinate = {
		x: box!.x + box!.width / 2,
		// This is the reported lower edge of the resting hard shadow, not merely
		// the DOM border. It is where subpixel rounding exposes the moving buffer.
		y: box!.y + box!.height + ordinaryShadowOffset - 0.25,
	};

	await control.evaluate((element) => {
		type ProbeElement = Element & {
			__hoverProbe?: { enter: number; leave: number; over: number; out: number };
			__hoverProbeInstalled?: boolean;
		};
		const probed = element as ProbeElement;
		probed.__hoverProbe = { enter: 0, leave: 0, over: 0, out: 0 };
		if (probed.__hoverProbeInstalled === true) {
			return;
		}
		probed.__hoverProbeInstalled = true;
		for (const [eventName, key] of [
			['mouseenter', 'enter'],
			['mouseleave', 'leave'],
			['mouseover', 'over'],
			['mouseout', 'out'],
		] as const) {
			element.addEventListener(eventName, () => {
				probed.__hoverProbe![key] += 1;
			});
		}
	});

	const lowerBoundaryReachable = await control.evaluate((element, point) => {
		const target = document.elementFromPoint(point.x, point.y);
		return target !== null && (target === element || element.contains(target));
	}, coordinate);
	expect(lowerBoundaryReachable, `${controlName} resting lower boundary is reachable`).toBe(true);
	await page.mouse.move(coordinate.x, coordinate.y);
	const samples = await control.evaluate(async (element, point) => {
		const frames: PointerSample[] = [];
		const start = performance.now();
		do {
			await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
			const style = getComputedStyle(element);
			const [, translateY = '0'] = style.translate.split(' ');
			const target = document.elementFromPoint(point.x, point.y);
			frames.push({
				reachable: target !== null && (target === element || element.contains(target)),
				time: performance.now() - start,
				hovered: element.matches(':hover'),
				y: element.getBoundingClientRect().y,
				translateY: Number.parseFloat(translateY) || 0,
			});
		} while (performance.now() - start < 650);
		return frames;
	}, coordinate);
	expect(
		samples.every(({ reachable }) => reachable),
		`${controlName} lower boundary stays reachable throughout motion`,
	).toBe(true);

	const events = await control.evaluate((element) => {
		type ProbeElement = Element & {
			__hoverProbe?: { enter: number; leave: number; over: number; out: number };
		};
		return (element as ProbeElement).__hoverProbe!;
	});
	const hoverTransitions = samples.slice(1).filter((sample, index) => {
		return sample.hovered !== samples[index]!.hovered;
	}).length;
	const positions = samples.map(({ y }) => y);

	return {
		control: controlName,
		coordinate,
		restingRect: box!,
		events,
		pseudoAfter: restingAfter,
		lowerBoundaryReachable,
		hoverTransitions,
		verticalTravel: Math.max(...positions) - Math.min(...positions),
		samples,
	};
}

async function bottomToTopSweep(page: Page, control: Locator, controlName: string) {
	await page.mouse.move(1, 1);
	await expect(control).toBeVisible();
	await control.scrollIntoViewIfNeeded();
	await page.waitForTimeout(250);
	const box = await control.boundingBox();
	expect(box).not.toBeNull();
	const afterHeight = await control.evaluate((element) => {
		const style = getComputedStyle(element, '::after');
		return style.content === 'none' ? 0 : Number.parseFloat(style.height) || 0;
	});
	const ordinaryOffset = await control.evaluate((element) =>
		Number.parseFloat(
			getComputedStyle(element).getPropertyValue('--elevation-ordinary-offset'),
		),
	);
	const x = box!.x + box!.width / 2;
	const lowerBoundary = box!.y + box!.height + ordinaryOffset - 0.25;
	const lowerBoundaryReachable = await control.evaluate(
		(element, point) => {
			const target = document.elementFromPoint(point.x, point.y);
			return target !== null && (target === element || element.contains(target));
		},
		{ x, y: lowerBoundary },
	);
	expect(lowerBoundaryReachable, `${controlName} resting shadow edge is reachable`).toBe(true);
	const states: Array<{ y: number; hovered: boolean }> = [];
	for (let y = lowerBoundary; y >= box!.y + 0.5; y -= 1) {
		await page.mouse.move(x, y);
		await page.waitForTimeout(20);
		states.push({ y, hovered: await control.evaluate((element) => element.matches(':hover')) });
	}
	const interveningUnhovered = states.filter(({ hovered }) => !hovered);
	return {
		control: controlName,
		restingRect: box!,
		afterHeight,
		lowerBoundary,
		lowerBoundaryReachable,
		states,
		interveningUnhovered,
	};
}

function expectStableLift(evidence: StationaryEvidence, hoverScale = 1) {
	expect(evidence.events.enter).toBe(1);
	expect(evidence.events.leave).toBe(0);
	expect(evidence.hoverTransitions).toBe(0);
	expect(evidence.samples.every(({ hovered }) => hovered)).toBe(true);
	expect(evidence.verticalTravel).toBeLessThanOrEqual(
		2.25 + (evidence.restingRect.height * (hoverScale - 1)) / 2,
	);
	const positions = evidence.samples.map(({ y }) => y);
	for (let index = 1; index < positions.length; index += 1) {
		expect(positions[index]! - positions[index - 1]!).toBeLessThanOrEqual(0.05);
	}
}

async function expectReachable(control: Locator) {
	await expect(control).toBeVisible();
	await control.hover();
	expect(
		await control.evaluate((element) => {
			const box = element.getBoundingClientRect();
			const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
			return target !== null && (element === target || element.contains(target));
		}),
	).toBe(true);
	await control.click({ trial: true });
}

async function expectSafeClick(page: Page, control: Locator) {
	await expectReachable(control);
	const url = page.url();
	await control.evaluate((element) => {
		element.addEventListener(
			'click',
			(event) => {
				event.preventDefault();
				event.stopImmediatePropagation();
				element.setAttribute('data-hover-probe-clicked', 'true');
			},
			{ capture: true, once: true },
		);
	});
	await control.click();
	await expect(control).toHaveAttribute('data-hover-probe-clicked', 'true');
	expect(page.url()).toBe(url);
}

test.describe('Issue #346 stable hover hit regions', () => {
	test.describe.configure({ timeout: 180_000 });

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
			// Reorder grips only exist while the explicit reorder mode is active.
			// The former selector assumed that setup and intermittently tested no grip.
			await page.getByRole('button', { name: 'Změnit pořadí', exact: true }).click();
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
	test('stationary lower-edge pointer does not oscillate Sort or Grouping at real zoom/depth combinations', async ({
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
					const toolbar = page.getByTestId('wishlist-toolbar');
					const selectTriggers = toolbar.locator('[data-slot="select-trigger"]');
					const controls = [
						await stationaryLowerEdge(page, selectTriggers.nth(0), 'Sort'),
						await stationaryLowerEdge(page, selectTriggers.nth(1), 'Grouping'),
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
					expect(
						control.events.enter,
						`${control.control} lower extension must belong to its effective hit region`,
					).toBe(1);
					expect(
						control.events.leave,
						`${control.control} repeatedly leaves at zoom ${scenario.zoom}, depth ${scenario.depth}`,
					).toBe(0);
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
					const toolbar = page.getByTestId('wishlist-toolbar');
					const selectTriggers = toolbar.locator('[data-slot="select-trigger"]');
					await expect(selectTriggers.nth(0)).toBeVisible();
					await expect(selectTriggers.nth(1)).toBeVisible();
					const candidates: Array<readonly [string, Locator]> = [
						['Sort', selectTriggers.nth(0)],
						['Grouping', selectTriggers.nth(1)],
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
