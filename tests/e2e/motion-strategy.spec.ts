import { expect, test, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { addGift, createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

const giftItems = (page: Page) =>
	page.locator('[data-gift-item][data-gift-id]:not([data-gift-reorder-overlay])');

function giftItem(page: Page, name: string) {
	return giftItems(page).filter({
		has: page.getByRole('heading', { name, exact: true, level: 3 }),
	});
}

interface RecordedRectangle {
	left: number;
	top: number;
	width: number;
	height: number;
}

interface RecordedAnimation {
	duration: number;
	keyframes: string[];
	targetGiftId: string | null;
	targetText: string;
	targetRectangle: RecordedRectangle;
}

declare global {
	interface Window {
		__motionAnimationRecords: RecordedAnimation[];
	}
}

async function installAnimationRecorder(page: Page) {
	await page.evaluate(() => {
		window.__motionAnimationRecords = [];
		const nativeAnimate = Element.prototype.animate;
		Element.prototype.animate = function (keyframes, options) {
			const animation = nativeAnimate.call(this, keyframes, options);
			const effect = animation.effect as KeyframeEffect | null;
			const rectangle = this.getBoundingClientRect();
			window.__motionAnimationRecords.push({
				duration: Number(effect?.getTiming().duration ?? 0),
				keyframes:
					effect?.getKeyframes().map((frame) => String(frame.transform ?? '')) ?? [],
				targetGiftId: this.closest<HTMLElement>('[data-gift-id]')?.dataset.giftId ?? null,
				targetText: (this.textContent ?? '').replace(/\s+/g, ' ').trim(),
				targetRectangle: {
					left: rectangle.left,
					top: rectangle.top,
					width: rectangle.width,
					height: rectangle.height,
				},
			});
			return animation;
		};
	});
}

async function recordedAnimations(page: Page): Promise<RecordedAnimation[]> {
	return page.evaluate(() => [...window.__motionAnimationRecords]);
}

async function clearRecordedAnimations(page: Page) {
	await page.evaluate(() => {
		window.__motionAnimationRecords.length = 0;
	});
}

function translatedAnimations(animations: RecordedAnimation[], giftId: string | null) {
	return animations.filter(
		(animation) =>
			animation.targetGiftId === giftId &&
			animation.keyframes.some((keyframe) => keyframe.includes('translate')),
	);
}

function flightEndpoint(animation: RecordedAnimation) {
	const endpoint = animation.keyframes
		.at(-1)
		?.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+),\s*([-\d.]+)\)/);
	expect(endpoint, `flight endpoint keyframe: ${animation.keyframes.at(-1)}`).not.toBeNull();
	return {
		translateX: Number(endpoint![1]),
		translateY: Number(endpoint![2]),
		scaleX: Number(endpoint![3]),
		scaleY: Number(endpoint![4]),
	};
}

async function animationFacts(page: Page) {
	return page.locator('body').evaluate((body) =>
		body.getAnimations({ subtree: true }).map((animation) => {
			const effect = animation.effect as KeyframeEffect | null;
			return {
				duration: Number(effect?.getTiming().duration ?? 0),
				playState: animation.playState,
				keyframes:
					effect?.getKeyframes().map((frame) => String(frame.transform ?? '')) ?? [],
				targetGiftId: (effect?.target as HTMLElement | null)?.closest<HTMLElement>(
					'[data-gift-id]',
				)?.dataset.giftId,
			};
		}),
	);
}

function collectBrowserErrors(page: Page) {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
	page.on('console', (message) => {
		if (message.type() === 'error') {
			errors.push(`console: ${message.text()}`);
		}
	});
	return errors;
}

async function expectCleanSettlement(page: Page) {
	await expect
		.poll(
			async () =>
				(await animationFacts(page)).filter((a) => a.playState === 'running').length,
			{
				timeout: 5_000,
			},
		)
		.toBe(0);
	const integrity = await page.locator('body').evaluate(() => {
		const ids = [...document.querySelectorAll<HTMLElement>('[id]')].map((node) => node.id);
		const gifts = [...document.querySelectorAll<HTMLElement>('[data-gift-item][data-gift-id]')];
		return {
			duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
			duplicateGiftIds: gifts
				.map((gift) => gift.dataset.giftId)
				.filter((id, index, all) => all.indexOf(id) !== index),
			staleTransforms: gifts.filter((gift) => gift.style.transform !== '').length,
			staleClones: document.querySelectorAll('[aria-hidden="true"][data-gift-item]').length,
		};
	});
	expect(integrity).toEqual({
		duplicateIds: [],
		duplicateGiftIds: [],
		staleTransforms: 0,
		staleClones: 0,
	});
}

