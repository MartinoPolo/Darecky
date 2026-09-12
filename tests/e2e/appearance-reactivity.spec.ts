import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { openCreateWishlistDialog } from './fixtures/wishlist-helpers.js';

/**
 * Cross-surface reactivity regression guard for the PRD #33 image/crop work.
 *
 * The bug this protects against: editing a wishlist's appearance (image / crop)
 * in `/w/<id>/settings` persisted correctly, but the SvelteKit remote `query` cache for
 * the dashboard list queries (getMyWishlists/Moderated/Followed) was never refreshed.
 * So the `/my-lists` card – and the navbar "recent" dropdowns – kept showing the OLD
 * image until a full page reload.
 *
 * WHY THE OLD TESTS MISSED IT (the design lesson):
 * every existing appearance test verified persistence with `page.reload()` (or by
 * reopening a dialog on the same page). A full reload re-runs SSR and bypasses the stale
 * client cache entirely – it can NEVER catch a client-cache-invalidation bug.
 *
 * THE RULE these tests follow:
 *   1. Mutate on the settings page.
 *   2. Navigate to the affected surface via an in-app link (SvelteKit CLIENT-SIDE routing),
 *      NEVER `page.goto()` / `page.reload()` between the mutation and the assertion.
 *   3. Assert the OTHER surface (the /my-lists card) reflects the change.
 * A `window` sentinel asserts the navigation really was client-side (a full reload would
 * wipe it), so the guarantee can't be silently weakened later.
 *
 * Selectors are LOCALE-AGNOSTIC on purpose (stable `id`s and bilingual cs/en regexes)
 * so the guard survives whatever default locale the env resolves (the app serves cs at
 * `/` and en at `/en`, base locale en).
 */

const SAMPLE_IMAGE_PATH = fileURLToPath(new URL('./fixtures/sample-image.jpg', import.meta.url));

/** Wait for the same-origin upload proxy to confirm a stored object (PUT → 201). */
function waitForUpload(page: Page) {
	return page.waitForResponse(
		(response) =>
			response.request().method() === 'PUT' &&
			response.url().includes('/api/upload/') &&
			response.status() === 201,
		{ timeout: 15_000 },
	);
}

/** Create a wishlist from /my-lists via the modal (locale-proof: stable ids), land on its page. */
async function createWishlist(page: Page, title: string): Promise<string> {
	await page.goto('/my-lists');
	const dialog = await openCreateWishlistDialog(page);
	await dialog.locator('#wishlist-title').fill(title);
	await dialog.locator('button[type=submit]').click();
	await expect(page.getByRole('heading', { level: 1 })).toContainText(title, { timeout: 10_000 });
	return new URL(page.url()).pathname.split('/').filter(Boolean).pop()!;
}

/**
 * Click the top-nav "my lists" link (SvelteKit client-side navigation) and prove the
 * transition did NOT trigger a full document reload. Returns once /my-lists has rendered.
 */
async function spaNavigateToMyLists(page: Page): Promise<void> {
	// Sentinel survives client-side navigation; a full reload wipes the JS context.
	await page.evaluate(() => {
		(window as Window & { __spaSentinel?: boolean }).__spaSentinel = true;
	});

	await page
		.getByRole('banner')
		.getByRole('link', { name: /^(Moje seznamy|My lists)$/ })
		.first()
		.click();
	await expect(page).toHaveURL(/\/(en\/)?my-lists\/?$/, { timeout: 10_000 });

	const wasClientSide = await page.evaluate(
		() => (window as Window & { __spaSentinel?: boolean }).__spaSentinel === true,
	);
	expect(wasClientSide, 'navigation to /my-lists must be client-side (no full reload)').toBe(
		true,
	);
}

/** The dashboard card for a given wishlist title. */
function card(page: Page, title: string) {
	return page.locator('[data-testid="wishlist-card"]', { hasText: title });
}

test.describe('Wishlist appearance reactivity (no-reload)', () => {
	test('image assigned in settings updates the /my-lists card without a reload', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('react-image');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		const title = 'Reaktivita obrazku';
		const shortId = await createWishlist(page, title);

		// Baseline (full load): no image yet – the card renders the themed emoji fallback (no <img>).
		await page.goto('/my-lists');
		await expect(card(page, title)).toBeVisible({ timeout: 10_000 });
		await expect(card(page, title).locator('img')).toHaveCount(0);

		// Assign an image in the settings modal's crop editor and save. The legacy
		// settings URL redirects to the wishlist page and opens the modal; the #image
		// fragment lands it on the image tab.
		await page.goto(`/w/${shortId}/settings#image`);
		await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
		const fileInput = page.locator('input[type=file]').first();
		await expect(fileInput).toBeAttached();
		const uploaded = waitForUpload(page);
		await fileInput.setInputFiles(SAMPLE_IMAGE_PATH);
		await uploaded;
		await page.getByTestId('wishlist-settings-save').click();
		await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

		// Client-side navigate back – the card MUST now render the image, not the fallback.
		await spaNavigateToMyLists(page);
		await expect(card(page, title).locator('img')).toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});
});
