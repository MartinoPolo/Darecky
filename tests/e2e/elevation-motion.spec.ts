import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

interface SurfaceState {
	translateY: number;
	scale: number;
	shadow: string;
}

interface TransitionEvidence {
	property: string;
	duration: number;
	easing: string;
	delay: number;
}

async function surfaceState(surface: Locator): Promise<SurfaceState> {
	return surface.evaluate((element) => {
		const style = getComputedStyle(element);
		const [, y = '0'] = style.translate.split(' ');
		return {
			translateY: Number.parseFloat(y) || 0,
			scale: style.scale === 'none' ? 1 : Number.parseFloat(style.scale),
			shadow: style.boxShadow,
		};
	});
}

async function installTransitionRecorder(element: Locator) {
	await element.evaluate((node) => {
		type RecordedNode = Element & { __elevationTransitions?: TransitionEvidence[] };
		const recordedNode = node as RecordedNode;
		recordedNode.__elevationTransitions = [];
		node.addEventListener('transitionrun', (event) => {
			const transitionEvent = event as TransitionEvent;
			if (transitionEvent.pseudoElement !== '') {
				return;
			}
			const property = transitionEvent.propertyName;
			const animation = node
				.getAnimations()
				.find((candidate) => (candidate as CSSTransition).transitionProperty === property);
			if (animation === undefined) {
				return;
			}
			const timing = animation.effect!.getComputedTiming();
			recordedNode.__elevationTransitions!.push({
				property,
				duration: Number(timing.duration),
				easing: timing.easing ?? '',
				delay: timing.delay ?? 0,
			});
		});
	});
}

async function expectTransitionContract(element: Locator) {
	const contract = await element.evaluate((node) => {
		const style = getComputedStyle(node);
		return {
			properties: style.transitionProperty.split(',').map((value) => value.trim()),
			durations: style.transitionDuration.split(',').map((value) => value.trim()),
			easing: style.transitionTimingFunction.trim(),
			expectedEasing: getComputedStyle(document.documentElement)
				.getPropertyValue('--ease-standard')
				.trim(),
			delays: style.transitionDelay.split(',').map((value) => value.trim()),
		};
	});
	expect(contract.properties).toEqual(['translate', 'scale', 'box-shadow']);
	expect(new Set(contract.durations)).toEqual(new Set(['0.2s']));
	expect(contract.easing).toBe(contract.expectedEasing);
	expect(new Set(contract.delays)).toEqual(new Set(['0s']));
}

async function expectConcurrentTransitions(element: Locator, properties: string[]) {
	await expect
		.poll(() =>
			element.evaluate((node) => {
				type RecordedNode = Element & { __elevationTransitions?: TransitionEvidence[] };
				return (node as RecordedNode).__elevationTransitions ?? [];
			}),
		)
		.toEqual(
			expect.arrayContaining(
				properties.map((property) => expect.objectContaining({ property })),
			),
		);
	const recorded = await element.evaluate((node) => {
		type RecordedNode = Element & { __elevationTransitions?: TransitionEvidence[] };
		return (node as RecordedNode).__elevationTransitions ?? [];
	});
	const evidence = recorded.filter((item) => properties.includes(item.property));
	expect(evidence.map((item) => item.property).sort()).toEqual([...properties].sort());
	expect(new Set(evidence.map((item) => item.duration))).toEqual(new Set([200]));
	expect(new Set(evidence.map((item) => item.easing))).toHaveProperty('size', 1);
	expect(new Set(evidence.map((item) => item.delay))).toEqual(new Set([0]));
	return evidence;
}

async function animationCount(element: Locator) {
	return element.evaluate((node) => node.getAnimations().length);
}

function visualSurface(owner: Locator) {
	return owner.locator(':scope > .elevation-surface');
}

async function hoverWithEvidence(page: Page, owner: Locator) {
	const surface = visualSurface(owner);
	await page.mouse.move(0, 500);
	const start = await surfaceState(surface);
	await expectTransitionContract(surface);
	await installTransitionRecorder(surface);
	await owner.hover();
	await expectConcurrentTransitions(surface, ['translate', 'box-shadow']);
	await expect.poll(() => animationCount(surface)).toBe(0);
	const end = await surfaceState(surface);
	expect(end.translateY).toBeLessThan(start.translateY);
	expect(end.shadow).not.toBe(start.shadow);
	return { start, end };
}

