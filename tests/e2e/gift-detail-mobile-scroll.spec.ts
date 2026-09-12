import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	waitForDialogMotionToSettle,
} from './fixtures/wishlist-helpers.js';

const SAMPLE_IMAGE_PATH = fileURLToPath(new URL('./fixtures/sample-image.jpg', import.meta.url));

function waitForUpload(page: Page) {
	return page.waitForResponse(
		(response) =>
			response.request().method() === 'PUT' &&
			response.url().includes('/api/upload/') &&
			response.status() === 201,
		{ timeout: 15_000 },
	);
}

test.describe('Gift edit modal mobile scroll', () => {
	test('image column scrolls, tiles follow the stage, and Save remains available', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-mobile-scroll');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.setViewportSize({ width: 390, height: 844 });

		await createWishlistAndNavigate(page, 'Mobile Scroll Fix Coverage');

		const giftName = 'Dárek pro mobilní posun';
		await page
			.getByRole('button', { name: /Přidat (dárek|první přání)/ })
			.first()
			.click();
		const createDialog = page.getByRole('dialog');
		await expect(createDialog).toBeVisible({ timeout: 5_000 });
		await createDialog.locator('#gift-name').fill(giftName);

		await createDialog.getByRole('button', { name: 'Nahrát', exact: true }).click();
		const fileInput = createDialog.locator('input[type=file]');
		await expect(fileInput).toBeAttached();
		const uploaded = waitForUpload(page);
		await fileInput.setInputFiles(SAMPLE_IMAGE_PATH);
		await uploaded;
		await expect(createDialog.getByTestId('image-upload-preview')).toBeVisible({
			timeout: 10_000,
		});
		await createDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(createDialog).not.toBeVisible({ timeout: 10_000 });

		// Reopen in edit mode (owner + unshared list: Delete renders).
		await page.getByText(giftName, { exact: true }).click();
		const dialog = page.getByRole('dialog');
		await waitForDialogMotionToSettle(dialog);

		const imageColumn = dialog.getByTestId('gift-image-column');
		const cardTile = dialog.getByTestId('gift-preview-square');
		const thumbTile = dialog.getByTestId('gift-preview-thumb');
		const saveButton = dialog.getByRole('button', { name: 'Uložit' });

		await expect(imageColumn).toBeVisible();
		await expect(cardTile).toBeVisible();
		await expect(thumbTile).toBeVisible();

		const imageColumnBox = await imageColumn.boundingBox();
		const stageBox = await dialog.getByTestId('crop-stage').boundingBox();
		const cardTileBox = await cardTile.boundingBox();
		expect(imageColumnBox).not.toBeNull();
		expect(stageBox).not.toBeNull();
		expect(cardTileBox).not.toBeNull();
		expect(cardTileBox!.y, 'preview tiles follow the crop stage').toBeGreaterThanOrEqual(
			stageBox!.y + stageBox!.height - 1,
		);

		// Regression coverage (follow-up 2026-07-19): Save must be visible
		// immediately at scroll-top, not just once scrolled down to it – a
		// `position: sticky` copy nested inside the scroll only re-enters view
		// once the scroll reaches its normal flow position, which on a long form
		// left it invisible until scrolled most of the way down.
		const scrollRegion = dialog.getByTestId('gift-detail-body');
		await expect(scrollRegion).toHaveJSProperty('scrollTop', 0);
		await expect(saveButton).toBeInViewport();
		const saveBoxAtTop = await saveButton.boundingBox();
		expect(saveBoxAtTop).not.toBeNull();

		// Body scrolling must not displace the footer action.
		const imageColumnTopBefore = imageColumnBox!.y;
		await scrollRegion.evaluate((el) => {
			el.scrollTop = el.scrollHeight;
		});
		await expect(saveButton).toBeInViewport();
		const saveBoxAfterScroll = await saveButton.boundingBox();
		expect(saveBoxAfterScroll).not.toBeNull();
		expect(Math.abs(saveBoxAfterScroll!.y - saveBoxAtTop!.y)).toBeLessThanOrEqual(3);
		const imageColumnBoxAfter = await imageColumn.boundingBox();
		expect(imageColumnBoxAfter).not.toBeNull();
		expect(imageColumnBoxAfter!.y).toBeLessThan(imageColumnTopBefore);

		await page.context().close();
	});
});
