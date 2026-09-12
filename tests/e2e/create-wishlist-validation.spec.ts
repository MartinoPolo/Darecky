import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { openCreateWishlistDialog } from './fixtures/wishlist-helpers.js';

/**
 * Required-field validation UX for the create-wishlist dialog.
 *
 * Requirements (from the redesign of the modal's validation):
 *  - Nothing is shown on a freshly opened dialog — no error, no invalid styling.
 *  - A required field surfaces an INLINE error tied to that field (red border via the
 *    Input `error` state → `aria-invalid`, message linked via `aria-describedby`) — never
 *    a native browser bubble and never a detached top-of-form alert.
 *  - The error appears on submit with the field empty, OR after the user types into the
 *    field and then clears it ("type-then-delete"), and clears the moment it becomes valid.
 *
 * Assertions lean on the stable ids + aria wiring so they stay valid regardless of locale;
 * the exact message text documents the rendered cs strings (the modal serves cs at `/`).
 */
test.describe('Create-wishlist dialog required-field validation', () => {
	test('inline errors appear only after submit/edit and clear when valid', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('create-validation');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await page.goto('/my-lists');
		const dialog = await openCreateWishlistDialog(page);

		const titleInput = dialog.locator('#wishlist-title');
		const titleError = dialog.locator('#wishlist-title-error');
		const submit = dialog.getByRole('button', { name: 'Vytvořit', exact: true });

		// ── 1) Fresh open: no error, field not marked invalid ───────────────────────────
		await expect(titleError).toHaveCount(0);
		await expect(titleInput).not.toHaveAttribute('aria-invalid', 'true');

		// ── 2) Submit path: empty title → inline error + invalid, dialog stays open ──────
		await submit.click();
		await expect(titleError).toBeVisible();
		await expect(titleError).toHaveText('Název je povinný');
		await expect(titleInput).toHaveAttribute('aria-invalid', 'true');
		// The error is wired to the field (inline/adjacent), not a detached alert.
		await expect(titleInput).toHaveAttribute('aria-describedby', 'wishlist-title-error');
		// No submission happened — still on /my-lists with the dialog open.
		await expect(dialog).toBeVisible();
		expect(new URL(page.url()).pathname).toBe('/my-lists');

		// ── 3) Filling a valid title clears the error live ───────────────────────────────
		await titleInput.fill('Dárek k narozeninám');
		await expect(titleError).toHaveCount(0);
		await expect(titleInput).not.toHaveAttribute('aria-invalid', 'true');

		// ── 4) Recipient field, type-then-clear path (never submitted) ───────────────────
		await dialog.getByText('Pro někoho jiného', { exact: true }).click();
		const recipientInput = dialog.locator('#wishlist-recipient-name');
		const recipientError = dialog.locator('#wishlist-recipient-name-error');
		await expect(recipientInput).toBeVisible();

		// Fresh reveal of the recipient field: no error yet.
		await expect(recipientError).toHaveCount(0);
		await expect(recipientInput).not.toHaveAttribute('aria-invalid', 'true');

		// Type a character, then delete it → error surfaces purely from the edit (no submit).
		await recipientInput.fill('R');
		await expect(recipientError).toHaveCount(0);
		await recipientInput.fill('');
		await expect(recipientError).toBeVisible();
		await expect(recipientError).toHaveText('Zadejte jméno obdarovaného');
		await expect(recipientInput).toHaveAttribute('aria-invalid', 'true');
		await expect(recipientInput).toHaveAttribute(
			'aria-describedby',
			'wishlist-recipient-name-error',
		);

		// Re-filling a valid name clears it again.
		await recipientInput.fill('Rosie');
		await expect(recipientError).toHaveCount(0);
		await expect(recipientInput).not.toHaveAttribute('aria-invalid', 'true');

		await page.context().close();
	});
});
