#!/usr/bin/env node
/**
 * Read-only visual/geometry verification for issues 353/357/359.
 * Requires an already-running, explicitly assigned local base URL. It never starts a server,
 * seeds data, or activates gift mutation controls.
 *
 * Usage: node scripts/verify-wishlist-geometry.mjs --base "$MPX_APP_URL"
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const arg = (name) => {
	const index = args.indexOf(`--${name}`);
	return index < 0 ? undefined : args[index + 1];
};
const base = arg('base') ?? process.env.MPX_APP_URL ?? process.env.PLAYWRIGHT_BASE_URL;
if (!base) {
	throw new Error(
		'No assigned URL. Pass --base or set MPX_APP_URL/PLAYWRIGHT_BASE_URL; no port fallback is allowed.',
	);
}
const origin = new URL(base).origin;
// The assigned Vite port may differ from the auth base URL in the inherited dev-server
// environment. BetterAuth validates Origin while setting cookies for the request host, so keep
// navigation on the requested target but allow the configured local auth origin.
const authOrigin = arg('auth-origin') ?? process.env.ORIGIN ?? origin;
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) {
	throw new Error(`Refusing non-loopback target: ${origin}`);
}

const outDir = resolve(arg('out') ?? 'test-results/wishlist-geometry');
await mkdir(outDir, { recursive: true });
const requiredEnvironment = ['SEED_PASSWORD', 'TURNSTILE_TEST_TOKEN'];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);
if (missingEnvironment.length > 0) {
	throw new Error(`Missing required environment variable(s): ${missingEnvironment.join(', ')}`);
}
const { SEED_PASSWORD: password } = process.env;
const turnstileToken = process.env.TURNSTILE_TEST_TOKEN;
const MATRIX = [
	{ role: 'mine', route: '/w/xmas2026', title: 'Vánoce 2026', minGifts: 10 },
	{ role: 'moderated', route: '/w/knihy026', title: 'Knihy 2026', minGifts: 1 },
	{ role: 'followed', route: '/w/svatekjn', title: 'Přání k svátku', minGifts: 1 },
];
const VIEWPORTS = [
	{ name: 'desktop', width: 1280, height: 900 },
	{ name: 'mobile', width: 390, height: 844 },
];
const MODES = ['card', 'list'];
const failures = new Set();
const diagnostics = [];
const touchFailures = new Set();
const actionGeometryStats = {
	visibleSurfaces: 0,
	mobileTargets: 0,
	touchExtensionPasses: 0,
	touchExtensionFailures: 0,
	targetPairsChecked: 0,
	targetOverlaps: 0,
};
const check = (condition, message) => {
	if (!condition) {
		failures.add(message);
	}
};
const box = async (locator) => {
	const value = await locator.boundingBox();
	if (!value) {
		throw new Error(`Missing box for ${locator}`);
	}
	return value;
};
const visibleSurface = (owner) => owner.locator(':scope > .elevation-surface');

async function settle(page) {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			await page.locator('[data-testid="wishlist-page-shell"]').waitFor({ state: 'visible' });
			await page.evaluate(async () => {
				await document.fonts.ready;
				await Promise.all(
					document
						.getAnimations()
						.map((animation) => animation.finished.catch(() => undefined)),
				);
			});
			return;
		} catch (error) {
			if (!String(error).includes('Execution context was destroyed') || attempt === 2) {
				throw error;
			}
			await page.waitForLoadState('load');
		}
	}
}

async function selectMode(page, mode) {
	const control = page.getByTestId(`gift-view-${mode}`);
	await control.click();
	await page.locator(`[data-wishlist-gift-collection][data-view-mode="${mode}"]`).waitFor();
	await settle(page);
}

async function assertRoleState(page, scenario, label) {
	check(
		(await page.getByRole('heading', { name: scenario.title, level: 1 }).count()) > 0,
		`${label}: wrong wishlist fixture`,
	);
	check(
		(await page.locator('[data-gift-item]').count()) >= scenario.minGifts,
		`${label}: seeded gift fixture is incomplete`,
	);
	const reserveCount = await page.getByTestId('reserve-button').count();
	const receivedCount = await page.getByTestId('gift-received-toggle').count();
	const likeCount = await page.locator('button:has([data-like-heart])').count();
	if (scenario.role === 'mine') {
		check(reserveCount === 0, `${label}: recipient exposes Reserve`);
		check(receivedCount > 0, `${label}: recipient lacks Received action`);
		check(likeCount === 0, `${label}: recipient exposes Like`);
	} else if (scenario.role === 'moderated') {
		check(
			reserveCount > 0 && receivedCount > 0,
			`${label}: manager action capabilities are incomplete`,
		);
		check(
			(await page.getByText(/Rezervováno vámi|Reserved by you/).count()) > 0,
			`${label}: own-reservation state missing`,
		);
		check(
			(await page.getByText(/Volné 1\/2|1 of 2 available/).count()) > 0,
			`${label}: partial-quantity state missing`,
		);
	} else {
		check(
			reserveCount > 0 && receivedCount === 0 && likeCount > 0,
			`${label}: followed-view capabilities are incorrect`,
		);
		check(
			(await page.getByText(/Rezervováno vámi|Reserved by you/).count()) > 0,
			`${label}: own-reservation state missing`,
		);
		check(
			(await page.getByText(/Volné 2\/3|2 of 3 available/).count()) > 0,
			`${label}: partial-quantity state missing`,
		);
	}
}

async function assertInputMode(page, label, mobile) {
	const input = await page.evaluate(() => ({
		coarse: matchMedia('(pointer: coarse)').matches,
		fine: matchMedia('(pointer: fine)').matches,
		maxTouchPoints: navigator.maxTouchPoints,
	}));
	if (mobile) {
		check(
			input.coarse && !input.fine && input.maxTouchPoints > 0,
			`${label}: mobile context is not touch/coarse (${JSON.stringify(input)})`,
		);
	} else {
		check(
			input.fine && !input.coarse && input.maxTouchPoints === 0,
			`${label}: desktop context is not mouse/fine (${JSON.stringify(input)})`,
		);
	}
}

async function assertActionGeometry(page, label, mobile) {
	const items = page.locator('[data-gift-item]:visible');
	for (let i = 0; i < Math.min(await items.count(), 8); i += 1) {
		const item = items.nth(i);
		const actions = item.locator(
			'[data-testid="gift-action-row"] [data-slot="button"]:visible',
		);
		for (let j = 0; j < (await actions.count()); j += 1) {
			const owner = actions.nth(j);
			if (mobile) {
				await owner.evaluate((element) =>
					element.scrollIntoView({ block: 'center', inline: 'center' }),
				);
			}
			const surface = visibleSurface(owner);
			const surfaceBox = await box(surface);
			actionGeometryStats.visibleSurfaces += 1;
			check(
				Math.abs(surfaceBox.height - 32) <= 0.75,
				`${label}: action surface is ${surfaceBox.height}px, expected 32px`,
			);
			const icon = surface.locator('svg').first();
			if (await icon.count()) {
				const iconBox = await box(icon);
				check(
					iconBox.width <= 16.75 && iconBox.height <= 16.75,
					`${label}: action icon exceeds 16px`,
				);
			}
			if (mobile) {
				const ownerBox = await box(owner);
				const hitRegion = await owner.evaluate((element) => {
					const rect = element
						.querySelector(':scope > .elevation-surface')
						?.getBoundingClientRect();
					if (!rect) {
						return { expanded: false, hits: false };
					}
					const before = getComputedStyle(element, '::before');
					const expanded =
						before.content !== 'none' &&
						before.position === 'absolute' &&
						['top', 'right', 'bottom', 'left'].every(
							(side) => Math.abs(parseFloat(before[side]) + 4) <= 0.1,
						);
					// Sample safely inside the 4px pseudo-element extension. At 3.5px, Chromium's
					// device-pixel hit-test rounding can choose the adjacent target where two
					// non-overlapping expansions meet exactly in an 8px gap.
					const hits = [
						[rect.x + rect.width / 2, rect.y - 2],
						[rect.x + rect.width / 2, rect.bottom + 2],
						[rect.x - 2, rect.y + rect.height / 2],
						[rect.right + 2, rect.y + rect.height / 2],
					].every(([x, y]) => {
						const hitNode = document.elementFromPoint(x, y);
						return hitNode === element || element.contains(hitNode);
					});
					return { expanded, hits };
				});
				actionGeometryStats.mobileTargets += 1;
				if (hitRegion.expanded && hitRegion.hits) {
					actionGeometryStats.touchExtensionPasses += 1;
				} else {
					actionGeometryStats.touchExtensionFailures += 1;
				}
				if ((!hitRegion.expanded || !hitRegion.hits) && !touchFailures.has(label)) {
					touchFailures.add(label);
					check(
						false,
						`${label}: 32px mobile surface lacks a distinct 40px hit region (owner ${ownerBox.width.toFixed(1)}x${ownerBox.height.toFixed(1)}, surface ${surfaceBox.width.toFixed(1)}x${surfaceBox.height.toFixed(1)}, pseudo=${hitRegion.expanded}, elementFromPoint=${hitRegion.hits})`,
					);
				}
			}
		}
		if (mobile) {
			const owners = await actions.evaluateAll((elements) =>
				elements.map((element) => {
					const rect = element.getBoundingClientRect();
					return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
				}),
			);
			for (let left = 0; left < owners.length; left += 1) {
				for (let right = left + 1; right < owners.length; right += 1) {
					const a = owners[left];
					const b = owners[right];
					const expandedX =
						Math.min(a.right + 4, b.right + 4) - Math.max(a.x - 4, b.x - 4);
					const expandedY =
						Math.min(a.bottom + 4, b.bottom + 4) - Math.max(a.y - 4, b.y - 4);
					const overlaps = expandedX > 0.25 && expandedY > 0.25;
					actionGeometryStats.targetPairsChecked += 1;
					if (overlaps) {
						actionGeometryStats.targetOverlaps += 1;
					}
					check(
						!overlaps,
						`${label}: adjacent expanded action targets ${left + 1}/${right + 1} overlap by ${expandedX.toFixed(1)}x${expandedY.toFixed(1)}px`,
					);
				}
			}
		}
		const lastAction = actions.last();
		if (await lastAction.count()) {
			const [itemBox, actionBox] = await Promise.all([
				box(item),
				box(visibleSurface(lastAction)),
			]);
			const right = itemBox.x + itemBox.width - (actionBox.x + actionBox.width);
			const bottom = itemBox.y + itemBox.height - (actionBox.y + actionBox.height);
			check(
				Math.abs(right - bottom) <= 1.25,
				`${label}: visible right/bottom insets differ (${right.toFixed(1)} vs ${bottom.toFixed(1)})`,
			);
		}
	}
}

async function assertControlContinuity(page, label) {
	const controls = page.locator(
		'[data-testid="gift-more-actions"]:visible, [data-testid="desktop-more-trigger"]:visible, [data-testid="mobile-more-trigger"]:visible, [data-testid="desktop-header-more-trigger"]:visible, [data-testid="mobile-header-more-trigger"]:visible',
	);
	for (let i = 0; i < (await controls.count()); i += 1) {
		const control = controls.nth(i);
		const surface = visibleSurface(control);
		const surfaceBox = await box(surface);
		const icon = surface.locator('svg').first();
		check(
			Math.abs(surfaceBox.height - 32) <= 0.75,
			`${label}: More surface is ${surfaceBox.height.toFixed(1)}px, expected shared md 32px`,
		);
		if (await icon.count()) {
			const iconBox = await box(icon);
			check(
				Math.abs(iconBox.width - 16) <= 0.75 && Math.abs(iconBox.height - 16) <= 0.75,
				`${label}: More icon is ${iconBox.width.toFixed(1)}x${iconBox.height.toFixed(1)}, expected 16x16px`,
			);
		}
	}
	const toolbar = page.getByTestId('wishlist-toolbar');
	if (await toolbar.count()) {
		const [toolbarBox, surfaces] = await Promise.all([
			box(toolbar),
			toolbar.locator('[data-slot="button"]:visible > .elevation-surface').all(),
		]);
		if (surfaces.length) {
			const boxes = await Promise.all(surfaces.map((surface) => box(surface)));
			const top = Math.min(...boxes.map((value) => value.y)) - toolbarBox.y;
			const bottom =
				toolbarBox.y +
				toolbarBox.height -
				Math.max(...boxes.map((value) => value.y + value.height));
			const right =
				toolbarBox.x +
				toolbarBox.width -
				Math.max(...boxes.map((value) => value.x + value.width));
			check(
				Math.abs(top - bottom) <= 2,
				`${label}: toolbar visible vertical insets differ (${top.toFixed(1)} vs ${bottom.toFixed(1)}px)`,
			);
			check(
				right >= top - 1 && right <= top + 10,
				`${label}: toolbar right inset ${right.toFixed(1)}px is unbalanced against vertical ${top.toFixed(1)}px`,
			);
		}
	}
}

async function assertLikeGeometry(page, label) {
	const like = page.locator('[data-gift-item]:visible button:has([data-like-heart])').first();
	if (!(await like.count())) {
		return;
	}
	const item = like.locator('xpath=ancestor::*[@data-gift-item]').first();
	const [itemBox, likeBox] = await Promise.all([box(item), box(visibleSurface(like))]);
	const top = likeBox.y - itemBox.y;
	const right = itemBox.x + itemBox.width - likeBox.x - likeBox.width;
	check(
		Math.abs(top - right) <= 1.25,
		`${label}: Like visible top/right insets differ (${top.toFixed(1)} vs ${right.toFixed(1)})`,
	);
	if (await item.getByTestId('gift-list-item').count()) {
		const thumb = await box(item.getByTestId('gift-list-image'));
		check(
			likeBox.x >= thumb.x + thumb.width,
			`${label}: list Like is anchored to thumbnail rather than full item`,
		);
	}
}

async function assertStableList(page, label) {
	const rows = page.getByTestId('gift-list-item');
	check((await rows.count()) > 0, `${label}: no list rows`);
	for (let i = 0; i < Math.min(await rows.count(), 8); i += 1) {
		const row = rows.nth(i);
		const [rowBox, imageBox] = await Promise.all([
			box(row),
			box(row.getByTestId('gift-list-image')),
		]);
		check(
			imageBox.width < rowBox.width * 0.5,
			`${label}: row ${i + 1} cardified (image ${imageBox.width}/${rowBox.width})`,
		);
		check(
			Math.abs(imageBox.width - imageBox.height) <= 1,
			`${label}: row ${i + 1} thumbnail is not square`,
		);
		const direction = await row.evaluate((element) => getComputedStyle(element).flexDirection);
		check(direction !== 'column', `${label}: row ${i + 1} uses column/card layout`);
	}
}

async function assertOverlaySeparation(page, label) {
	const items = page.locator('[data-gift-item]:visible');
	for (let i = 0; i < (await items.count()); i += 1) {
		const item = items.nth(i);
		const like = item.locator('button:has([data-like-heart]):visible').first();
		const overlay = item.getByTestId('gift-state-overlay');
		if (!(await like.count()) || !(await overlay.count())) {
			continue;
		}
		const [likeBox, overlayBox] = await Promise.all([box(visibleSurface(like)), box(overlay)]);
		const overlaps = !(
			likeBox.x + likeBox.width <= overlayBox.x ||
			overlayBox.x + overlayBox.width <= likeBox.x ||
			likeBox.y + likeBox.height <= overlayBox.y ||
			overlayBox.y + overlayBox.height <= likeBox.y
		);
		check(
			!overlaps,
			`${label}: Like overlaps centered state overlay (Like ${likeBox.x.toFixed(1)},${likeBox.y.toFixed(1)},${likeBox.width.toFixed(1)}x${likeBox.height.toFixed(1)}; overlay ${overlayBox.x.toFixed(1)},${overlayBox.y.toFixed(1)},${overlayBox.width.toFixed(1)}x${overlayBox.height.toFixed(1)})`,
		);
	}
}

async function assertStableReceivedWidth(page, label) {
	const controls = page.getByTestId('gift-received-toggle');
	const widths = [];
	for (let i = 0; i < (await controls.count()); i += 1) {
		const control = controls.nth(i);
		if (await control.isVisible()) {
			widths.push((await box(visibleSurface(control))).width);
		}
	}
	if (widths.length > 1) {
		check(
			Math.max(...widths) - Math.min(...widths) <= 1,
			`${label}: Received visible width changes by state/siblings (${Math.min(...widths).toFixed(1)}�${Math.max(...widths).toFixed(1)}px)`,
		);
	}
}

async function assertMoreParity(page, label) {
	const items = page.locator('[data-gift-item]:visible');
	for (let i = 0; i < (await items.count()); i += 1) {
		const item = items.nth(i);
		const more = item.getByTestId('gift-more-actions');
		const reserve = item.getByTestId('reserve-button');
		if (
			!(await more.count()) ||
			!(await reserve.count()) ||
			!(await more.isVisible()) ||
			!(await reserve.isVisible())
		) {
			continue;
		}
		const [moreBox, reserveBox] = await Promise.all([
			box(visibleSurface(more)),
			box(visibleSurface(reserve)),
		]);
		check(
			Math.abs(moreBox.height - reserveBox.height) <= 0.75 &&
				Math.abs(moreBox.height - 32) <= 0.75,
			`${label}: More/Reserve visible heights diverge (${moreBox.height.toFixed(1)} vs ${reserveBox.height.toFixed(1)}px; expected 32px)`,
		);
	}
}

async function captureRootFontParity(page) {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto(`${origin}/w/miminko1`, { waitUntil: 'load' });
	await settle(page);
	await page.evaluate(() => document.documentElement.style.setProperty('font-size', '200%'));
	for (const mode of MODES) {
		await selectMode(page, mode);
		const label = `root-font-200/${mode}`;
		await assertMoreParity(page, label);
		await page.screenshot({
			path: resolve(outDir, `${label.replaceAll('/', '-')}.png`),
			fullPage: true,
		});
	}
	await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
}

async function captureMobileBoundaries(page) {
	for (const width of [320, 360]) {
		await page.setViewportSize({ width, height: 844 });
		await page.goto(`${origin}/w/miminko1`, { waitUntil: 'load' });
		await settle(page);
		for (const mode of MODES) {
			await selectMode(page, mode);
			const label = `mobile-${width}/${mode}/moderated-no-image`;
			await assertActionGeometry(page, label, true);
			await assertStableReceivedWidth(page, label);
			if (mode === 'card') {
				await assertOverlaySeparation(page, label);
			}
			if (mode === 'list') {
				await assertStableList(page, label);
			}
			await page.screenshot({
				path: resolve(outDir, `${label.replaceAll('/', '-')}.png`),
				fullPage: true,
			});
		}
	}
}

async function captureForced144Card(page) {
	await page.setViewportSize({ width: 320, height: 844 });
	await page.goto(`${origin}/w/miminko1`, { waitUntil: 'load' });
	await settle(page);
	await selectMode(page, 'card');
	const firstItem = page.locator('[data-gift-item]:visible').first();
	await firstItem.locator('..').evaluate((element) => {
		element.style.gridTemplateColumns = 'repeat(2, 144px)';
		element.style.columnGap = '8px';
	});
	const firstWidth = (await box(firstItem)).width;
	check(
		Math.abs(firstWidth - 144) <= 0.75,
		`forced-144/card: test cell is ${firstWidth.toFixed(1)}px, expected 144px`,
	);
	await assertOverlaySeparation(page, 'forced-144/card');
	await page.screenshot({
		path: resolve(outDir, 'mobile-320-card-forced-144.png'),
		fullPage: true,
	});
}

async function captureSheets(page) {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`${origin}/w/knihy026`, { waitUntil: 'load' });
	await settle(page);
	const samples = [];
	for (const [name, trigger] of [
		[
			'hero',
			page.getByTestId('wishlist-mobile-hero').getByTestId('mobile-header-more-trigger'),
		],
		['toolbar', page.getByTestId('mobile-more-trigger')],
	]) {
		await trigger.click();
		const sheet = page.locator('.wishlist-bottom-sheet:visible');
		await sheet.waitFor();
		await page.evaluate(async () => {
			await Promise.all(
				document
					.getAnimations()
					.map((animation) => animation.finished.catch(() => undefined)),
			);
		});
		samples.push(
			await sheet.evaluate((element) => {
				const s = getComputedStyle(element);
				const r = element.getBoundingClientRect();
				return {
					x: r.x,
					width: r.width,
					borderRadius: s.borderRadius,
					borderTop: s.borderTopWidth,
					borderBottom: s.borderBottomWidth,
				};
			}),
		);
		await page.screenshot({ path: resolve(outDir, `sheet-${name}.png`), fullPage: true });
		await page.keyboard.press('Escape');
		await sheet.waitFor({ state: 'hidden' });
	}
	check(
		JSON.stringify(samples[0]) === JSON.stringify(samples[1]),
		'Hero and toolbar sheets do not share WishlistBottomSheet geometry',
	);
	for (const [index, sample] of samples.entries()) {
		check(
			sample.x >= 8 && sample.x + sample.width <= 382,
			`Sheet ${index + 1} is not horizontally inset within 8px`,
		);
		check(
			parseFloat(sample.borderRadius) >= 12,
			`Sheet ${index + 1} lacks rounded surface corners (${sample.borderRadius})`,
		);
		check(
			parseFloat(sample.borderTop) > 0,
			`Sheet ${index + 1} lacks the shared bounded top/side treatment`,
		);
	}
}

async function captureDropdown(page) {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto(`${origin}/w/knihy026`, { waitUntil: 'load' });
	await settle(page);
	await page.getByTestId('desktop-more-trigger').click();
	const menu = page.getByRole('menu', { name: /Další možnosti|More options/ });
	await menu.waitFor();
	const rows = menu.getByRole('menuitem');
	for (let i = 0; i < (await rows.count()); i += 1) {
		const row = rows.nth(i);
		const metrics = await row.evaluate((element) => ({
			scrollWidth: element.scrollWidth,
			clientWidth: element.clientWidth,
			height: element.getBoundingClientRect().height,
			lineHeight: parseFloat(getComputedStyle(element).lineHeight),
		}));
		check(
			metrics.scrollWidth <= metrics.clientWidth + 1,
			`Dropdown item ${i + 1} clips horizontally`,
		);
		check(
			metrics.height <= metrics.lineHeight + 16,
			`Dropdown item ${i + 1} wraps despite available viewport width`,
		);
	}
	const menuBox = await box(menu);
	check(
		menuBox.x >= 8 && menuBox.x + menuBox.width <= 1272,
		'Dropdown escapes the 8px viewport collision boundary',
	);
	await page.screenshot({ path: resolve(outDir, 'desktop-more-dropdown.png'), fullPage: true });
	await page.setViewportSize({ width: 640, height: 900 });
	await page.evaluate(async () => {
		await Promise.all(
			document.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
		);
	});
	const narrowBox = await box(menu);
	check(
		narrowBox.x >= 8 && narrowBox.x + narrowBox.width <= 632,
		`Dropdown narrow fallback escapes viewport (${narrowBox.x.toFixed(1)}..${(narrowBox.x + narrowBox.width).toFixed(1)})`,
	);
	for (let i = 0; i < (await rows.count()); i += 1) {
		const row = rows.nth(i);
		const metrics = await row.evaluate((element) => ({
			scrollWidth: element.scrollWidth,
			clientWidth: element.clientWidth,
			height: element.getBoundingClientRect().height,
			lineHeight: parseFloat(getComputedStyle(element).lineHeight),
		}));
		check(
			metrics.scrollWidth <= metrics.clientWidth + 1 &&
				metrics.height <= metrics.lineHeight + 16,
			`Dropdown narrow item ${i + 1} clips or wraps despite fitting viewport`,
		);
	}
	await page.screenshot({
		path: resolve(outDir, 'desktop-more-dropdown-640.png'),
		fullPage: true,
	});
}

const browser = await chromium.launch({ channel: 'chrome' });
const contexts = [];

async function authenticatedContext(options) {
	const context = await browser.newContext(options);
	contexts.push(context);
	const response = await context.request.post(`${origin}/api/auth/sign-in/email`, {
		headers: {
			Origin: authOrigin,
			'x-captcha-response': turnstileToken,
		},
		data: { email: 'martin@test.cz', password },
	});
	if (!response.ok()) {
		throw new Error(`Seed login failed (${response.status()}): ${await response.text()}`);
	}
	return context;
}

function instrument(page) {
	page.on('pageerror', (error) => failures.add(`pageerror: ${error.message}`));
	page.on('console', (message) => {
		if (message.type() === 'error') {
			diagnostics.push(`console ${page.url()}: ${message.text()}`);
		}
	});
	page.on('requestfailed', (request) =>
		diagnostics.push(
			`requestfailed ${request.method()} ${new URL(request.url()).pathname}: ${request.failure()?.errorText ?? 'unknown'}`,
		),
	);
	page.on('response', (response) => {
		if (response.status() >= 400) {
			diagnostics.push(
				`HTTP ${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`,
			);
		}
	});
}

async function capturePrimary(page, viewport) {
	await page.setViewportSize(viewport);
	for (const scenario of MATRIX) {
		await page.goto(`${origin}${scenario.route}`, { waitUntil: 'load' });
		await settle(page);
		for (const mode of MODES) {
			await selectMode(page, mode);
			const label = `${viewport.name}/${mode}/${scenario.role}`;
			await assertInputMode(page, label, viewport.name === 'mobile');
			await assertRoleState(page, scenario, label);
			await assertActionGeometry(page, label, viewport.name === 'mobile');
			await assertControlContinuity(page, label);
			await assertLikeGeometry(page, label);
			if (mode === 'list') {
				await assertStableList(page, label);
			}
			check(
				await page.evaluate(
					() =>
						document.documentElement.scrollWidth <=
						document.documentElement.clientWidth,
				),
				`${label}: horizontal overflow`,
			);
			await page.screenshot({
				path: resolve(outDir, `${label.replaceAll('/', '-')}.png`),
				fullPage: true,
			});
		}
	}
}

try {
	const desktopContext = await authenticatedContext({
		viewport: { width: 1280, height: 900 },
		hasTouch: false,
	});
	const mobileContext = await authenticatedContext({
		viewport: { width: 390, height: 844 },
		hasTouch: true,
	});
	const desktopPage = await desktopContext.newPage();
	const mobilePage = await mobileContext.newPage();
	instrument(desktopPage);
	instrument(mobilePage);

	await capturePrimary(desktopPage, VIEWPORTS[0]);
	await capturePrimary(mobilePage, VIEWPORTS[1]);
	await captureMobileBoundaries(mobilePage);
	await captureForced144Card(mobilePage);
	await captureSheets(mobilePage);
	await captureDropdown(desktopPage);
	await captureRootFontParity(desktopPage);
} finally {
	await Promise.allSettled(contexts.map((context) => context.close()));
	await browser.close();
}

const primaryLabels = VIEWPORTS.flatMap((viewport) =>
	MATRIX.flatMap((scenario) => MODES.map((mode) => `${viewport.name}/${mode}/${scenario.role}`)),
);
const failureList = [...failures];
const report = {
	target: origin,
	generatedAt: new Date().toISOString(),
	emulation: {
		desktop: { hasTouch: false, pointer: 'fine' },
		mobile: { hasTouch: true, pointer: 'coarse' },
	},
	actionGeometry: actionGeometryStats,
	cells: primaryLabels.map((label) => ({
		label,
		result: failureList.some((failure) => failure.startsWith(`${label}:`)) ? 'FAIL' : 'PASS',
		screenshot: resolve(outDir, `${label.replaceAll('/', '-')}.png`),
		failures: failureList.filter((failure) => failure.startsWith(`${label}:`)),
	})),
	additionalChecks: {
		mobileEdges: [
			'mobile-320/card/moderated-no-image',
			'mobile-320/list/moderated-no-image',
			'mobile-360/card/moderated-no-image',
			'mobile-360/list/moderated-no-image',
			'mobile-320-card-forced-144.png',
		],
		sheets: ['sheet-hero.png', 'sheet-toolbar.png'],
		dropdown: ['desktop-more-dropdown.png', 'desktop-more-dropdown-640.png'],
		rootFont200: ['root-font-200-card.png', 'root-font-200-list.png'],
	},
	failures: failureList,
	diagnostics: [...new Set(diagnostics)],
};
await writeFile(resolve(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const markdown = [
	'# Wishlist geometry browser matrix',
	'',
	`Target: ${origin}`,
	`Generated: ${report.generatedAt}`,
	`Emulation: desktop hasTouch=false/pointer=fine; mobile hasTouch=true/pointer=coarse`,
	'',
	`Primary matrix: ${report.cells.length} | Pass: ${report.cells.filter((cell) => cell.result === 'PASS').length} | Fail: ${report.cells.filter((cell) => cell.result === 'FAIL').length}`,
	`Additional regression captures recorded: ${Object.values(report.additionalChecks).flat().length}; results are represented by the failure list below.`,
	`Action surfaces checked: ${actionGeometryStats.visibleSurfaces}; mobile expanded targets: ${actionGeometryStats.touchExtensionPasses}/${actionGeometryStats.mobileTargets} pass; expanded target pairs: ${actionGeometryStats.targetPairsChecked} checked, ${actionGeometryStats.targetOverlaps} overlaps`,
	'',
	'| Cell | Result | Screenshot |',
	'|---|---|---|',
	...report.cells.map((cell) => `| ${cell.label} | ${cell.result} | ${cell.screenshot} |`),
	'',
	'## Failures',
	...(failureList.length ? failureList.map((failure) => `- ${failure}`) : ['- None']),
	'',
	'## Scoped diagnostics',
	...(report.diagnostics.length
		? report.diagnostics.map((value) => `- ${value}`)
		: ['- No console errors, page errors, failed requests, or HTTP >=400 responses.']),
	'',
].join('\n');
await writeFile(resolve(outDir, 'REPORT.md'), markdown);

if (failures.size) {
	console.error(
		`FAIL (${failures.size})\n${[...failures].map((failure) => `- ${failure}`).join('\n')}`,
	);
	process.exitCode = 1;
} else {
	console.log(`PASS: screenshots and geometry report written to ${outDir}`);
}
