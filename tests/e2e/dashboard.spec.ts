import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { openCreateWishlistDialog } from './fixtures/wishlist-helpers.js';

test.describe('Dashboard', () => {
	test('shows empty state for new user', async ({ browser, request, baseURL }) => {
		const user = createTestUser('dash-empty');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await page.goto('/my-lists');
		await expect(page.getByRole('heading', { name: 'Moje seznamy' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Zatím žádné seznamy' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Vytvořit seznam' })).toBeVisible();

		await page.context().close();
	});

	test('create wishlist via modal and see it on dashboard', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('dash-create');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await page.goto('/my-lists');
		await expect(page.getByRole('heading', { name: 'Moje seznamy' })).toBeVisible();
		const dialog = await openCreateWishlistDialog(page);
		await dialog.getByRole('textbox', { name: 'Název' }).fill('Vanoce 2026');
		await dialog.getByRole('button', { name: 'Vytvořit', exact: true }).click();

		await expect(page.getByRole('heading', { level: 1, name: 'Vanoce 2026' })).toBeVisible({
			timeout: 10_000,
		});

		await page.context().close();
	});

	test('view mode switcher works', async ({ browser, request, baseURL }) => {
		const user = createTestUser('dash-views');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await page.goto('/my-lists');
		await expect(page.getByRole('heading', { name: 'Moje seznamy' })).toBeVisible();
		const gridButton = page.getByRole('radio', { name: 'Mřížka karet' });
		const listButton = page.getByRole('radio', { name: 'Seznam', exact: true });

		await expect(gridButton).toHaveAttribute('aria-checked', 'true');

		await listButton.click();
		await expect(listButton).toHaveAttribute('aria-checked', 'true');
		await expect(gridButton).toHaveAttribute('aria-checked', 'false');

		await page.context().close();
	});
});
