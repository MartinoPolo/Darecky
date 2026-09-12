import { test, expect, type Locator, type Page } from '@playwright/test';
import { waitForAppHydration } from './fixtures/auth-helpers.js';

const DESKTOP_VIEWPORT = { width: 1280, height: 800 } as const;
const MOBILE_VIEWPORT = { width: 375, height: 812 } as const;
const LIKE_POPUP_COPY = 'Počítadlo je opravdové';
function gifterPane(page: Page): Locator {
	return page.getByTestId('landing-demo-pane-gifter');
}
function demoGift(pane: Locator): Locator {
	return pane.getByTestId('landing-demo-gift-teapot');
}
async function gotoDemo(page: Page) {
	const loaded = page.waitForResponse((response) =>
		new URL(response.url()).pathname.endsWith('/getLandingDemoLikes'),
	);
	await page.goto('/');
	await loaded;
	await waitForAppHydration(page);
	await expect(page.getByTestId('landing-demo')).toBeVisible();
}
function pairLikeButton(page: Page): Locator {
	return page.getByTestId('landing-demo-pair-gifter').locator('button[aria-pressed]');
}
async function toggleLike(button: Locator, expectedPressed: boolean) {
	// Pressed state is optimistic; wait for this mutation before reloading or toggling again.
	const committed = button
		.page()
		.waitForResponse(
			(response) =>
				response.request().method() === 'POST' &&
				new URL(response.url()).pathname.endsWith('/toggleLandingDemoLike'),
		);
	await button.click();
	expect((await committed).ok()).toBe(true);
	await expect(button).toHaveAttribute('aria-pressed', String(expectedPressed));
}

test.describe('Landing demo likes', () => {
	test('liking and unliking persist for this browser independently of the shared count', async ({
		page,
	}) => {
		await page.setViewportSize(MOBILE_VIEWPORT);
		await gotoDemo(page);
		const likeButton = pairLikeButton(page);
		await expect(likeButton).toHaveAttribute('aria-pressed', 'false');

		await toggleLike(likeButton, true);
		await gotoDemo(page);
		await expect(likeButton).toHaveAttribute('aria-pressed', 'true');

		await toggleLike(likeButton, false);
		await gotoDemo(page);
		await expect(likeButton).toHaveAttribute('aria-pressed', 'false');
	});

	test('a like explains the counter once per session', async ({ page }) => {
		await page.setViewportSize(DESKTOP_VIEWPORT);
		await gotoDemo(page);

		const heart = demoGift(gifterPane(page)).locator('button[aria-pressed]');
		const popup = page.getByTestId('landing-demo-like-popup');
		// Nothing explains anything until the visitor actually likes something.
		await expect(popup).toHaveCount(0);

		await toggleLike(heart, true);
		await expect(popup).toBeVisible();
		await expect(popup).toHaveText(new RegExp(LIKE_POPUP_COPY));

		const giftCard = demoGift(gifterPane(page)).getByTestId('gift-list-item');
		const giftContent = giftCard.getByTestId('gift-list-content');
		const [popupBox, heartBox, giftCardBox, contentBox] = await Promise.all([
			popup.boundingBox(),
			heart.boundingBox(),
			giftCard.boundingBox(),
			giftContent.boundingBox(),
		]);
		expect(popupBox).not.toBeNull();
		expect(heartBox).not.toBeNull();
		expect(giftCardBox).not.toBeNull();
		expect(contentBox).not.toBeNull();
		expect(popupBox!.x).toBeGreaterThanOrEqual(contentBox!.x);
		expect(popupBox!.x + popupBox!.width).toBeLessThanOrEqual(
			giftCardBox!.x + giftCardBox!.width,
		);
		expect(popupBox!.y).toBeGreaterThanOrEqual(heartBox!.y + heartBox!.height);
		expect(popupBox!.y + popupBox!.height).toBeLessThanOrEqual(
			giftCardBox!.y + giftCardBox!.height,
		);
		expect(popupBox!.x).toBeGreaterThanOrEqual(0);
		expect(popupBox!.y).toBeGreaterThanOrEqual(0);
		expect(popupBox!.x + popupBox!.width).toBeLessThanOrEqual(DESKTOP_VIEWPORT.width);
		expect(popupBox!.y + popupBox!.height).toBeLessThanOrEqual(DESKTOP_VIEWPORT.height);

		// Restore the shared counter; unliking must never trigger the explainer.
		await toggleLike(heart, false);
		await expect(popup).toHaveCount(0, { timeout: 15_000 });

		await toggleLike(heart, true);
		await expect(popup).toHaveCount(0);

		await toggleLike(heart, false);
	});
});
