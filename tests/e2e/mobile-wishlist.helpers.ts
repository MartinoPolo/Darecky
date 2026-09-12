import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import {
	addGift,
	createWishlistForSomeoneAndNavigate,
	shareWishlist,
} from './fixtures/wishlist-helpers.js';

export const MOBILE_HEIGHT = 844;
export const WIDTHS = [320, 360, 390] as const;

export async function createManagerWishlist(
	page: Page,
	title = 'Mobilní seznam pro Aničku',
): Promise<string> {
	await createWishlistForSomeoneAndNavigate(page, { title, recipientName: 'Anička' });
	await addGift(page, 'Dlouhý název dárku který se musí bezpečně vejít na přesně dva řádky', {
		price: '1299',
	});
	await addGift(page, 'Dárek bez ceny');
	await addGift(page, 'Třetí dárek', { price: '499' });
	// The reusable share helper targets the labeled desktop action; narrow production uses
	// the approved hero overflow sheet, so temporarily expose that same action without
	// duplicating the share-wizard implementation in this spec.
	await page.setViewportSize({ width: 800, height: MOBILE_HEIGHT });
	await shareWishlist(page);
	await page.setViewportSize({ width: 390, height: MOBILE_HEIGHT });
	await dismissToasts(page);
	return new URL(page.url()).pathname;
}

export async function addQuantityGift(page: Page, name: string, quantity: number) {
	await page
		.getByRole('button', { name: /Přidat/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('textbox', { name: 'Název' }).fill(name);
	await dialog.locator('#gift-quantity').fill(String(quantity));
	await dialog.getByRole('button', { name: 'Přidat dárek' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible();
}

export function gift(page: Page, name: string) {
	return page.locator('[data-gift-item]').filter({
		has: page.getByRole('heading', { name, exact: true }),
	});
}

export async function dismissToasts(page: Page) {
	const toasts = page.locator('[data-sonner-toast]');
	// Sonner reorders its live stack as each toast exits, so cached nth() locators can start
	// targeting an already-moving toast underneath the next one. Dismiss the current buttons in
	// one DOM turn and then wait for every exit animation to remove its toast.
	await toasts.locator('button[aria-label="Dismiss"]').evaluateAll((buttons) => {
		for (const button of buttons) {
			(button as HTMLButtonElement).click();
		}
	});
	await expect(toasts).toHaveCount(0);
}

export async function resetAllScroll(page: Page) {
	await page.evaluate(() => {
		document.querySelectorAll<HTMLElement>('*').forEach((element) => {
			element.scrollTop = 0;
		});
		window.scrollTo(0, 0);
	});
}

export async function waitForGiftAnimationsToSettle(page: Page) {
	await page.locator('[data-gift-item]:visible').evaluateAll(async (elements) => {
		const animations = elements.flatMap((element) => element.getAnimations({ subtree: true }));
		await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	});
}

export async function box(locator: Locator) {
	const value = await locator.boundingBox();
	expect(value, `Expected ${locator} to have a bounding box`).not.toBeNull();
	return value!;
}

export async function expectInsideViewport(locator: Locator, width: number) {
	const bounds = await box(locator);
	expect(bounds.x).toBeGreaterThanOrEqual(12);
	expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 12 + 0.5);
}

export async function expectContainedReceivedActions(page: Page) {
	const giftItems = page.locator('[data-gift-item]');
	await expect(giftItems).not.toHaveCount(0);
	for (const item of await giftItems.all()) {
		const receivedAction = item.getByTestId('gift-received-toggle');
		await expect(receivedAction).toBeVisible();
		const [itemBox, actionBox, labelBox] = await Promise.all([
			box(item),
			box(receivedAction),
			receivedAction.evaluate((action) => {
				const surface = action.querySelector(':scope > .elevation-surface');
				if (!(surface instanceof HTMLElement)) {
					throw new Error('Received action has no direct elevation surface');
				}
				const range = document.createRange();
				range.selectNodeContents(surface);
				const contentRect = range.getBoundingClientRect();
				const surfaceRect = surface.getBoundingClientRect();
				return {
					contentX: contentRect.x,
					contentWidth: contentRect.width,
					surfaceX: surfaceRect.x,
					surfaceWidth: surfaceRect.width,
				};
			}),
		]);
		expect(actionBox.width).toBeGreaterThanOrEqual(32);
		expect(actionBox.height).toBeGreaterThanOrEqual(32);
		expect(actionBox.x).toBeGreaterThanOrEqual(itemBox.x - 0.5);
		expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(itemBox.x + itemBox.width + 0.5);
		expect(
			Math.abs(
				labelBox.contentX -
					labelBox.surfaceX -
					(labelBox.surfaceX +
						labelBox.surfaceWidth -
						labelBox.contentX -
						labelBox.contentWidth),
			),
		).toBeLessThanOrEqual(4);
		expect(await receivedAction.evaluate((action) => action.scrollWidth)).toBeLessThanOrEqual(
			await receivedAction.evaluate((action) => action.clientWidth),
		);

		const moreAction = item.getByTestId('gift-more-actions');
		if ((await moreAction.count()) === 0) {
			continue;
		}
		const moreBox = await box(moreAction);
		expect(moreBox.width).toBeGreaterThanOrEqual(32);
		expect(moreBox.height).toBeGreaterThanOrEqual(32);
		const visiblySeparated =
			actionBox.x + actionBox.width <= moreBox.x + 0.5 ||
			moreBox.x + moreBox.width <= actionBox.x + 0.5 ||
			actionBox.y + actionBox.height <= moreBox.y + 0.5 ||
			moreBox.y + moreBox.height <= actionBox.y + 0.5;
		expect(visiblySeparated).toBe(true);
	}
}

export async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
	const directory = 'test-results/mobile-wishlist-screenshots';
	const path = `${directory}/${name}.png`;
	await mkdir(directory, { recursive: true });
	await page.screenshot({ path, fullPage: true });
	await testInfo.attach(name, { path, contentType: 'image/png' });
}
