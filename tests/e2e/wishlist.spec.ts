import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	addGift,
	createWishlistAndNavigate,
	expectShareMethodsStep,
	openShareWishlistDialog,
	waitForDialogOverlayRemoval,
} from './fixtures/wishlist-helpers.js';

test.describe('Wishlist page', () => {
	test('shows draft status chip and single share action for unshared wishlist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('wl-draft');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Draft');

		// Anime-sky redesign (#102, REQ-12): the full-width draft lifecycle strip is removed.
		// The unshared state is surfaced by the compact "Koncept" status chip in the header.
		await expect(
			page
				.getByRole('main')
				.locator(
					'[data-testid="wishlist-mobile-hero"]:visible, [data-testid="wishlist-banner"]:visible',
				)
				.getByText('Koncept'),
		).toBeVisible();
		await expect(page.getByText(/Tento seznam (je.t.|jeste) nebyl sd.len/i)).toHaveCount(0);

		// The consolidated responsive hero action still opens the share wizard.
		const shareDialog = await openShareWishlistDialog(page);
		await expect(
			shareDialog.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ }),
		).toBeVisible();

		await page.context().close();
	});

	test('view switcher offers card and list only', async ({ browser, request, baseURL }) => {
		const user = createTestUser('wl-views');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Views');
		// Locale-agnostic: GiftViewSwitcher labels are i18n'd (issue #154), so select via
		// stable data-testids rather than the (locale-dependent) accessible names.
		const cardBtn = page.getByTestId('gift-view-card');
		const listBtn = page.getByTestId('gift-view-list');
		const compactBtn = page.getByTestId('gift-view-compact');

		await expect(cardBtn).toHaveAttribute('aria-checked', 'true');

		await listBtn.click();
		await expect(listBtn).toHaveAttribute('aria-checked', 'true');

		await expect(compactBtn).toHaveCount(0);

		await page.context().close();
	});

	test('stationary pointer below hero settings does not hover or move Display', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('wl-toolbar-hover-boundary');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.setViewportSize({ width: 1440, height: 900 });
		await createWishlistAndNavigate(page, 'Toolbar hover boundary');

		const settings = page.getByRole('button', { name: 'Nastavení seznamu' });
		const display = page.getByTestId('desktop-display-trigger');
		await expect(settings).toBeVisible();
		await expect(display).toBeVisible();

		const settingsBox = await settings.boundingBox();
		expect(settingsBox).not.toBeNull();
		await page.mouse.move(
			settingsBox!.x + settingsBox!.width / 2,
			settingsBox!.y + settingsBox!.height + 10,
		);

		const samples = await display.evaluate(async (element) => {
			const frames: Array<{ y: number; hovered: boolean }> = [];
			const startedAt = performance.now();
			do {
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
				frames.push({
					y: element.getBoundingClientRect().y,
					hovered: element.matches(':hover'),
				});
			} while (performance.now() - startedAt < 350);
			return frames;
		});

		const positions = samples.map((sample) => sample.y);
		expect(samples.every((sample) => !sample.hovered)).toBe(true);
		expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(0.1);

		await page.context().close();
	});

	test('first share visits methods before success and reopen starts at methods', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('wl-share');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Test Share');
		await addGift(page, 'Share Test Gift');

		const dialog = await openShareWishlistDialog(page);
		await expect(
			dialog.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ }),
		).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Kopírovat' })).toHaveCount(0);

		await dialog.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ }).click();
		await expectShareMethodsStep(page);
		await expect(dialog.getByText(/Seznam byl sd.len!/i)).toHaveCount(0);
		await dialog.getByRole('button', { name: 'Hotovo' }).click();
		await expect(dialog.getByText(/Seznam byl sd.len!/i)).toBeVisible({ timeout: 5_000 });
		await dialog.getByRole('button', { name: 'Hotovo' }).click();
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });
		await waitForDialogOverlayRemoval(page);

		await expect(
			page
				.getByRole('main')
				.locator(
					'[data-testid="wishlist-mobile-hero"]:visible, [data-testid="wishlist-banner"]:visible',
				)
				.getByText(/Sd.leno|Sdileno/),
		).toBeVisible({ timeout: 5_000 });

		await openShareWishlistDialog(page);
		await expectShareMethodsStep(page);
		await expect(
			dialog.getByRole('button', { name: /Sd.let seznam|Sdilet seznam/ }),
		).toHaveCount(0);

		await page.context().close();
	});
});
