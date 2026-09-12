import { expect, test, type Locator } from '@playwright/test';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createTestUser } from './fixtures/test-data.js';

async function expectExactHeight(locator: Locator, expectedHeight: number): Promise<void> {
	await expect(locator).toBeVisible();
	await expect
		.poll(() => locator.evaluate((element) => element.getBoundingClientRect().height))
		.toBe(expectedHeight);
}

test.describe('issue #159 control-height geometry', () => {
	test('login controls share the 38px standalone-form step', async ({ page }) => {
		await page.goto('/login');

		const controls = [
			page.locator('#login-email'),
			page.locator('#login-password'),
			page.locator('form button[type="submit"]'),
			page.getByTestId('google-login'),
		];

		for (const control of controls) {
			await expectExactHeight(control, 38);
		}
	});

	test('create-list controls use 38px while its compact import action stays 26px', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('control-heights');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await page.goto('/my-lists');
		const create = page.getByRole('button', { name: 'Vytvořit seznam' }).first();
		const dialog = page.getByRole('dialog');
		// The button is server-rendered before hydration. Retry the user action until
		// the observable dialog is open instead of waiting for global network idleness.
		await expect(async () => {
			if (!(await dialog.isVisible())) {
				await create.click();
			}
			await expect(dialog).toBeVisible({ timeout: 1_000 });
		}).toPass({ timeout: 15_000 });
		const toggleItems = dialog.locator('[data-slot="toggle-group-item"]');
		await expect(toggleItems).toHaveCount(2);

		for (const toggleItem of await toggleItems.all()) {
			await expectExactHeight(toggleItem, 38);
		}

		await toggleItems.nth(1).click();

		const standaloneControls = [
			dialog.locator('#wishlist-title'),
			dialog.locator('#wishlist-recipient-name'),
			dialog.locator('#wishlist-event-date'),
			dialog.getByRole('button', { name: 'Zrušit', exact: true }),
			dialog.getByRole('button', { name: 'Vytvořit', exact: true }),
		];

		for (const control of standaloneControls) {
			await expectExactHeight(control, 38);
		}

		const importButton = dialog.getByRole('button', { name: /Import/ });
		if ((await importButton.count()) > 0) {
			await expectExactHeight(importButton, 26);
		}

		await page.context().close();
	});
});
