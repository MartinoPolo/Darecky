import { test, expect, type Locator } from '@playwright/test';
import { createTestUser, TEST_GIFT } from './fixtures/test-data.js';
import {
	registerAndGetPage,
	registerViaApi,
	createAuthenticatedContext,
} from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	addGift,
	shareWishlist,
	archiveWishlist,
} from './fixtures/wishlist-helpers.js';

// Reveals (if needed) and fills the first URL input in the multi-link editor.
async function fillGiftUrl(dialog: Locator, url: string) {
	const urlInput = dialog.getByTestId('gift-link-url').first();
	if (!(await urlInput.isVisible().catch(() => false))) {
		await dialog.getByRole('button', { name: /Přidat odkaz|Add link/ }).click();
	}
	await urlInput.fill(url);
}

// ── Gift editing (issue #9) ───────────────────────────────────────────────────

test.describe('Gift editing', () => {
	test('owner can edit a gift name on unshared wishlist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-edit');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Edit Gift Test');
		await addGift(page, TEST_GIFT.name);

		// Open the gift detail modal by clicking the gift card
		await page.getByText(TEST_GIFT.name).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });

		// The modal should be in edit mode – change the name
		const updatedGiftName = 'Upraveny darek';
		const nameInput = dialog.getByRole('textbox', { name: 'Název' });
		await nameInput.clear();
		await nameInput.fill(updatedGiftName);

		// Save – button reads "Uložit" in edit mode
		await dialog.getByRole('button', { name: /Uložit|Ulozit|Save/i }).click();
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });

		// The updated name should now appear on the page
		await expect(page.getByText(updatedGiftName)).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText(TEST_GIFT.name)).not.toBeVisible();

		await page.context().close();
	});

	test('edit modal pre-populates all fields from the gift', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-prepop');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Pre-populate Test');

		// Create a gift with all fields filled
		await page
			.getByRole('button', { name: /Přidat/ })
			.first()
			.click();
		const createDialog = page.getByRole('dialog');
		await expect(createDialog).toBeVisible({ timeout: 5_000 });
		await createDialog.getByRole('textbox', { name: 'Název' }).fill('Testovaci polozka');
		await createDialog.getByRole('textbox', { name: /Popis/i }).fill('Popis testovaci');
		await fillGiftUrl(createDialog, 'https://example.com/item');
		await createDialog.getByLabel(/Cena/).fill('999');
		await createDialog.locator('#gift-quantity').clear();
		await createDialog.locator('#gift-quantity').fill('3');
		await createDialog.getByRole('button', { name: 'Přidat dárek' }).click();
		await expect(page.getByText('Testovaci polozka')).toBeVisible({ timeout: 10_000 });

		// Re-open the gift – edit modal must be pre-populated
		await page.getByText('Testovaci polozka').click();
		const editDialog = page.getByRole('dialog');
		await expect(editDialog).toBeVisible({ timeout: 5_000 });

		await expect(editDialog.getByRole('textbox', { name: 'Název' })).toHaveValue(
			'Testovaci polozka',
		);
		// Use exact name – the link-row label input ("Popisek …") also matches a loose /Popis/i.
		await expect(editDialog.getByRole('textbox', { name: 'Popis', exact: true })).toHaveValue(
			'Popis testovaci',
		);
		await expect(editDialog.getByTestId('gift-link-url').first()).toHaveValue(
			'https://example.com/item',
		);
		await expect(editDialog.getByLabel(/Cena/)).toHaveValue('999');
		await expect(editDialog.locator('#gift-quantity')).toHaveValue('3');

		await editDialog.getByRole('button', { name: /Close|Zavřít|Zavrit/i }).click();

		// Open "Add gift" after editing – form must be empty (no stale data)
		await page
			.getByRole('button', { name: /Přidat/ })
			.first()
			.click();
		const addDialog = page.getByRole('dialog');
		await expect(addDialog).toBeVisible({ timeout: 5_000 });
		await expect(addDialog.getByRole('textbox', { name: 'Název' })).toHaveValue('');
		await expect(addDialog.getByRole('textbox', { name: /Popis/i })).toHaveValue('');
		// The new-gift link editor starts empty – just the add-link button, no URL input.
		await expect(
			addDialog.getByRole('button', { name: /Přidat odkaz|Add link/ }),
		).toBeVisible();
		await expect(addDialog.getByTestId('gift-link-url')).toHaveCount(0);
		await expect(addDialog.getByLabel(/Cena/)).toHaveValue('');

		await page.context().close();
	});

	test('editing a gift preserves its priority on save (regression: silent priority wipe)', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-priority');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Priority Persist Test');

		// Create a gift WITH a priority (the high-priority default level "Vysoká").
		await page
			.getByRole('button', { name: /Přidat/ })
			.first()
			.click();
		const createDialog = page.getByRole('dialog');
		await expect(createDialog).toBeVisible({ timeout: 5_000 });
		await createDialog.getByRole('textbox', { name: 'Název' }).fill('Darek s prioritou');
		// The priority Select trigger initially reads "Bez priority"; open it and pick "Vysoká".
		await createDialog.getByRole('button', { name: 'Bez priority' }).click();
		await page.getByRole('option', { name: 'Vysoká' }).click();
		await createDialog.getByRole('button', { name: 'Přidat dárek' }).click();

		// The card must show the chosen priority.
		const card = page.getByRole('button', { name: /Darek s prioritou/ });
		await expect(card).toContainText('Vysoká', { timeout: 10_000 });

		// Re-open the gift: the edit modal must SEED the existing priority (the bug seeded it
		// as empty, so the trigger read "Bez priority" and saving wiped the priority).
		await page.getByText('Darek s prioritou').click();
		const editDialog = page.getByRole('dialog');
		await expect(editDialog).toBeVisible({ timeout: 5_000 });
		await expect(editDialog.getByRole('button', { name: 'Vysoká' })).toBeVisible();

		// Save without changing anything – the priority must NOT be wiped.
		await editDialog.getByRole('button', { name: /^(Uložit|Ulozit|Save)$/ }).click();
		await expect(editDialog).not.toBeVisible({ timeout: 5_000 });

		await expect(card).toContainText('Vysoká', { timeout: 10_000 });

		await page.context().close();
	});

	test('switching between two gifts shows correct data each time', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-switch');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Switch Gift Test');
		await addGift(page, 'Darek alfa');
		await addGift(page, 'Darek beta');

		// Open first gift
		await page.getByText('Darek alfa').click();
		let dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await expect(dialog.getByRole('textbox', { name: 'Název' })).toHaveValue('Darek alfa');
		await dialog.getByRole('button', { name: /Close|Zavřít|Zavrit/i }).click();
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });

		// Open second gift – must show its data, not the first gift's
		await page.getByText('Darek beta').click();
		dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await expect(dialog.getByRole('textbox', { name: 'Název' })).toHaveValue('Darek beta');

		await page.context().close();
	});
});

