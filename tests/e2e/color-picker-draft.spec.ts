import { test, expect, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

const CATEGORY_NAME = 'Barva konceptu';
const ACCEPTED_COLOR = '#B91C1C';

async function openCategorySettings(page: Page) {
	await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
	const settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
	await expect(settingsDialog).toBeVisible();
	await settingsDialog.getByRole('tab', { name: 'Kategorie' }).click();
	await expect(settingsDialog.getByRole('button', { name: 'Vytvořit kategorii' })).toBeVisible();
	return settingsDialog;
}

function categoryRow(settingsDialog: ReturnType<Page['getByRole']>) {
	return settingsDialog.locator(`[data-category-label="${CATEGORY_NAME}"]`);
}

async function openColorPicker(settingsDialog: ReturnType<Page['getByRole']>) {
	const trigger = categoryRow(settingsDialog).getByRole('button', { name: CATEGORY_NAME });
	await trigger.click();
	const pickerDialog = settingsDialog.page().getByRole('dialog', { name: CATEGORY_NAME });
	await expect(pickerDialog).toBeVisible();
	await expect(pickerDialog.getByRole('button', { name: 'Uložit' })).toBeDisabled();
	return { trigger, pickerDialog };
}

test('category color is local to the picker, then staged until global Save', async ({
	browser,
	request,
	baseURL,
}, testInfo) => {
	const page = await registerAndGetPage(
		browser,
		request,
		baseURL!,
		createTestUser('color-picker-draft'),
	);
	await createWishlistAndNavigate(page, 'Koncept barvy');
	const wishlistUrl = page.url();
	let settingsDialog = await openCategorySettings(page);

	await settingsDialog.getByPlaceholder('Vlastní kategorie').fill(CATEGORY_NAME);
	await settingsDialog.getByRole('button', { name: 'Vytvořit kategorii' }).click();
	await expect(categoryRow(settingsDialog)).toBeVisible();
	await settingsDialog
		.getByTestId('wishlist-settings-footer')
		.getByRole('button', { name: 'Uložit' })
		.click();
	await expect(settingsDialog).not.toBeVisible();

	settingsDialog = await openCategorySettings(page);
	const globalSave = settingsDialog
		.getByTestId('wishlist-settings-footer')
		.getByRole('button', { name: 'Uložit' });
	await expect(globalSave).toBeDisabled();
	const baselineColor = await categoryRow(settingsDialog)
		.getByRole('button', { name: CATEGORY_NAME })
		.evaluate((element) => getComputedStyle(element).backgroundColor);

	let picker = await openColorPicker(settingsDialog);
	await picker.pickerDialog.getByRole('button', { name: ACCEPTED_COLOR }).click();
	await picker.pickerDialog.getByRole('button', { name: 'Zrušit' }).click();
	await expect(globalSave).toBeDisabled();
	await expect(picker.trigger).toHaveCSS('background-color', baselineColor);

	picker = await openColorPicker(settingsDialog);
	await picker.pickerDialog.getByRole('button', { name: ACCEPTED_COLOR }).click();
	await page.keyboard.press('Escape');
	await expect(picker.pickerDialog).not.toBeVisible();
	await expect(settingsDialog).toBeVisible();
	await expect(globalSave).toBeDisabled();

	picker = await openColorPicker(settingsDialog);
	await picker.pickerDialog.getByRole('button', { name: ACCEPTED_COLOR }).click();
	await settingsDialog.getByText('Barva se uloží až s nastavením seznamu.').click();
	await expect(picker.pickerDialog).not.toBeVisible();
	await expect(globalSave).toBeDisabled();

	picker = await openColorPicker(settingsDialog);
	await picker.pickerDialog.getByRole('button', { name: ACCEPTED_COLOR }).click();
	await picker.pickerDialog.getByRole('button', { name: 'Uložit' }).click();
	await expect(picker.pickerDialog).not.toBeVisible();
	await expect(globalSave).toBeEnabled();
	await expect(picker.trigger).toHaveCSS('background-color', 'rgb(185, 28, 28)');

	const persistedPage = await page.context().newPage();
	await persistedPage.goto(wishlistUrl);
	await persistedPage.waitForLoadState('networkidle');
	const persistedSettings = await openCategorySettings(persistedPage);
	await expect(
		categoryRow(persistedSettings).getByRole('button', { name: CATEGORY_NAME }),
	).toHaveCSS('background-color', baselineColor);
	await persistedSettings.getByRole('button', { name: 'Zavřít' }).click();
	await persistedPage.close();

	await globalSave.click();
	await expect(settingsDialog).not.toBeVisible();
	await page.reload();
	settingsDialog = await openCategorySettings(page);
	await expect(
		categoryRow(settingsDialog).getByRole('button', { name: CATEGORY_NAME }),
	).toHaveCSS('background-color', 'rgb(185, 28, 28)');

	for (const width of [320, 390, 768, 1440]) {
		await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
		const visualPicker = await openColorPicker(settingsDialog);
		await page.waitForTimeout(250);
		await page.screenshot({ path: testInfo.outputPath(`color-picker-${width}.png`) });
		await visualPicker.pickerDialog.getByRole('button', { name: 'Zrušit' }).click();
	}

	await page.context().close();
});
