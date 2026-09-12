import { test, expect, type Page, type Locator } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createTestUser } from './fixtures/test-data.js';
import { registerAndGetPage } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate } from './fixtures/wishlist-helpers.js';

const SAMPLE_IMAGE_PATH = fileURLToPath(new URL('./fixtures/sample-image.jpg', import.meta.url));

// ── Shared helpers ────────────────────────────────────────────────────────────

async function openAddGiftDialog(page: Page): Promise<ReturnType<Page['getByRole']>> {
	await page
		.getByRole('button', { name: /Přidat/ })
		.first()
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible({ timeout: 5_000 });
	return dialog;
}

// Reveals (if needed) and fills the first URL input in the multi-link editor.
async function fillGiftUrl(dialog: Locator, url: string) {
	const urlInput = dialog.getByTestId('gift-link-url').first();
	if (!(await urlInput.isVisible().catch(() => false))) {
		await dialog.getByRole('button', { name: /Přidat odkaz|Add link/ }).click();
	}
	await urlInput.fill(url);
}

// ── Gift creation ─────────────────────────────────────────────────────────────

test.describe('Gift creation', () => {
	test('creates gift with name only (minimal fields)', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gc-minimal');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Minimal Gift Test');
		const dialog = await openAddGiftDialog(page);

		await dialog.getByRole('textbox', { name: 'Název' }).fill('Minimální dárek');
		await dialog.getByRole('button', { name: 'Přidat dárek' }).click();

		await expect(page.getByText('Minimální dárek')).toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});

	test('creates gift with supplied description, price, and link', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gc-full');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Full Gift Test');
		const dialog = await openAddGiftDialog(page);

		await dialog.getByRole('textbox', { name: 'Název' }).fill('Plný dárek');
		await dialog.getByRole('textbox', { name: /Popis/i }).fill('Testovací popis');
		await dialog.getByLabel(/Cena/).fill('1500');
		await fillGiftUrl(dialog, 'https://example.com/gift');
		await dialog.getByRole('button', { name: 'Přidat dárek' }).click();

		await expect(page.getByText('Plný dárek')).toBeVisible({ timeout: 10_000 });
		// Price formatted via Intl.NumberFormat – "1 500 Kč" or similar depending on locale
		await expect(page.getByText(/1\s?500/)).toBeVisible({ timeout: 10_000 });

		await page.reload();
		await page.getByText('Plný dárek').click();
		const savedGiftDialog = page.getByRole('dialog');
		await expect(savedGiftDialog).toBeVisible({ timeout: 5_000 });
		await expect(
			savedGiftDialog.getByRole('textbox', { name: 'Popis', exact: true }),
		).toHaveValue('Testovací popis');
		await expect(savedGiftDialog.getByTestId('gift-link-url').first()).toHaveValue(
			'https://example.com/gift',
		);
		await expect(savedGiftDialog.getByLabel(/Cena/)).toHaveValue('1500');

		await page.context().close();
	});

	test('normalizes partial URL (no protocol)', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gc-url-partial');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Partial URL Test');
		const dialog = await openAddGiftDialog(page);

		await dialog.getByRole('textbox', { name: 'Název' }).fill('Odkaz bez protokolu');
		await fillGiftUrl(dialog, 'seznam.cz/produkt');
		await dialog.getByRole('button', { name: 'Přidat dárek' }).click();

		// Should not fail – gift must appear in the list
		await expect(page.getByText('Odkaz bez protokolu')).toBeVisible({ timeout: 10_000 });

		// Open the gift detail to verify the URL was saved and normalized
		await page.getByText('Odkaz bez protokolu').click();
		const detailDialog = page.getByRole('dialog');
		await expect(detailDialog).toBeVisible({ timeout: 5_000 });
		// The URL field should contain the normalized https:// value
		await expect(detailDialog.getByTestId('gift-link-url').first()).toHaveValue(
			'https://seznam.cz/produkt',
		);

		await page.context().close();
	});

	test('preserves http:// prefix without double-prepending', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gc-url-http');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'HTTP URL Test');
		const dialog = await openAddGiftDialog(page);

		await dialog.getByRole('textbox', { name: 'Název' }).fill('HTTP odkaz');
		await fillGiftUrl(dialog, 'http://example.com');
		await dialog.getByRole('button', { name: 'Přidat dárek' }).click();

		await expect(page.getByText('HTTP odkaz')).toBeVisible({ timeout: 10_000 });

		// Open the gift detail to verify the URL was not double-prefixed
		await page.getByText('HTTP odkaz').click();
		const detailDialog = page.getByRole('dialog');
		await expect(detailDialog).toBeVisible({ timeout: 5_000 });
		// The http:// prefix must be preserved (not double-prefixed to https://http://).
		// A bare authority may be normalized with a trailing slash (http://example.com/).
		await expect(detailDialog.getByTestId('gift-link-url').first()).toHaveValue(
			/^http:\/\/example\.com\/?$/,
		);

		await page.context().close();
	});
});

