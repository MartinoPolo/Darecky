import { test, expect, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { WISHLIST_SLOT_SPECS } from '../../src/lib/modules/images/crop_targets.js';

const SAMPLE_IMAGE_PATH = fileURLToPath(new URL('./fixtures/sample-image.jpg', import.meta.url));
const FIXED_TOLERANCE = 0.03;
const FLUID_TOLERANCE = 0.15;

async function expectAspect(locator: Locator, expected: number, tolerance: number) {
	await expect(locator).toBeVisible({ timeout: 10_000 });
	const box = await locator.boundingBox();
	expect(box, 'element has a bounding box').not.toBeNull();
	const ratio = box!.width / box!.height;
	expect(Math.abs(ratio - expected) / expected).toBeLessThanOrEqual(tolerance);
}

async function expectUniformPadding(locator: Locator, tolerancePx = 1) {
	const padding = await locator.evaluate((el) => {
		const style = getComputedStyle(el);
		return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(
			(value) => Number.parseFloat(value),
		);
	});
	expect(Math.max(...padding) - Math.min(...padding)).toBeLessThanOrEqual(tolerancePx);
}

async function expectRenderedTape(locator: Locator) {
	const tape = await locator.evaluate((el) => {
		const style = getComputedStyle(el, '::before');
		return {
			content: style.content,
			width: Number.parseFloat(style.width),
			height: Number.parseFloat(style.height),
			backgroundColor: style.backgroundColor,
		};
	});
	expect(tape.content).not.toBe('none');
	expect(tape.content).not.toBe('');
	expect(tape.width).toBeGreaterThan(0);
	expect(tape.height).toBeGreaterThan(0);
	expect(tape.backgroundColor).not.toMatch(/^(?:transparent|rgba\(0, 0, 0, 0\))$/);
}

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

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Wishlist per-slot crop (WYSIWYG stage)', () => {
	test('mobile wishlist page applies one 12px page gutter', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('img-wl-mobile-gutter');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await createWishlistAndNavigate(page, 'Mobile Gutter Coverage');
		await page.setViewportSize({ width: 390, height: 844 });

		const pageShell = page.getByTestId('wishlist-page-shell');
		const hero = page.getByTestId('wishlist-mobile-hero');
		const shellBox = await pageShell.boundingBox();
		const heroBox = await hero.boundingBox();
		expect(shellBox).not.toBeNull();
		expect(heroBox).not.toBeNull();
		expect(heroBox!.x).toBeCloseTo(12, 0);
		expect(390 - (heroBox!.x + heroBox!.width)).toBeCloseTo(12, 0);
		expect(shellBox!.width).toBe(390);

		await page.context().close();
	});

	test('three slots (no banner), stage tracks slot aspect, crop persists and reaches real surfaces', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('img-wl-crop');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Wishlist Crop Coverage');

		const shortIdMatch = page.url().match(/\/w\/([^/?#]+)/);
		expect(shortIdMatch, 'wishlist short id present in URL').not.toBeNull();
		const shortId = shortIdMatch![1];

		await page.goto(`/w/${shortId}/settings#image`);
		await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });

		const fileInput = page.locator('input[type=file]').first();
		await expect(fileInput).toBeAttached();
		const uploaded = waitForUpload(page);
		await fileInput.setInputFiles(SAMPLE_IMAGE_PATH);
		await uploaded;
		await expect(page.getByText(/Všechna místa/)).toBeVisible({ timeout: 10_000 });

		// The orphan banner slot is gone from the editor (D3/REQ-4)…
		await expect(page.getByRole('button', { name: /Záhlaví/ })).toHaveCount(0);
		// …and the three remaining tiles render at their real consumer aspects (REQ-7).
		await expectAspect(
			page.getByTestId('wishlist-preview-card'),
			WISHLIST_SLOT_SPECS.card.aspect,
			FLUID_TOLERANCE,
		);
		await expectAspect(
			page.getByTestId('wishlist-preview-thumbnail'),
			WISHLIST_SLOT_SPECS.thumbnail.aspect,
			FIXED_TOLERANCE,
		);
		await expectAspect(
			page.getByTestId('wishlist-preview-social'),
			WISHLIST_SLOT_SPECS.social.aspect,
			FIXED_TOLERANCE,
		);

		// Slot tiles carry aria-pressed; this keeps them distinct from the crop stage,
		// whose accessible name also contains the active slot label.
		const slotTile = (label: string) =>
			page.locator('button[aria-pressed]').filter({ hasText: label });

		// Fill is the default after upload: no stage until a manual intent. A wheel
		// gesture over the plain preview promotes the slot to Manual (#116 follow-up)
		// and the stage window appears locked to the active slot's aspect.
		const stageWindow = page.getByTestId('crop-stage-window');
		await expect(stageWindow).toHaveCount(0);
		await page.getByTestId('image-fit-preview').hover();
		await page.mouse.wheel(0, -100);
		await expectAspect(stageWindow, WISHLIST_SLOT_SPECS.card.aspect, FIXED_TOLERANCE);

		// Clicking a tile jumps to Manual for that slot; the stage tracks it (REQ-2).
		await slotTile('Sdílení').click();
		await expectAspect(stageWindow, WISHLIST_SLOT_SPECS.social.aspect, FIXED_TOLERANCE);

		// Draw a manual thumbnail crop (zoom 120 %) and save.
		const thumbnailTile = slotTile('Miniatura');
		await thumbnailTile.click();
		await expect(thumbnailTile).toHaveAttribute('aria-pressed', 'true');
		await expectAspect(stageWindow, WISHLIST_SLOT_SPECS.thumbnail.aspect, FIXED_TOLERANCE);
		const zoomSlider = page.getByRole('slider');
		await zoomSlider.focus();
		for (let step = 0; step < 4; step++) {
			await zoomSlider.press('ArrowRight');
		}
		await expect(page.getByText('120 %')).toBeVisible();
		await page.getByTestId('wishlist-settings-save').click();
		await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

		// The header polaroid consumes the thumbnail slot at 1:1 (D4/REQ-5).
		await page.goto(`/w/${shortId}`);
		await page.waitForSelector('h1:visible');
		const polaroidFrame = page.locator('.polaroid');
		const visiblePhoto = page.locator('.polaroid-img');
		const polaroid = visiblePhoto.locator('img');
		const polaroidCaption = polaroidFrame.locator('figcaption');
		await expectAspect(visiblePhoto, WISHLIST_SLOT_SPECS.thumbnail.aspect, FIXED_TOLERANCE);
		await expectUniformPadding(polaroidFrame);
		await expect(polaroidCaption).toBeVisible();
		await expectRenderedTape(polaroidFrame);
		const polaroidZoom = await polaroid.evaluate((el) => getComputedStyle(el).transform);
		expect(polaroidZoom, 'saved 120 % zoom reaches the polaroid').not.toBe('none');

		// Issue #330 supersedes the mobile polaroid only: the thumbnail crop now reaches the
		// compact hero's equally inset 84–96px image, while desktop keeps the original frame.
		await page.setViewportSize({ width: 390, height: 844 });
		const mobileHero = page.getByTestId('wishlist-mobile-hero');
		const mobilePhoto = page.getByTestId('wishlist-mobile-photo');
		await expectAspect(mobilePhoto, WISHLIST_SLOT_SPECS.thumbnail.aspect, FIXED_TOLERANCE);
		const mobileHeroBox = await mobileHero.boundingBox();
		const mobilePhotoBox = await mobilePhoto.boundingBox();
		expect(mobileHeroBox).not.toBeNull();
		expect(mobilePhotoBox).not.toBeNull();
		expect(mobilePhotoBox!.width).toBeGreaterThanOrEqual(84);
		expect(mobilePhotoBox!.width).toBeLessThanOrEqual(96);
		expect(
			Math.abs(mobilePhotoBox!.x - mobileHeroBox!.x - (mobilePhotoBox!.y - mobileHeroBox!.y)),
		).toBeLessThanOrEqual(1);
		await expect(polaroidFrame).not.toBeVisible();
		await page.setViewportSize({ width: 1280, height: 900 });

		// The dashboard card banner renders at the registry card aspect. (The banner
		// subtree is aria-hidden – the card link carries the accessible name – so the
		// image is located by CSS, not by role.)
		await page.goto('/my-lists');
		await expectAspect(
			page
				.getByTestId('wishlist-card')
				.filter({ hasText: 'Wishlist Crop Coverage' })
				.locator('img')
				.first(),
			WISHLIST_SLOT_SPECS.card.aspect,
			FLUID_TOLERANCE,
		);

		// Round-trip: reopening the editor restores the persisted thumbnail crop.
		await page.goto(`/w/${shortId}/settings#image`);
		await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
		await page.locator('button[aria-pressed]').filter({ hasText: 'Miniatura' }).click();
		await expect(page.getByText('120 %')).toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});
});
