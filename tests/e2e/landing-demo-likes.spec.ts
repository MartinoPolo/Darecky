import { test, expect, type Locator, type Page } from '@playwright/test';

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
	await page.goto('/');
	await page.waitForSelector('[data-testid="landing-demo"]');
}
function pairLikeButton(page: Page): Locator {
	return page.getByTestId('landing-demo-pair-gifter').locator('button[aria-pressed]');
}
function likeCounterResponse(page: Page): Promise<unknown> {
	return page.waitForResponse((response) => response.url().includes('/_app/remote/'), {
		timeout: 15_000,
	});
}
async function likeCount(button: Locator) {
	const label = (await button.innerText()).trim();
	return label === '' ? 0 : Number(label);
}
async function toggleLike(button: Locator, expectedPressed: boolean) {
	await expect(async () => {
		await button.click();
		await expect(button).toHaveAttribute('aria-pressed', String(expectedPressed), {
			timeout: 2_000,
		});
	}).toPass({ timeout: 30_000 });
}
async function waitForFirstLikeToCommit(page: Page) {
	await expect
		.poll(
			async () =>
				(await page.context().cookies()).some(
					(cookie) => cookie.name === 'prejemesi_anon_id',
				),
			{ timeout: 15_000 },
		)
		.toBe(true);
}

test.describe('Landing demo like counter', () => {
	test.describe.configure({ mode: 'serial' });

	test('liking a demo gift moves the shared counter and unliking puts it back', async ({
		page,
	}) => {
		await page.setViewportSize(MOBILE_VIEWPORT);
		const initialCounts = likeCounterResponse(page);
		await gotoDemo(page);
		await initialCounts;

		const likeButton = pairLikeButton(page);
		await expect(likeButton).toHaveAttribute('aria-pressed', 'false');

		// The counter is real, shared, global state — parallel workers and reruns all write
		// to it, so only deltas against the count on screen right now can be asserted.
		const countBeforeLike = await likeCount(likeButton);

		const likeCommitted = likeCounterResponse(page);
		await toggleLike(likeButton, true);
		await likeCommitted;
		await expect.poll(() => likeCount(likeButton)).toBe(countBeforeLike + 1);

		const unlikeCommitted = likeCounterResponse(page);
		await toggleLike(likeButton, false);
		await unlikeCommitted;
		await expect.poll(() => likeCount(likeButton)).toBe(countBeforeLike);
	});

	test('a like survives a reload (anonymous visitor cookie)', async ({ page }) => {
		await page.setViewportSize(MOBILE_VIEWPORT);
		await gotoDemo(page);

		const likeButton = () => pairLikeButton(page);
		await toggleLike(likeButton(), true);
		await waitForFirstLikeToCommit(page);
		const countAfterLike = await likeCount(likeButton());

		await page.reload();
		await page.waitForSelector('[data-testid="landing-demo"]');

		// Unlike the reservation state, this one is restored from the server for this browser.
		await expect(likeButton()).toHaveAttribute('aria-pressed', 'true');
		await expect.poll(() => likeCount(likeButton())).toBe(countAfterLike);

		// Leave the shared counter as it was found.
		await toggleLike(likeButton(), false);
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

		// Second like in the same session: the explainer has had its turn. Sequenced behind
		// the command response, since that is what would have opened the bubble.
		const secondLikeCommitted = likeCounterResponse(page);
		await toggleLike(heart, true);
		await secondLikeCommitted;
		await expect(popup).toHaveCount(0);

		await toggleLike(heart, false);
	});
});