// ── Gift deletion (issue #9) ──────────────────────────────────────────────────

test.describe('Gift deletion', () => {
	test('owner can delete a gift on unshared wishlist', async ({ browser, request, baseURL }) => {
		const user = createTestUser('gift-delete');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Delete Gift Test');
		await addGift(page, TEST_GIFT.name);

		// Open the gift detail modal
		await page.getByText(TEST_GIFT.name).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });

		// First click shows confirmation, second click confirms deletion
		await dialog.getByRole('button', { name: /Smazat/i }).click();
		await dialog.getByRole('button', { name: /Opravdu smazat/i }).click();

		await expect(dialog).not.toBeVisible({ timeout: 5_000 });

		// Gift should be gone from the list
		await expect(page.getByText(TEST_GIFT.name)).not.toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});
});

// ── Post-share editing rules (issues #82 / #83) ──────────────────────────────
//
// Sharing no longer hard-locks pre-existing gifts. Instead per-field rules apply
// (name frozen, delete blocked; details stay editable), and a 2-minute grace
// window after sharing temporarily restores FULL edit incl. name + delete, shown
// as a live countdown. The per-field lock + grace expiry logic is covered by unit
// tests (grace_window.test.ts, gift_post_share.test.ts); this E2E guards the
// deterministic user-facing behavior right after sharing.

