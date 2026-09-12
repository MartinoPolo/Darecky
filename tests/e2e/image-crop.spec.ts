import { test, expect, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { GIFT_CROP_TARGET_SPECS } from '../../src/lib/modules/images/crop_targets.js';

/**
 * E2E regression for the WYSIWYG per-target crop editor (issue #116): the crop
 * stage window and every preview tile must render at the true aspect of the real
 * consumer surface (acceptance: tolerance assert for gift square and wishlist
 * card/thumbnail/social), the banner slot is gone from the wishlist editor, a
 * manual crop is never silently discarded at render time, and crops survive a
 * save/reload round-trip.
 *
 * Aspect data comes from the same registry the app renders from (REQ-6), so the
 * asserts can only fail when a surface and the editor genuinely drift apart.
 *
 * The #116 follow-up three-mode model (Fill / Fit / Manual) is covered too: Fit
 * letterboxes both axes on the real card surface, preview tiles and wheel
 * gestures promote to Manual, and the modal footer stays pinned while the form
 * body scrolls. Round 2 adds the floating card + merged square tiles in the
 * image column and manual zoom-out below 100 % (letterboxed on exactly one
 * axis) surviving to the real card surface. Round 3 added the narrow detail
 * switcher tile and moved the display-mode toggle into the image column,
 * removing the per-target radio picker. Issue #165 retired the `detail` editor
 * target entirely (the visitor detail modal moved to the shared `square` crop):
 * the preview strip became a single square tile, the ONLY target switcher.
 * Issue #189 adds a second tile back – „Karta" (the 4:3 `square` card family)
 * and „Seznam a rezervace" (the true 1:1 `thumb` list + reservation surface) –
 * so the strip switches between two targets again.
 *
 * Issue #183 changes the `square` target's aspect from 1:1 to 4:3 (read
 * dynamically from `GIFT_CROP_TARGET_SPECS`, so the aspect asserts below need
 * no numeric changes), widens the gift edit modal to ~1100px with a ~50/50
 * column split, and removes the Manual stage's label/pixel chip entirely.
 */

const SAMPLE_IMAGE_PATH = fileURLToPath(new URL('./fixtures/sample-image.jpg', import.meta.url));
// Portrait source for the zoom-out regression: the 4:3 `square` target on a
// portrait source has a normalized aspect ≠ 1, so its contain zoom is below 100 %
// and the window can letterbox exactly one axis. (The earlier #165 comment here
// claimed a square SOURCE's contain zoom is already 100 %; that stopped being true
// once #183 changed the `square` target from 1:1 to 4:3 — a square source on a 4:3
// target also has contain zoom ≠ 100 %.) It also drives the adaptive-stage
// full-photo-visible assertion (#189): a tall portrait is exactly what the old
// fixed-viewport stage clipped even at default zoom.
const SAMPLE_IMAGE_PORTRAIT_PATH = fileURLToPath(
	new URL('./fixtures/sample-image-portrait.png', import.meta.url),
);

/** Fixed-size surfaces render exactly; fluid ones vary slightly with layout. */
const FIXED_TOLERANCE = 0.03;
const FLUID_TOLERANCE = 0.15;

async function expectAspect(locator: Locator, expected: number, tolerance: number) {
	await expect(locator).toBeVisible({ timeout: 10_000 });
	const box = await locator.boundingBox();
	expect(box, 'element has a bounding box').not.toBeNull();
	const ratio = box!.width / box!.height;
	expect(
		Math.abs(ratio - expected) / expected,
		`aspect ${ratio.toFixed(3)} vs expected ${expected.toFixed(3)}`,
	).toBeLessThanOrEqual(tolerance);
}

/** Wait for the same-origin upload proxy to confirm a stored object (PUT → 201). */
function waitForUpload(page: Page) {
	return page.waitForResponse(
		(response) =>
			response.request().method() === 'PUT' &&
			response.url().includes('/api/upload/') &&
			response.status() === 201,
		{ timeout: 15_000 },
	);
}

async function createWishlistAndNavigate(page: Page, title: string) {
	await page.goto('/my-lists');
	await page.waitForSelector('h1');
	const dialog = page.getByRole('dialog');
	// Retry the click until hydration has wired the button (avoids networkidle waits).
	await expect(async () => {
		await page
			.getByRole('button', { name: /Vytvořit/ })
			.first()
			.click();
		await expect(dialog).toBeVisible({ timeout: 2_000 });
	}).toPass({ timeout: 15_000 });
	await dialog.locator('#wishlist-title').fill(title);
	await dialog.locator('#wishlist-event-date').click();
	await page.locator('[data-calendar-day][data-today]:visible').click();
	await dialog.locator('button[type=submit]').click();
	await expect(page.getByRole('heading', { level: 1 })).toContainText(title, { timeout: 10_000 });
}

async function openAddGiftDialog(page: Page): Promise<ReturnType<Page['getByRole']>> {
	await page
		.getByRole('button', { name: /Přidat (dárek|první přání)/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	return dialog;
}

/** Drag the crop stage by a pixel delta (moves the window over the fixed photo, #189). */
async function dragStage(page: Page, stage: Locator, dx: number, dy: number) {
	const box = await stage.boundingBox();
	expect(box).not.toBeNull();
	const centerX = box!.x + box!.width / 2;
	const centerY = box!.y + box!.height / 2;
	await page.mouse.move(centerX, centerY);
	await page.mouse.down();
	await page.mouse.move(centerX + dx, centerY + dy, { steps: 5 });
	await page.mouse.up();
}

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Gift per-target crop (WYSIWYG stage)', () => {
	test('stage matches each target aspect, previews are honest, crop reaches the card surface', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('img-gift-crop');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Gift Crop Coverage');
		const dialog = await openAddGiftDialog(page);

		const giftName = 'Dárek s ořezem';
		const giftDescription = 'Popis pro mobilní rozložení';
		await dialog.locator('#gift-name').fill(giftName);
		await dialog.locator('#gift-description').fill(giftDescription);

		// Upload a gift image so the fit-mode controls appear.
		await dialog.getByRole('button', { name: 'Nahrát', exact: true }).click();
		const fileInput = dialog.locator('input[type=file]');
		await expect(fileInput).toBeAttached();
		const uploaded = waitForUpload(page);
		await fileInput.setInputFiles(SAMPLE_IMAGE_PATH);
		await uploaded;
		await expect(dialog.getByTestId('image-upload-preview')).toBeVisible({ timeout: 10_000 });

		// The „Karta" preview tile (the `square` 4:3 card family) overlays the
		// image column and renders at that target's true aspect (issue #183: 4:3;
		// #189 added a second „Seznam a rezervace" 1:1 `thumb` tile beside it).
		await expectAspect(
			dialog.getByTestId('gift-preview-square'),
			GIFT_CROP_TARGET_SPECS.square.aspect,
			FIXED_TOLERANCE,
		);
		await expect(dialog.getByTestId('gift-preview-card')).toHaveCount(0);
		await expect(dialog.getByTestId('gift-preview-detail')).toHaveCount(0);
		// The second „Seznam a rezervace" tile renders at the 1:1 `thumb` aspect (#189).
		await expectAspect(
			dialog.getByTestId('gift-preview-thumb'),
			GIFT_CROP_TARGET_SPECS.thumb.aspect,
			FIXED_TOLERANCE,
		);
		// The floats live INSIDE the image column, not in the form column.
		const imageColumnBox = await dialog.getByTestId('gift-image-column').boundingBox();
		const cardTileBox = await dialog.getByTestId('gift-preview-square').boundingBox();
		expect(imageColumnBox).not.toBeNull();
		expect(cardTileBox).not.toBeNull();
		expect(cardTileBox!.x).toBeGreaterThanOrEqual(imageColumnBox!.x);
		expect(cardTileBox!.x + cardTileBox!.width).toBeLessThanOrEqual(
			imageColumnBox!.x + imageColumnBox!.width + 1,
		);
		// The display-mode toggle lives in the image column too (round 3).
		const fillRadioBox = await dialog.getByRole('radio', { name: /Vyplnit/ }).boundingBox();
		expect(fillRadioBox).not.toBeNull();
		expect(fillRadioBox!.x).toBeGreaterThanOrEqual(imageColumnBox!.x);
		expect(fillRadioBox!.x + fillRadioBox!.width).toBeLessThanOrEqual(
			imageColumnBox!.x + imageColumnBox!.width + 1,
		);

		// Fit letterboxes BOTH axes (#116 follow-up). Since issue #183 the editor's
		// Fit preview is the shared WYSIWYG stage in a static, non-interactive mode
		// (not a plain `object-fit` toggle any more – the stage always positions the
		// image with explicit pixel geometry), so containment is asserted via the
		// rendered image's bounding box staying within the bordered window instead.
		await dialog.getByRole('radio', { name: /Přizpůsobit/ }).click();
		const fitWindow = dialog.getByTestId('crop-stage-window');
		const fitImage = dialog.getByTestId('crop-stage').locator('img');
		await expect(async () => {
			const windowBox = await fitWindow.boundingBox();
			const imageBox = await fitImage.boundingBox();
			expect(windowBox).not.toBeNull();
			expect(imageBox).not.toBeNull();
			// Contain: the image never exceeds the window on either axis (unlike
			// Fill/cover, which always fully covers – and typically exceeds – it on
			// at least one axis).
			expect(imageBox!.width).toBeLessThanOrEqual(windowBox!.width + 1);
			expect(imageBox!.height).toBeLessThanOrEqual(windowBox!.height + 1);
			// An upper-bound-only check would also pass for an image rendered far
			// too small, so also assert containment BINDS on at least one axis: the
			// sample image is square and the window is 4:3, so true contain binds on
			// height (image height ≈ window height).
			expect(
				Math.min(windowBox!.width - imageBox!.width, windowBox!.height - imageBox!.height),
			).toBeLessThanOrEqual(2);
		}).toPass({ timeout: 5_000 });

		// Clicking the preview tile jumps to Manual mode with the square target
		// active and exposes the WYSIWYG stage. The tile is the ONLY target
		// switcher (round 3 established tiles-only switching; issue #165 made
		// square the only target left to switch to), and the window chip names it.
		await dialog.getByTestId('gift-preview-square').click();
		await expect(dialog.getByRole('radio', { name: /Ručně/ })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(dialog.getByTestId('gift-preview-tile-square')).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		await expect(dialog.getByRole('radio', { name: /Seznam a rezervace/ })).toHaveCount(0);
		const stageWindow = dialog.getByTestId('crop-stage-window');
		await expectAspect(stageWindow, GIFT_CROP_TARGET_SPECS.square.aspect, FIXED_TOLERANCE);
		// The label/pixel chip is removed from the gift Manual stage entirely
		// (issue #183 REQ-8); the white border + thirds grid stay.
		await expect(stageWindow).not.toContainText('Seznam a rezervace');
		await expect(stageWindow.locator('.grid-cols-3')).toBeVisible();

		// The 1:1 „Seznam a rezervace" tile switches the active target to `thumb` and
		// the stage window to 1:1 (#189: the second target + two-tile switcher return).
		await dialog.getByTestId('gift-preview-tile-thumb').click();
		await expect(dialog.getByTestId('gift-preview-tile-thumb')).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		await expectAspect(stageWindow, GIFT_CROP_TARGET_SPECS.thumb.aspect, FIXED_TOLERANCE);
		// Switch back to „Karta" (4:3) for the crop-draw + save below.
		await dialog.getByTestId('gift-preview-tile-square').click();
		await expect(dialog.getByTestId('gift-preview-tile-square')).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		await expectAspect(stageWindow, GIFT_CROP_TARGET_SPECS.square.aspect, FIXED_TOLERANCE);

		// Draw a manual square crop: zoom in (slider +4 × step 5 = 120 %), then pan.
		const zoomSlider = dialog.getByRole('slider');
		await zoomSlider.focus();
		for (let step = 0; step < 4; step++) {
			await zoomSlider.press('ArrowRight');
		}
		await expect(dialog.getByText('120 %')).toBeVisible();
		await dragStage(page, dialog.getByTestId('crop-stage'), 40, 24);

		// Save the gift.
		await dialog.getByRole('button', { name: /Přidat dárek/ }).click();
		await expect(page.getByText(giftName)).toBeVisible({ timeout: 10_000 });

		// The card surface renders at the registry aspect AND applies the manual crop:
		// the focal point moved off-center, so object-position is not 50% 50% (REQ-3 –
		// a drawn crop is never silently discarded).
		const cardImage = page.getByRole('img', { name: giftName }).first();
		await expectAspect(cardImage, GIFT_CROP_TARGET_SPECS.square.aspect, FLUID_TOLERANCE);
		const objectPosition = await cardImage.evaluate(
			(el) => getComputedStyle(el).objectPosition,
		);
		expect(objectPosition).not.toBe('50% 50%');

		// The list view thumbnail is the 1:1 `thumb` target's real surface (#189,
		// reverting the interim 4:3 list thumb from #183). Crop targets stay
		// INDEPENDENT during an editing session: drawing the manual crop above only
		// dirtied `square`, so `thumb` (never touched) was pinned at save to its own
		// untouched centered framing instead of inheriting the square crop – it
		// still renders at the true 1:1 aspect either way.
		const listViewControl = page.locator('[aria-label="Seznam"]');
		await listViewControl.click();
		await expect(listViewControl).toHaveAttribute('aria-checked', 'true');
		await expect(
			page.locator('[data-wishlist-gift-collection][data-view-mode=list]'),
		).toBeVisible();
		await expectAspect(
			page.getByRole('img', { name: giftName }).first(),
			GIFT_CROP_TARGET_SPECS.thumb.aspect,
			FIXED_TOLERANCE,
		);

		// Mobile list keeps the `thumb` frame square while filling the row's complete
		// inner height. Content begins directly after that full-height image rather
		// than relying on the rejected fixed 128–152px thumbnail cap.
		await page.setViewportSize({ width: 390, height: 844 });
		// A manual crop may zoom the <img> beyond its clipped frame. Measure the
		// explicit full-bleed list image region rather than an implementation wrapper.
		const mobileItem = page.getByTestId('gift-list-item').first();
		const mobileImageFrame = mobileItem.getByTestId('gift-list-image');
		const mobileContent = mobileItem.getByTestId('gift-list-content');
		const [mobileItemBox, mobileImageBox, mobileContentBox, mobileBorder] = await Promise.all([
			mobileItem.boundingBox(),
			mobileImageFrame.boundingBox(),
			mobileContent.boundingBox(),
			mobileItem.evaluate((element) =>
				Number.parseFloat(getComputedStyle(element).borderTopWidth),
			),
		]);
		expect(mobileItemBox).not.toBeNull();
		expect(mobileImageBox).not.toBeNull();
		expect(mobileContentBox).not.toBeNull();
		expect(mobileImageBox!.width / mobileImageBox!.height).toBeCloseTo(
			GIFT_CROP_TARGET_SPECS.thumb.aspect,
			1,
		);
		expect(mobileImageBox!.y).toBeCloseTo(mobileItemBox!.y + mobileBorder, 0);
		expect(mobileImageBox!.y + mobileImageBox!.height).toBeCloseTo(
			mobileItemBox!.y + mobileItemBox!.height - mobileBorder,
			0,
		);
		expect(mobileContentBox!.x).toBeCloseTo(mobileImageBox!.x + mobileImageBox!.width, 0);
		await expect(page.getByText(giftDescription, { exact: true })).toBeHidden();
		await expect(page.getByRole('button', { name: /^Rezervovat/ })).toHaveCount(0);
		await page.setViewportSize({ width: 1280, height: 900 });

		// Round-trip: reopening the gift restores crop mode and the card zoom.
		await page.locator('[aria-label="Karta"]').click();
		const editDialog = page.getByRole('dialog');
		// Click the gift name text (bubbles to the card wrapper that opens the editor);
		// retried because a card-center click can land on an inner interactive control.
		await expect(async () => {
			await page.getByText(giftName, { exact: true }).first().click();
			await expect(editDialog).toBeVisible({ timeout: 2_000 });
		}).toPass({ timeout: 15_000 });
		await expect(editDialog.getByRole('radio', { name: /Ručně/ })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(editDialog.getByText('120 %')).toBeVisible({ timeout: 10_000 });
		// The edit modal widened to ~1100px with a roughly equal 50/50 image/form
		// column split (issue #183 REQ-9, revises the earlier 45/55 split at
		// 900px) – assert the ratio directly rather than reusing the retired
		// `detail` spec as an incidental stand-in for the column's own shape.
		const editDialogBox = await editDialog.boundingBox();
		const editImageColumnBox = await editDialog.getByTestId('gift-image-column').boundingBox();
		expect(editDialogBox).not.toBeNull();
		expect(editImageColumnBox).not.toBeNull();
		const imageColumnShare = editImageColumnBox!.width / editDialogBox!.width;
		expect(imageColumnShare).toBeGreaterThan(0.45);
		expect(imageColumnShare).toBeLessThan(0.55);

		// Pinned footer: the submit button stays visible before and after the form
		// body is scrolled to its end (the fields scroll, the actions do not).
		const submitButton = editDialog.getByRole('button', { name: 'Uložit' });
		await expect(submitButton).toBeInViewport();
		await editDialog.getByTestId('gift-form-scroll').evaluate((el) => {
			el.scrollTop = el.scrollHeight;
		});
		await expect(submitButton).toBeInViewport();

		// Switch to Fit and save: the real card surface letterboxes the
		// image on both axes (object-fit contain) instead of cropping it.
		await editDialog.getByRole('radio', { name: /Přizpůsobit/ }).click();
		await submitButton.click();
		await expect(editDialog).not.toBeVisible({ timeout: 10_000 });
		const wholeCardImage = page.getByRole('img', { name: giftName }).first();
		await expect(async () => {
			expect(await wholeCardImage.evaluate((el) => getComputedStyle(el).objectFit)).toBe(
				'contain',
			);
		}).toPass({ timeout: 10_000 });

		// Zoom OUT below 100 % (round 2): reopen (Fit round-trips), then replace the
		// square sample image with a portrait source before switching to Manual.
		// Issue #165 retired the tall `detail` target this regression used to
		// switch to; a square source's contain zoom on the (now sole) square
		// target already equals 100 %, so it cannot demonstrate a one-axis
		// letterboxed zoom-out. A non-square source gives the square target a
		// normalized aspect ≠ 1, reproducing the same regression honestly.
		await expect(async () => {
			await page.getByText(giftName, { exact: true }).first().click();
			await expect(editDialog).toBeVisible({ timeout: 2_000 });
		}).toPass({ timeout: 15_000 });
		await expect(editDialog.getByRole('radio', { name: /Přizpůsobit/ })).toHaveAttribute(
			'aria-checked',
			'true',
		);

		// Replace the image (edit mode already shows the Upload tab with the
		// existing image, so the file input is already mounted) and wait for the
		// display-mode control to remount for the new source before switching modes.
		const portraitUploaded = waitForUpload(page);
		await editDialog.locator('input[type=file]').setInputFiles(SAMPLE_IMAGE_PORTRAIT_PATH);
		await portraitUploaded;
		await expect(editDialog.getByTestId('image-upload-preview')).toBeVisible({
			timeout: 10_000,
		});

		await editDialog.getByRole('radio', { name: /Ručně/ }).click();
		await expect(editDialog.getByTestId('crop-stage')).toBeVisible();
		const zoomOutSlider = editDialog.getByRole('slider');
		// This portrait source has never been decoded by the stage before (unlike
		// the cached image reused elsewhere in this test), so the stage's own
		// `naturalRatio` measurement genuinely races the click above; the slider
		// stays `disabled` until it resolves (ImageCropStage `isReady` guard).
		// Interacting before then is a silent no-op, not a real zoom-out.
		await expect(zoomOutSlider).toBeEnabled();
		// Adaptive stage (issue #189 REQ-4): at default zoom the whole portrait is
		// contained and fully visible — the <img> stays within the stage bounds. The
		// old fixed-viewport stage clipped a tall portrait here even at zoom 1.
		await expect(async () => {
			const stageBox = await editDialog.getByTestId('crop-stage').boundingBox();
			const photoBox = await editDialog
				.getByTestId('crop-stage')
				.locator('img')
				.boundingBox();
			expect(stageBox).not.toBeNull();
			expect(photoBox).not.toBeNull();
			expect(photoBox!.x).toBeGreaterThanOrEqual(stageBox!.x - 1);
			expect(photoBox!.y).toBeGreaterThanOrEqual(stageBox!.y - 1);
			expect(photoBox!.x + photoBox!.width).toBeLessThanOrEqual(
				stageBox!.x + stageBox!.width + 1,
			);
			expect(photoBox!.y + photoBox!.height).toBeLessThanOrEqual(
				stageBox!.y + stageBox!.height + 1,
			);
		}).toPass({ timeout: 5_000 });
		await zoomOutSlider.focus();
		await zoomOutSlider.press('Home');
		expect(Number(await zoomOutSlider.inputValue())).toBeLessThan(100);
		await editDialog.getByRole('button', { name: 'Uložit' }).click();
		await expect(editDialog).not.toBeVisible({ timeout: 10_000 });
		await expect(async () => {
			await page.getByText(giftName, { exact: true }).first().click();
			await expect(editDialog).toBeVisible({ timeout: 2_000 });
			// Reopening the editor proves the square-target zoom-out persisted.
			await expect(editDialog.getByRole('radio', { name: /Ručně/ })).toHaveAttribute(
				'aria-checked',
				'true',
			);
			expect(Number(await editDialog.getByRole('slider').inputValue())).toBeLessThan(100);
		}).toPass({ timeout: 10_000 });

		await page.context().close();
	});
});
