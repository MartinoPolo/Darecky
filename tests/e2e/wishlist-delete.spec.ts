import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate, addGift, shareWishlist } from './fixtures/wishlist-helpers.js';

test.describe('Wishlist delete (issue #120)', () => {
	test('recipient can delete an unshared list from settings, and it disappears from /my-lists without reload', async ({
		browser,
		request,
		baseURL,
	}) => {
		const recipient = createTestUser('delete-recipient');
		const page = await registerAndGetPage(browser, request, baseURL!, recipient);

		const title = 'Seznam ke smazani';
		await createWishlistAndNavigate(page, title);

		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 10_000 });

		await dialog.getByRole('tab', { name: 'Nebezpečná zóna' }).click();
		await dialog.getByRole('button', { name: 'Smazat seznam' }).click();

		const confirmDialog = page.getByRole('dialog').filter({ hasText: 'Smazat seznam' }).last();
		await expect(confirmDialog).toBeVisible({ timeout: 5_000 });
		await confirmDialog.getByRole('button', { name: 'Smazat seznam' }).click();

		await expect(
			page.locator('[data-sonner-toast]').filter({ hasText: 'Seznam byl smazán' }),
		).toBeVisible({ timeout: 10_000 });

		// Post-delete: navigated away from the now-deleted wishlist.
		await expect(page).toHaveURL(/\/my-lists$/, { timeout: 10_000 });

		// The card is gone without a reload (dashboard query was refreshed by the delete flow).
		// Assert on the card's link role (aria-label = title): during the post-delete
		// transition the /w/[id] banner and the delete-confirm dialog both expose the title
		// via a heading role, so a heading-name locator is ambiguous — the card is the only
		// element that surfaces the title as a link.
		await expect(page.getByRole('link', { name: title, exact: true })).toHaveCount(0, {
			timeout: 10_000,
		});

		await page.context().close();
	});

	test('non-manager never sees the delete affordance', async ({ browser, request, baseURL }) => {
		const recipient = createTestUser('delete-owner');
		const visitor = createTestUser('delete-visitor');
		const recipientPage = await registerAndGetPage(browser, request, baseURL!, recipient);

		const path = await createWishlistAndNavigate(recipientPage, 'Cizi seznam ke smazani');
		await addGift(recipientPage, 'Test Gift');
		await shareWishlist(recipientPage);

		const visitorPage = await registerAndGetPage(browser, request, baseURL!, visitor);
		await visitorPage.goto(path);
		await expect(
			visitorPage.getByRole('heading', { name: 'Test Gift', level: 3 }),
		).toBeVisible();

		await expect(
			visitorPage.getByRole('button', { name: 'Nastavení seznamu' }),
		).not.toBeVisible();

		await recipientPage.context().close();
		await visitorPage.context().close();
	});

	test('a shared wishlist shows the archive notice instead of a delete button', async ({
		browser,
		request,
		baseURL,
	}) => {
		const recipient = createTestUser('delete-shared');
		const page = await registerAndGetPage(browser, request, baseURL!, recipient);

		await createWishlistAndNavigate(page, 'Sdileny seznam');
		await addGift(page, 'Test Gift');
		await shareWishlist(page);

		await page.getByRole('button', { name: 'Nastavení seznamu' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 10_000 });

		await dialog.getByRole('tab', { name: 'Nebezpečná zóna' }).click();
		await expect(
			dialog.getByText('Sdílený seznam nelze smazat, pouze archivovat.', { exact: false }),
		).toBeVisible({ timeout: 5_000 });
		await expect(dialog.getByRole('button', { name: 'Smazat seznam' })).not.toBeVisible();

		await page.context().close();
	});
});
