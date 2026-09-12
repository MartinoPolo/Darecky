import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate, shareWishlist } from './fixtures/wishlist-helpers.js';
import { GIFT_CROP_TARGET_SPECS } from '../../src/lib/modules/images/crop_targets.js';

const SAMPLE_IMAGE_PORTRAIT_PATH = fileURLToPath(
	new URL('./fixtures/sample-image-portrait.png', import.meta.url),
);

function waitForUpload(page: Page) {
	return page.waitForResponse(
		(response) =>
			response.request().method() === 'PUT' &&
			response.url().includes('/api/upload/') &&
			response.status() === 201,
		{ timeout: 15_000 },
	);
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Gift detail image presentation', () => {
	test('visitor detail view renders the full uncropped photo at its natural aspect', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('gift-detail-natural-aspect');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(ownerPage, 'Detail Natural Aspect Coverage');
		const giftName = 'Testovaci darek portret';

		await ownerPage
			.getByRole('button', { name: /Přidat/ })
			.first()
			.click();
		const addDialog = ownerPage.getByRole('dialog');
		await expect(addDialog).toBeVisible({ timeout: 5_000 });
		await addDialog.getByRole('textbox', { name: 'Název' }).fill(giftName);

		await addDialog.getByRole('button', { name: 'Nahrát', exact: true }).click();
		const fileInput = addDialog.locator('input[type=file]');
		await expect(fileInput).toBeAttached();
		const uploaded = waitForUpload(ownerPage);
		await fileInput.setInputFiles(SAMPLE_IMAGE_PORTRAIT_PATH);
		await uploaded;
		await expect(addDialog.getByTestId('image-upload-preview')).toBeVisible({
			timeout: 10_000,
		});

		await addDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(addDialog).not.toBeVisible({ timeout: 10_000 });
		await expect(ownerPage.getByRole('heading', { name: giftName, level: 3 })).toBeVisible({
			timeout: 10_000,
		});

		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;
		await ownerPage.context().close();

		const visitorContext = await browser.newContext();
		const visitorPage = await visitorContext.newPage();
		await visitorPage.goto(wishlistPath);
		await visitorPage.getByText(giftName, { exact: true }).first().click();
		const visitorDialog = visitorPage.getByRole('dialog');
		await expect(visitorDialog).toBeVisible({ timeout: 5_000 });

		const detailImage = visitorDialog
			.getByTestId('gift-detail-view-image-column')
			.locator('img');
		await expect(detailImage).toBeVisible({ timeout: 10_000 });
		const box = await detailImage.boundingBox();
		expect(box, 'detail image has a bounding box').not.toBeNull();
		const ratio = box!.width / box!.height;

		// The source is a portrait fixture (20x40px, natural ratio 0.5) – the
		// detail view must render it at that natural ratio, NOT the `square` 4:3
		// card crop target and NOT a 1:1 crop.
		expect(ratio, 'detail image renders portrait, not landscape/square').toBeLessThan(0.95);
		expect(
			Math.abs(ratio - GIFT_CROP_TARGET_SPECS.square.aspect),
			'ratio is clearly not the 4:3 square crop target',
		).toBeGreaterThan(0.3);
		expect(Math.abs(ratio - 1), 'ratio is clearly not 1:1').toBeGreaterThan(0.3);

		await visitorContext.close();
	});
});
