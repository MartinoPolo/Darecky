import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	addGift,
	shareWishlist,
	archiveWishlist,
} from './fixtures/wishlist-helpers.js';
import { shortIdFromPath } from './wishlist-settings.helpers.js';

test.describe('Wishlist settings – immediate actions and access', () => {
	test('manager import and export actions live in settings instead of the toolbar', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-data-actions');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(page, 'Datové akce');
		await addGift(page, 'Dárek pro export');

		await expect(page.getByRole('button', { name: 'Importovat z tabulky' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Exportovat do tabulky' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Barevná paleta seznamu' })).toHaveCount(0);

		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		const settingsDialog = page.getByRole('dialog', { name: 'Nastavení seznamu' });
		await expect(settingsDialog).toBeVisible({ timeout: 10_000 });
		await expect(
			settingsDialog.getByRole('button', { name: 'Importovat z tabulky' }),
		).not.toBeVisible();
		await expect(
			settingsDialog.getByRole('button', { name: 'Exportovat do tabulky' }),
		).not.toBeVisible();
		await settingsDialog.getByRole('tab', { name: 'Import a export' }).click();

		const downloadPromise = page.waitForEvent('download');
		await settingsDialog.getByRole('button', { name: 'Exportovat do tabulky' }).click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toMatch(/\.csv$/);

		await settingsDialog.getByRole('button', { name: 'Importovat z tabulky' }).click();
		await expect(settingsDialog).not.toBeVisible({ timeout: 5_000 });
		await expect(page.getByRole('dialog', { name: 'Importovat dárky' })).toBeVisible({
			timeout: 10_000,
		});

		await page.context().close();
	});

	test('non-owner cannot use the settings action and cannot edit via direct URL', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-owner');
		const visitor = createTestUser('settings-visitor');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);

		const path = await createWishlistAndNavigate(ownerPage, 'Cizí seznam');
		const shortId = shortIdFromPath(path);
		await addGift(ownerPage, 'Test Gift');
		await shareWishlist(ownerPage);

		const visitorPage = await registerAndGetPage(browser, request, baseURL!, visitor);
		await visitorPage.goto(path);
		await expect(visitorPage.getByRole('heading', { level: 1 })).toContainText('Cizí seznam', {
			timeout: 10_000,
		});

		// The owner-only settings action must not be visible to a visitor.
		await expect(
			visitorPage.getByRole('button', { name: 'Nastavení seznamu' }),
		).not.toBeVisible();

		// Direct navigation to the legacy settings URL redirects to the wishlist page and opens
		// the settings modal, which shows the manager-only notice instead of the edit form.
		// wishlist_settings_owner_only was reworded from „…pouze vlastník" to the obdarovaný/správce
		// wording („…pouze obdarovaný nebo správce." / „Only the recipient or a manager can edit …").
		await visitorPage.goto(`/w/${shortId}/settings`);
		await expect(
			visitorPage.getByText(
				/Nastavení seznamu může upravovat pouze obdarovaný nebo správce\.|Only the recipient or a manager can edit the wishlist settings\./,
			),
		).toBeVisible({ timeout: 10_000 });
		await expect(visitorPage.getByRole('textbox', { name: 'Popis' })).not.toBeVisible();

		await ownerPage.context().close();
		await visitorPage.context().close();
	});

	test('archived wishlist cannot be edited from the settings UI', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('settings-archived');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		const path = await createWishlistAndNavigate(page, 'Archivovaný seznam');
		const shortId = shortIdFromPath(path);

		await archiveWishlist(page);
		await expect(
			page.locator('[data-sonner-toast]').filter({ hasText: 'Seznam byl archivován' }),
		).toBeVisible({ timeout: 10_000 });

		// The settings modal (via the legacy URL redirect) surfaces a read-only notice
		// and hides the edit form.
		await page.goto(`/w/${shortId}/settings`);
		await expect(
			page.getByText('Tento seznam je archivovaný a nelze jej upravovat.'),
		).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('textbox', { name: 'Popis' })).not.toBeVisible();

		await page.context().close();
	});
});