async function pressWithEvidence(page: Page, owner: Locator) {
	const surface = visualSurface(owner);
	await page.mouse.move(0, 500);
	await owner.hover();
	await expect.poll(() => animationCount(surface)).toBe(0);
	const start = await surfaceState(surface);
	await expectTransitionContract(surface);
	await installTransitionRecorder(surface);
	await page.mouse.down();
	await expectConcurrentTransitions(surface, ['translate', 'scale', 'box-shadow']);
	await expect.poll(() => animationCount(surface)).toBe(0);
	const end = await surfaceState(surface);
	expect(end.translateY).not.toBe(start.translateY);
	expect(end.scale).not.toBe(start.scale);
	expect(end.shadow).not.toBe(start.shadow);
	await page.mouse.up();
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Coherent elevated-surface motion', () => {
	test('normal toolbar and compact outline controls press as one rigid surface', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('elevation-toolbar');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto('/my-lists');

		// Exercise and close the palette surface before the create modal can overlay it.
		const outlineButton = page.getByRole('button', { name: 'Barevná paleta' });
		const toolbarButton = page.getByRole('button', { name: 'Vytvořit', exact: true });
		await pressWithEvidence(page, outlineButton);
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).not.toBeVisible();
		await pressWithEvidence(page, toolbarButton);
		await page.context().close();
	});

	test('open account trigger keeps its anchor fixed while shadow feedback settles coherently', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('elevation-account');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto('/my-lists');

		const account = page.getByRole('button', { name: new RegExp(user.name) });
		await page.mouse.move(0, 500);
		const restingBox = await account.boundingBox();
		await hoverWithEvidence(page, account);
		await expect(async () => {
			if ((await account.getAttribute('aria-expanded')) !== 'true') {
				await account.click();
			}
			await expect(account).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 });
		}).toPass({ timeout: 15_000 });
		await expect.poll(() => animationCount(account)).toBe(0);
		await expect
			.poll(async () => Math.abs((await surfaceState(visualSurface(account))).translateY))
			.toBeLessThan(0.05);
		const open = await surfaceState(visualSurface(account));
		const openBox = await account.boundingBox();
		expect(Math.abs(open.translateY)).toBeLessThan(0.05);
		expect(Math.abs(openBox!.y - restingBox!.y)).toBeLessThan(0.25);
		await page.context().close();
	});

	test('dialog close remains top-right and its icon transitions and settles with the surface', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('elevation-close');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto('/my-lists');
		const create = page.getByRole('button', { name: 'Vytvořit', exact: true });
		const dialog = page.getByRole('dialog');
		await expect(async () => {
			if (!(await dialog.isVisible())) {
				await create.click();
			}
			await expect(dialog).toBeVisible({ timeout: 1_000 });
		}).toPass({ timeout: 15_000 });
		const close = dialog.getByRole('button', { name: 'Zavřít' });
		const icon = close.locator('svg');

		for (const width of [390, 1280]) {
			await page.setViewportSize({ width, height: 800 });
			await expect.poll(() => animationCount(dialog)).toBe(0);
			const dialogBox = await dialog.boundingBox();
			const closeBox = await close.boundingBox();
			expect(
				Math.abs(closeBox!.x + closeBox!.width - dialogBox!.x - dialogBox!.width),
			).toBeLessThan(30);
			expect(closeBox!.y - dialogBox!.y).toBeGreaterThanOrEqual(0);
			expect(closeBox!.y - dialogBox!.y).toBeLessThan(30);
		}

		await page.mouse.move(0, 500);
		const closeSurface = visualSurface(close);
		const surfaceStart = await surfaceState(closeSurface);
		const iconStart = await icon.evaluate((element) => getComputedStyle(element).rotate);
		await expectTransitionContract(closeSurface);
		await installTransitionRecorder(closeSurface);
		await installTransitionRecorder(icon);
		await close.hover();
		const surfaceTiming = await expectConcurrentTransitions(closeSurface, [
			'translate',
			'box-shadow',
		]);
		const iconTiming = await expectConcurrentTransitions(icon, ['rotate']);
		expect(iconTiming[0]).toMatchObject({
			duration: surfaceTiming[0].duration,
			easing: surfaceTiming[0].easing,
			delay: surfaceTiming[0].delay,
		});
		await expect.poll(() => animationCount(closeSurface)).toBe(0);
		await expect.poll(() => animationCount(icon)).toBe(0);
		const surfaceEnd = await surfaceState(closeSurface);
		const iconEnd = await icon.evaluate((element) => getComputedStyle(element).rotate);
		expect(surfaceEnd.translateY).toBeLessThan(surfaceStart.translateY);
		expect(surfaceEnd.shadow).not.toBe(surfaceStart.shadow);
		expect(iconEnd).not.toBe(iconStart);
		await page.context().close();
	});

	test('cards lift coherently and reduced motion makes representative stickers immediate', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('elevation-card-reduced');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await createWishlistAndNavigate(page, 'Elevation card');
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto('/my-lists');
		const card = page.getByTestId('wishlist-card').filter({ hasText: 'Elevation card' });
		await hoverWithEvidence(page, card);

		await page.emulateMedia({ reducedMotion: 'reduce' });
		const toolbarButton = page.getByRole('button', { name: 'Vytvořit', exact: true });
		const account = page.getByRole('button', { name: new RegExp(user.name) });
		for (const owner of [toolbarButton, account, card]) {
			const surface = visualSurface(owner);
			await page.mouse.move(0, 500);
			const before = await surfaceState(surface);
			await owner.hover({ force: true });
			const after = await surfaceState(surface);
			expect(
				await surface.evaluate((element) => getComputedStyle(element).transitionProperty),
			).toBe('none');
			expect(after.translateY).toBe(before.translateY);
			expect(after.scale).toBe(before.scale);
		}

		const dialog = page.getByRole('dialog');
		await expect(async () => {
			if (!(await dialog.isVisible())) {
				await toolbarButton.click();
			}
			await expect(dialog).toBeVisible({ timeout: 1_000 });
		}).toPass({ timeout: 15_000 });
		const close = dialog.getByRole('button', { name: 'Zavřít' });
		await close.hover();
		expect(
			await visualSurface(close).evaluate(
				(element) => getComputedStyle(element).transitionProperty,
			),
		).toBe('none');
		expect(
			await visualSurface(close).evaluate((element) => getComputedStyle(element).translate),
		).toBe('0px');
		expect(
			await close.locator('svg').evaluate((element) => getComputedStyle(element).rotate),
		).toBe('none');
		await page.context().close();
	});
});