// ── Gift image upload ─────────────────────────────────────────────────────────

test.describe('Gift image upload', () => {
	test('uploads image successfully', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gc-img-upload');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Image Upload Test');
		const dialog = await openAddGiftDialog(page);

		// Switch to Upload tab
		await dialog.getByRole('button', { name: 'Nahrát', exact: true }).click();

		// Wait for the file input to be present in the dialog
		const fileInput = dialog.locator('input[type=file]');
		await expect(fileInput).toBeAttached();

		await fileInput.setInputFiles(SAMPLE_IMAGE_PATH);

		// The decoded preview is the user-visible signal that the upload completed.
		const uploadPreview = dialog.getByTestId('image-upload-preview');
		await expect(uploadPreview).toBeVisible({ timeout: 10_000 });
		await expect(uploadPreview).toHaveJSProperty('complete', true);
		await expect
			.poll(() => uploadPreview.evaluate((image: HTMLImageElement) => image.naturalWidth))
			.toBeGreaterThan(0);

		// No error message should be shown
		await expect(dialog.locator('.text-destructive')).not.toBeVisible();

		// Fill in the gift name and submit
		await dialog.getByRole('textbox', { name: 'Název' }).fill('Dárek s obrázkem');
		await dialog.getByRole('button', { name: 'Přidat dárek' }).click();

		await expect(page.getByText('Dárek s obrázkem')).toBeVisible({ timeout: 10_000 });

		// Re-opening an uploaded-image gift opens on the Upload tab with the existing
		// image shown as the preview (not its resolved URL in the URL field). The
		// preview test id is only rendered while the Upload tab is active.
		await page.getByText('Dárek s obrázkem').click();
		const editDialog = page.getByRole('dialog');
		await expect(editDialog).toBeVisible({ timeout: 5_000 });
		await expect(editDialog.getByTestId('image-upload-preview')).toBeVisible({
			timeout: 5_000,
		});

		await page.context().close();
	});

	test('upload does not block form if skipped', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gc-img-skip');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Skip Upload Test');
		const dialog = await openAddGiftDialog(page);

		// Switch to Upload tab but do NOT upload anything
		await dialog.getByRole('button', { name: 'Nahrát', exact: true }).click();

		// Fill name and submit immediately without uploading
		await dialog.getByRole('textbox', { name: 'Název' }).fill('Dárek bez obrázku');
		await dialog.getByRole('button', { name: 'Přidat dárek' }).click();

		// Creation should succeed
		await expect(page.getByText('Dárek bez obrázku')).toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});
});

// ── Gift list refresh after creation ─────────────────────────────────────────

test.describe('Gift list refresh after creation', () => {
	test('new gift appears without page reload', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gc-refresh');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Refresh Test');

		// Add first gift
		let dialog = await openAddGiftDialog(page);
		await dialog.getByRole('textbox', { name: 'Název' }).fill('První dárek');
		await dialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(dialog).not.toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('heading', { name: 'První dárek', level: 3 })).toBeVisible({
			timeout: 10_000,
		});

		// Add second gift – no reload between
		dialog = await openAddGiftDialog(page);
		await dialog.getByRole('textbox', { name: 'Název' }).fill('Druhý dárek');
		await dialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(dialog).not.toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('heading', { name: 'Druhý dárek', level: 3 })).toBeVisible({
			timeout: 10_000,
		});

		// Both gifts must be visible simultaneously without a reload
		await expect(page.getByRole('heading', { name: 'První dárek', level: 3 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Druhý dárek', level: 3 })).toBeVisible();

		await page.context().close();
	});
});