test.describe('issue #269 integrated motion strategy', () => {
	test.describe.configure({ mode: 'serial' });
	test.use({ viewport: { width: 1280, height: 900 } });

	test('filter insertion and received flight preserve identity and settle cleanly', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('motion-strategy-filter-received'),
		);
		const errors = collectBrowserErrors(page);
		const names = ['Motion Gift A', 'Motion Gift B', 'Motion Gift C'];
		await createWishlistAndNavigate(page, 'Motion strategy filter and receive');
		await addGift(page, names[0]!);
		await addGift(page, names[1]!, { primaryLink: 'https://example.com/motion-b' });
		await addGift(page, names[2]!, { primaryLink: 'https://example.com/motion-c' });

		const filteredOut = giftItem(page, names[0]!);
		const displaced = giftItem(page, names[1]!);
		const filteredOutId = await filteredOut.getAttribute('data-gift-id');
		const displacedId = await displaced.getAttribute('data-gift-id');
		expect(filteredOutId).not.toBeNull();
		expect(displacedId).not.toBeNull();

		await installAnimationRecorder(page);
		await page.getByRole('button', { name: 'Filtrovat', exact: true }).click();
		const withLinkFilter = page.getByRole('menuitemcheckbox', {
			name: 'S odkazem',
			exact: true,
		});
		await expect(withLinkFilter).toHaveAttribute('aria-checked', 'false');
		await withLinkFilter.click();

		await expect(
			page.getByRole('button', {
				name: 'Filtrovat: Aktivní filtry: 1',
				exact: true,
			}),
		).toBeVisible();
		await expect(page.locator('[data-filter-count]')).toHaveText('1');
		await expect(withLinkFilter).toHaveAttribute('aria-checked', 'true');
		const activeFilters = page.getByTestId('wishlist-toolbar-active-filters');
		await expect(activeFilters.locator('[data-active-filter-pill]')).toHaveText('S odkazem');
		await expect(filteredOut).toHaveCount(0);
		await expect(displaced).toBeVisible();
		await expect
			.poll(async () => translatedAnimations(await recordedAnimations(page), displacedId))
			.toContainEqual(expect.objectContaining({ duration: 520 }));

		const filterAnimations = await recordedAnimations(page);
		expect(translatedAnimations(filterAnimations, filteredOutId)).toEqual([]);
		expect(
			translatedAnimations(filterAnimations, displacedId).every(
				(animation) => animation.duration === 520,
			),
		).toBe(true);

		await page.keyboard.press('Escape');
		await expect(withLinkFilter).not.toBeVisible();
		await clearRecordedAnimations(page);
		await activeFilters
			.getByRole('button', { name: 'Odebrat filtr S odkazem', exact: true })
			.click();
		await expect(filteredOut).toBeVisible();
		await expect(activeFilters).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Filtrovat', exact: true })).toBeFocused();
		await expect
			.poll(async () => translatedAnimations(await recordedAnimations(page), displacedId))
			.toContainEqual(expect.objectContaining({ duration: 520 }));
		expect(translatedAnimations(await recordedAnimations(page), filteredOutId)).toEqual([]);
		await expectCleanSettlement(page);

		const moving = filteredOut;
		const movingId = await moving.getAttribute('data-gift-id');
		const sourceRectangle = await moving.boundingBox();
		expect(sourceRectangle).not.toBeNull();
		await clearRecordedAnimations(page);
		await moving.getByRole('button', { name: 'Označit jako přijatý' }).click();
		await expect(moving.locator('[data-state-primary][data-state-kind="received"]')).toHaveText(
			'Přijato',
			{ timeout: 10_000 },
		);
		const destinationRectangle = await moving.boundingBox();
		expect(destinationRectangle).not.toBeNull();

		const translationDistance = Math.hypot(
			destinationRectangle!.x - sourceRectangle!.x,
			destinationRectangle!.y - sourceRectangle!.y,
		);
		const expectedFlightDuration = Math.ceil(
			Math.max(325, (translationDistance / 1500) * 1000),
		);
		await expect
			.poll(async () =>
				(await recordedAnimations(page)).find(
					(animation) =>
						animation.duration === expectedFlightDuration &&
						animation.targetText.includes(names[0]!),
				),
			)
			.toBeDefined();
		const receivedAnimations = await recordedAnimations(page);
		const flight = receivedAnimations.find(
			(animation) =>
				animation.duration === expectedFlightDuration &&
				animation.targetText.includes(names[0]!),
		)!;
		expect(flight.targetText).not.toContain(names[1]);
		expect(flight.targetText).not.toContain(names[2]);
		expect(flight.targetRectangle.left).toBeCloseTo(sourceRectangle!.x, 1);
		expect(flight.targetRectangle.top).toBeCloseTo(sourceRectangle!.y, 1);
		expect(flight.targetRectangle.width).toBeCloseTo(sourceRectangle!.width, 1);
		expect(flight.targetRectangle.height).toBeCloseTo(sourceRectangle!.height, 1);
		expect(flight.keyframes[0]).toContain('translate(0px, 0px) scale(1, 1)');
		const endpoint = flightEndpoint(flight);
		expect(endpoint.translateX).toBeCloseTo(destinationRectangle!.x - sourceRectangle!.x, 1);
		expect(endpoint.translateY).toBeCloseTo(destinationRectangle!.y - sourceRectangle!.y, 1);
		expect(endpoint.scaleX).toBeCloseTo(
			destinationRectangle!.width / sourceRectangle!.width,
			2,
		);
		expect(endpoint.scaleY).toBeCloseTo(
			destinationRectangle!.height / sourceRectangle!.height,
			2,
		);
		expect(receivedAnimations.some((animation) => animation.duration === 520)).toBe(true);
		await expectCleanSettlement(page);
		await expect(
			giftItems(page).filter({
				has: page.locator('[data-state-primary][data-state-kind="received"]'),
			}),
		).toHaveCount(1);

		// Reverse is the idempotent cleanup and must restore focus without changing scroll.
		const reverse = moving.getByRole('button', { name: 'Označit jako nepřijatý' });
		const scrollBefore = await page.evaluate(() => scrollY);
		await reverse.click();
		await expect(moving.getByRole('button', { name: 'Označit jako přijatý' })).toBeFocused({
			timeout: 10_000,
		});
		expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
		await expect(page.getByRole('heading', { name: 'Obdržené', exact: true })).toHaveCount(0);
		await expectCleanSettlement(page);
		expect(await moving.getAttribute('data-gift-id')).toBe(movingId);
		expect(errors).toEqual([]);
		await page.context().close();
	});

	test('reorder mode keeps toolbar geometry and controls in place, including mobile', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('motion-strategy-reorder'),
		);
		const errors = collectBrowserErrors(page);
		await createWishlistAndNavigate(page, 'Motion strategy reorder');
		await addGift(page, 'Motion Reorder A');
		await addGift(page, 'Motion Reorder B');

		const regions = [
			'wishlist-toolbar',
			'wishlist-toolbar-controls',
			'wishlist-toolbar-view-controls',
			'wishlist-toolbar-display-controls',
			'wishlist-toolbar-edit-controls',
		];
		const before = await Promise.all(regions.map((id) => page.getByTestId(id).boundingBox()));
		const action = page.getByRole('button', { name: 'Změnit pořadí', exact: true });
		await action.focus();
		await action.click();
		const done = page.getByRole('button', { name: 'Hotovo', exact: true });
		await expect(done).toBeFocused();
		await expect(
			page.locator('[role="status"]').filter({ hasText: 'Režim změny pořadí zapnut.' }),
		).toHaveCount(1);
		const after = await Promise.all(regions.map((id) => page.getByTestId(id).boundingBox()));
		expect(after).toEqual(before);
		for (const control of [
			page.getByTestId('gift-view-card'),
			page.getByTestId('gift-view-list'),
		]) {
			await expect(control).toBeVisible();
			await expect(control).toBeDisabled();
		}
		for (const control of await page
			.getByTestId('wishlist-toolbar-display-controls')
			.getByRole('button')
			.all()) {
			await expect(control).toBeVisible();
			await expect(control).toBeDisabled();
		}
		await page.setViewportSize({ width: 390, height: 844 });
		const mobileToolbarGeometry = () =>
			page.evaluate(() => {
				const toolbar = document.querySelector<HTMLElement>(
					'[data-testid="wishlist-toolbar"]',
				);
				const mobileContainer = document.querySelector<HTMLElement>(
					'[data-testid="wishlist-toolbar-mobile"]',
				);
				if (!toolbar || !mobileContainer) {
					throw new Error('Missing mobile toolbar region');
				}
				const visibleRows = Array.from(
					document.querySelectorAll<HTMLElement>('[data-mobile-toolbar-row]'),
				).filter((row) => row.getClientRects().length > 0);
				const elements = [toolbar, mobileContainer, ...visibleRows];
				const toolbarRectangle = toolbar.getBoundingClientRect();
				return elements.map((element) => {
					const rectangle = element.getBoundingClientRect();
					return {
						x: rectangle.x - toolbarRectangle.x,
						y: rectangle.y - toolbarRectangle.y,
						width: rectangle.width,
						height: rectangle.height,
					};
				});
			});
		// Compare each region relative to the toolbar within the same mode. Focusing
		// the entry/exit control may scroll the viewport, but must not move or resize
		// the controls within the toolbar. Disable smooth scrolling so samples settle.
		await page.evaluate(() => {
			document.documentElement.style.scrollBehavior = 'auto';
		});
		await done.evaluate((element) => element.scrollIntoView({ block: 'center' }));
		await done.focus();
		await expect(page.locator('[data-mobile-toolbar-row]:visible')).toHaveCount(1);
		const mobileAfterEntry = await mobileToolbarGeometry();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
			),
		).toBe(true);
		await expect(done).toBeFocused();
		const mobileMore = page.getByTestId('mobile-more-trigger');
		await done.click();
		await expect(mobileMore).toBeFocused();
		await expect(
			page.locator('[role="status"]').filter({ hasText: 'Režim změny pořadí ukončen.' }),
		).toHaveCount(1);
		await expect(page.locator('[data-mobile-toolbar-row]:visible')).toHaveCount(1);
		const mobileAfterExit = await mobileToolbarGeometry();
		await mobileMore.click();
		const mobileAction = page
			.getByRole('dialog', { name: 'Další možnosti' })
			.getByRole('button', { name: 'Změnit pořadí', exact: true });
		await expect(mobileAction).toBeVisible();
		await mobileAction.click();
		await expect(done).toBeFocused();
		await expect(page.locator('[data-mobile-toolbar-row]:visible')).toHaveCount(1);
		const mobileAfterReentry = await mobileToolbarGeometry();
		expect(mobileAfterReentry).toEqual(mobileAfterEntry);
		await done.click();
		await expect(mobileMore).toBeFocused();
		await expect(page.locator('[data-mobile-toolbar-row]:visible')).toHaveCount(1);
		const mobileAfterSecondExit = await mobileToolbarGeometry();
		expect(mobileAfterSecondExit).toEqual(mobileAfterExit);
		expect(errors).toEqual([]);
		await page.context().close();
	});

	test('rapid card/list switching commits the latest mode and reduced motion skips transforms', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await registerAndGetPage(
			browser,
			request,
			baseURL!,
			createTestUser('motion-strategy-view-switch'),
		);
		const errors = collectBrowserErrors(page);
		await createWishlistAndNavigate(page, 'Motion strategy view switching');
		await addGift(page, 'Motion View Gift');
		await installAnimationRecorder(page);
		const list = page.getByTestId('gift-view-list');
		const card = page.getByTestId('gift-view-card');
		await list.click();
		await expect
			.poll(async () => (await animationFacts(page)).map((a) => a.duration))
			.toContain(160);
		await card.click();
		await list.click();
		await expect(list).toHaveAttribute('aria-checked', 'true');
		await expectCleanSettlement(page);

		await page.emulateMedia({ reducedMotion: 'reduce' });
		await clearRecordedAnimations(page);
		await card.click();
		await expect(card).toHaveAttribute('aria-checked', 'true');
		const transforms = (await recordedAnimations(page)).filter((animation) =>
			animation.keyframes.some((frame) => /translate|scale/.test(frame)),
		);
		expect(transforms).toEqual([]);
		expect(errors).toEqual([]);
		await page.context().close();
	});
});