test.describe('Post-share editing rules', () => {
	test('shared list shows the shared status chip; pre-share gifts stay fully editable during the grace window', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('gift-lock');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Share Lock Test');
		await addGift(page, TEST_GIFT.name);

		// Share the wishlist – pre-existing gifts become subject to the #82 rules.
		await shareWishlist(page);

		// Anime-sky redesign (#102, REQ-12): the full-width shared lifecycle strip is gone.
		// The shared state is now surfaced by the compact status chip in the header meta row.
		await expect(
			page.getByTestId('wishlist-banner').getByText('Sdíleno', { exact: true }),
		).toBeVisible({ timeout: 5_000 });

		// Open the pre-share gift. Sharing opens a 2-minute grace window (#83) during
		// which the owner regains full edit, surfaced as a live countdown.
		await page.getByText(TEST_GIFT.name).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });

		// Grace countdown is shown and the name field is editable while the window is open.
		await expect(dialog.getByText(/Právě sdíleno/i)).toBeVisible({ timeout: 5_000 });
		await expect(dialog.locator('#gift-name')).toBeEnabled();

		await page.keyboard.press('Escape');
		await expect(dialog).not.toBeVisible({ timeout: 5_000 });

		// Owner CAN still add new gifts after sharing.
		await addGift(page, 'Novy darek po sdileni');

		await page.context().close();
	});
});

// ── Wishlist archival (issue #6) ──────────────────────────────────────────────

test.describe('Wishlist archival', () => {
	test('owner can archive a wishlist', async ({ browser, request, baseURL }) => {
		const user = createTestUser('archive-owner');
		const page = await registerAndGetPage(browser, request, baseURL!, user);

		await createWishlistAndNavigate(page, 'Archive Test');
		await addGift(page, TEST_GIFT.name);
		await shareWishlist(page);

		await archiveWishlist(page);

		// The archived alert appears. Shipped Czech copy uses a colon ("Archivováno:")
		// per the no-em-dash rule (the old en-dash form was retired in the redesign).
		await expect(page.getByText(/Archivováno: seznam je uzavřen/i)).toBeVisible({
			timeout: 10_000,
		});

		await page.context().close();
	});

	test('archived wishlist is read-only for visitors', async ({ browser, request, baseURL }) => {
		// Set up owner and create+share wishlist
		const ownerUser = createTestUser('archive-owner2');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, ownerUser);

		await createWishlistAndNavigate(ownerPage, 'Visitor Archive Test');
		await addGift(ownerPage, TEST_GIFT.name);
		await shareWishlist(ownerPage);

		// Capture the wishlist URL before archiving
		const wishlistPath = new URL(ownerPage.url()).pathname;

		// Archive the wishlist
		await archiveWishlist(ownerPage);
		await expect(ownerPage.getByText(/Archivováno: seznam je uzavřen/i)).toBeVisible({
			timeout: 10_000,
		});

		// Create a new visitor and visit the archived wishlist
		const visitorUser = createTestUser('archive-visitor');
		const visitorCookies = await registerViaApi(request, baseURL!, visitorUser);
		const visitorContext = await createAuthenticatedContext(browser, visitorCookies, baseURL!);
		const visitorPage = await visitorContext.newPage();

		await visitorPage.goto(wishlistPath);

		// The gift should be visible
		await expect(visitorPage.getByText(TEST_GIFT.name)).toBeVisible({ timeout: 10_000 });

		// The reserve trigger should be hidden on an archived list. Locale-agnostic:
		// ReserveButton's label is i18n'd (issue #154), select via stable data-testid.
		await expect(visitorPage.getByTestId('reserve-button')).not.toBeVisible();

		await visitorContext.close();
		await ownerPage.context().close();
	});
});
