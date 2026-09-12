import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { openCreateWishlistDialog } from './fixtures/wishlist-helpers.js';

/**
 * „Další nastavení" accordion on the create-wishlist dialog (issue #112).
 *
 * The dialog gained an optional, collapsed-by-default disclosure holding a description
 * textarea and the palette picker. Chosen values must persist atomically at creation and
 * be visible on the new wishlist page — no post-creation edit round trip.
 *
 * Selectors lean on stable ids (`#wishlist-create-description`) and the real Czech
 * accessible names (diacritics kept — Playwright name matching is diacritic-sensitive).
 * A NON-default palette („Malina" = ruby) is chosen so `[data-palette="ruby"]` uniquely
 * identifies the wishlist page wrapper (the viewer-preference `<html data-palette>` stays
 * the default sky), proving the wishlist row — not the viewer preference — carries it.
 */
test.describe('Create-wishlist „Další nastavení" accordion', () => {
	test('description + palette chosen at creation persist and show on the new wishlist page', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('create-accordion');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await page.goto('/my-lists');
		const dialog = await openCreateWishlistDialog(page);

		const title = 'Seznam s paletou';
		const description = 'Volitelný popis zadaný při vytvoření';
		await dialog.getByRole('textbox', { name: 'Název' }).fill(title);

		// The optional zone is collapsed on open — its fields are not reachable yet.
		const descriptionInput = dialog.locator('#wishlist-create-description');
		await expect(descriptionInput).toBeHidden();

		// Expand „Další nastavení", then set both optional fields.
		await dialog.getByRole('button', { name: 'Další nastavení' }).click();
		await expect(descriptionInput).toBeVisible({ timeout: 5_000 });
		// Visible descendants can still be clipped while the accordion changes height.
		await dialog.locator('[data-slot="accordion-content"]').evaluate(async (element) => {
			await Promise.all(element.getAnimations().map((animation) => animation.finished));
		});
		await descriptionInput.fill(description);
		// „Malina" is the ruby palette swatch (aria-pressed button carrying the label).
		await dialog.getByRole('button', { name: 'Malina' }).click();
		await expect(dialog.getByRole('button', { name: 'Malina' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);

		await dialog.getByRole('button', { name: 'Vytvořit', exact: true }).click();

		// The app refreshes dashboard caches before navigating, so wait for the redirect to the
		// new wishlist page before asserting its content (avoids a race under parallel load).
		await page.waitForURL(/\/w\/[^/]+/, { timeout: 20_000 });
		await expect(page.getByRole('heading', { level: 1 })).toContainText(title, {
			timeout: 15_000,
		});

		// AC-2: the wishlist page wrapper carries the chosen palette (applied immediately, no edit).
		await expect(page.locator('[data-palette="ruby"]')).toBeVisible({ timeout: 5_000 });
		// AC-3: the description entered at creation is persisted and rendered on the page.
		await expect(page.getByText(description)).toBeVisible();

		await page.context().close();
	});

	test('untouched accordion creates a list with defaults and no description', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('create-accordion-default');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await page.goto('/my-lists');
		const dialog = await openCreateWishlistDialog(page);

		const title = 'Seznam bez nastavení';
		await dialog.getByRole('textbox', { name: 'Název' }).fill(title);
		// Do NOT open the accordion — this is the identical-to-today path.
		await dialog.getByRole('button', { name: 'Vytvořit', exact: true }).click();

		await page.waitForURL(/\/w\/[^/]+/, { timeout: 20_000 });
		await expect(page.getByRole('heading', { level: 1 })).toContainText(title, {
			timeout: 15_000,
		});

		// AC-1: the untouched path still creates a working list; the page wrapper carries the
		// default sky palette (`.last()` targets the wrapper, past the viewer-preference <html>).
		// Absence of a description on this path is asserted deterministically by the unit tests.
		await expect(page.locator('[data-palette="sky"]').last()).toBeVisible({ timeout: 5_000 });

		await page.context().close();
	});
});
