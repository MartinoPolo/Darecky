import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import {
	registerViaApi,
	registerAndGetPage,
	waitForAppHydration,
} from './fixtures/auth-helpers.js';

test.describe('Error states and edge cases', () => {
	test('registering with existing email shows error', async ({ request, baseURL, page }) => {
		const user = createTestUser('dup-reg');

		// Register the user via API first
		await registerViaApi(request, baseURL!, user);

		// Now attempt to register again with the same email via the UI
		await page.goto('/register');
		await expect(page.getByRole('textbox', { name: /Jméno/i })).toBeVisible();

		await page.getByRole('textbox', { name: /Jméno/i }).fill(user.name);
		await page.getByLabel(/E-mail/i).fill(user.email);
		await page.getByRole('textbox', { name: /Heslo/i }).fill(user.password);
		await page.getByRole('button', { name: 'Vytvořit účet' }).click();

		await expect(
			page.getByText('Účet s tímto emailem již existuje. Zkuste se přihlásit.'),
		).toBeVisible({ timeout: 10_000 });
	});

	test('settings page shows user profile', async ({ browser, request, baseURL }) => {
		const user = createTestUser('settings-view');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await page.goto('/settings');

		// Page heading
		await expect(page.getByRole('heading', { name: 'Nastavení', exact: true })).toBeVisible({
			timeout: 5_000,
		});

		// Name is pre-populated in the display name input
		await expect(page.getByLabel('Zobrazované jméno')).toHaveValue(user.name, {
			timeout: 5_000,
		});

		// Email is shown in the email input
		await expect(page.getByLabel('E-mail')).toHaveValue(user.email, { timeout: 5_000 });

		await page.context().close();
	});

	test('user can update their name in settings', async ({ browser, request, baseURL }) => {
		const user = createTestUser('settings-update');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		const updatedName = `${user.name} Updated`;

		await page.goto('/settings');
		await waitForAppHydration(page);

		const nameInput = page.getByLabel('Zobrazované jméno');
		await expect(nameInput).toBeVisible({ timeout: 5_000 });
		await nameInput.clear();
		await nameInput.fill(updatedName);

		await page.getByRole('button', { name: 'Uložit profil' }).click();

		// Wait for save confirmation
		await expect(page.getByRole('button', { name: /Uloženo/ })).toBeVisible({ timeout: 5_000 });

		// Reload and verify the name persisted
		await page.reload();
		await expect(page.getByLabel('Zobrazované jméno')).toHaveValue(updatedName, {
			timeout: 5_000,
		});

		await page.context().close();
	});
});
