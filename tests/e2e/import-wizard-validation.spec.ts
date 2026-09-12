import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { openCreateWishlistDialog, openDialogFromTrigger } from './fixtures/wishlist-helpers.js';

/**
 * Required-title validation UX for the import wizard's Review step (issue #118).
 *
 * The wizard let an empty/whitespace-only title reach the Confirm step, where it
 * rendered as literal `****` (empty markdown-bold interpolation) and – on commit —
 * 400'd server-side with only a generic "Import se nezdařil" error, which the Retry
 * button re-triggered forever with no hint the title was the problem.
 *
 * Requirements:
 *  - Nothing is shown on a freshly parsed Review step – no error, no invalid styling.
 *  - An inline error (Input `error` state -> aria-invalid, message via aria-describedby)
 *    surfaces after clicking "Next" with a blank title, or after type-then-delete –
 *    never a native browser bubble, never the generic commit-error alert.
 *  - The wizard cannot advance to Confirm while the title is blank.
 *  - No literal `****` can appear anywhere in the dialog.
 *  - The title input exposes an accessible name (findable by role + accessible name).
 */
test.describe('Import wizard required-title validation', () => {
	test('inline title error blocks Confirm and never renders ****', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('import-validation');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await page.goto('/my-lists');
		const importButton = page
			.getByRole('main')
			.getByRole('button', { name: 'Importovat dárky' });
		await expect(importButton).toBeVisible();
		const dialog = page.getByRole('dialog');
		await openDialogFromTrigger(importButton, dialog);

		// ── Source step: upload a minimal CSV via the hidden file input ─────────────────
		const csv = 'Nazev,Odkaz\nMicek,https://example.com/micek\n';
		await dialog.locator('input[type="file"]').setInputFiles({
			name: 'gifts.csv',
			mimeType: 'text/csv',
			buffer: Buffer.from(csv, 'utf-8'),
		});

		// ── Review step: title auto-derives from the filename ("gifts.csv" -> "gifts") ──
		const titleInput = dialog.getByRole('textbox', { name: 'Název seznamu' });
		await expect(titleInput).toBeVisible({ timeout: 5_000 });
		await expect(titleInput).toHaveValue('gifts');

		const titleError = dialog.locator('#import-wizard-title-error');
		const nextButton = dialog.getByRole('button', { name: 'Pokračovat' });

		// Fresh state: no error, field not marked invalid.
		await expect(titleError).toHaveCount(0);
		await expect(titleInput).not.toHaveAttribute('aria-invalid', 'true');

		// ── Clear the title, then attempt to proceed – blocked with inline error ────────
		await titleInput.fill('');
		await nextButton.click();

		await expect(titleError).toBeVisible();
		await expect(titleError).toHaveText('Název je povinný');
		await expect(titleInput).toHaveAttribute('aria-invalid', 'true');
		await expect(titleInput).toHaveAttribute('aria-describedby', 'import-wizard-title-error');

		// Never advanced past Review – Confirm step content never rendered.
		await expect(
			dialog
				.getByText('Vytvořit seznam', { exact: false })
				.and(dialog.locator(':not(button):not(button *)')),
		).toHaveCount(0);

		// No literal markdown asterisks anywhere in the dialog (empty-title render bug).
		await expect(dialog).not.toContainText('****');

		// ── Whitespace-only title is treated as blank too ───────────────────────────────
		await titleInput.fill('   ');
		await nextButton.click();
		await expect(titleError).toBeVisible();

		// ── Filling a valid title clears the error live and unblocks Next ───────────────
		await titleInput.fill('Můj seznam přání');
		await expect(titleError).toHaveCount(0);
		await expect(titleInput).not.toHaveAttribute('aria-invalid', 'true');

		await nextButton.click();
		await expect(
			dialog
				.getByText('Vytvořit seznam', { exact: false })
				.and(dialog.locator(':not(button):not(button *)')),
		).toBeVisible({
			timeout: 5_000,
		});
		await expect(dialog).toContainText('Můj seznam přání');
		await expect(dialog).not.toContainText('****');

		await page.context().close();
	});
});

test('navbar import refreshes the home overview in place', async ({
	browser,
	request,
	baseURL,
}) => {
	const user = createTestUser('navbar-home-import');
	const page = await registerAndGetPage(browser, request, baseURL!, user);
	const wishlistTitle = `Import z navigace ${Date.now()}`;

	await page.goto('/home');
	const createButton = page
		.getByRole('button', { name: 'Vytvořit', exact: true })
		.filter({ hasText: 'Vytvořit' });
	await expect(createButton).toBeVisible();
	const createDialog = await openCreateWishlistDialog(page);
	await createDialog.getByRole('button', { name: 'Importovat dárky' }).click();

	const importDialog = page.getByRole('dialog', { name: 'Importovat dárky' });
	await expect(importDialog).toBeVisible({ timeout: 20_000 });

	const csv = 'Nazev,Odkaz\nDárek z navigace,https://example.com/navbar-gift\n';
	await importDialog.locator('input[type="file"]').setInputFiles({
		name: 'navbar-gifts.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(csv, 'utf-8'),
	});

	const titleInput = importDialog.getByRole('textbox', { name: 'Název seznamu' });
	await expect(titleInput).toBeVisible({ timeout: 5_000 });
	await titleInput.fill(wishlistTitle);
	await importDialog.getByRole('button', { name: 'Pokračovat' }).click();
	await importDialog.getByRole('button', { name: 'Vytvořit seznam', exact: true }).click();

	await expect(importDialog).toContainText('Hotovo. Přidáno 1 dárků.', { timeout: 20_000 });
	await expect(page).toHaveURL(new URL('/home', baseURL!).toString());
	await importDialog.getByRole('button', { name: 'Zavřít' }).click();

	await expect(
		page.getByRole('main').getByRole('link', { name: wishlistTitle, exact: true }).first(),
	).toBeVisible({ timeout: 10_000 });
	await expect(page).toHaveURL(new URL('/home', baseURL!).toString());

	await page.context().close();
});
