import { test, expect, type Browser, type Page } from '@playwright/test';
import { createTestUser, TEST_GIFT } from './fixtures/test-data.js';
import {
	createAuthenticatedContext,
	loginViaApi,
	registerAndGetPage,
} from './fixtures/auth-helpers.js';
import {
	addGift,
	createWishlistAndNavigate,
	shareWishlist,
	waitForDialogOverlayRemoval,
} from './fixtures/wishlist-helpers.js';

/**
 * Administrator release override (issue #213). The administrator is env-based
 * (`ADMIN_EMAILS` → `isAppAdmin`), so this spec depends on `playwright.config.ts` passing
 * `ADMIN_EMAILS=tomas@test.cz` to the dev server.
 *
 * CAVEAT: `webServer.reuseExistingServer` is true — an already-running `pnpm run dev` keeps
 * the env it was started with, and `tomas@test.cz` will NOT be an administrator there. If the
 * release control never appears, restart the dev server (or let Playwright start its own).
 *
 * Personas come from the seed (`pnpm db:seed`, shared password below): tomáš is the
 * administrator and is neither obdarovaný nor správce anywhere in this spec; petr is the
 * signed-in gifter whose reservation only an administrator may release. The wishlist and gift
 * are created fresh per run, so the spec is repeatable without reseeding.
 */
const SEED_PASSWORD = 'password123';
const ADMIN_USER = { email: 'tomas@test.cz', password: SEED_PASSWORD };
const GIFTER_USER = { email: 'petr@test.cz', password: SEED_PASSWORD };
const GIFTER_DISPLAY_NAME = 'Petr Svoboda';

async function signInAs(
	browser: Browser,
	request: Parameters<typeof loginViaApi>[0],
	baseURL: string,
	user: { email: string; password: string },
): Promise<Page> {
	const cookies = await loginViaApi(request, baseURL, user);
	const context = await createAuthenticatedContext(browser, cookies, baseURL);
	return context.newPage();
}

/** Reserve the single gift on the open wishlist page through the reserve dialog. */
async function reserveTheGift(page: Page): Promise<void> {
	await page.getByTestId('reserve-button').first().click();
	const reserveDialog = page.getByRole('dialog');
	await expect(reserveDialog).toBeVisible({ timeout: 5_000 });
	await reserveDialog.getByRole('button', { name: 'Rezervovat', exact: true }).click();
	await expect(reserveDialog).not.toBeVisible({ timeout: 10_000 });
	await waitForDialogOverlayRemoval(page);
	// The gift now reads as held by this gifter: the control flips to the cancel action.
	await expect(page.getByTestId('reserve-button').first()).toHaveText(/Zrušit rezervaci/);
}

test.describe('Administrator releases another gifter reservation (issue #213)', () => {
	test('releases a signed-in gifter reservation from a gift card and frees the capacity', async ({
		browser,
		request,
		baseURL,
	}) => {
		// Fresh list from a fresh owner: nobody in this spec is its obdarovaný or správce.
		const owner = createTestUser('release-owner');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(ownerPage, 'E2E uvolneni rezervace');
		await addGift(ownerPage, TEST_GIFT.name, { price: TEST_GIFT.price });
		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;
		await ownerPage.context().close();

		// Petr (signed in) reserves the gift — the case that returns 403 for everyone but the
		// app administrator.
		const gifterPage = await signInAs(browser, request, baseURL!, GIFTER_USER);
		await gifterPage.goto(wishlistPath);
		await expect(
			gifterPage.getByRole('heading', { name: TEST_GIFT.name, level: 3 }),
		).toBeVisible();
		await reserveTheGift(gifterPage);
		await gifterPage.context().close();

		// Tomáš (administrator, plain visitor on this list) sees the release control.
		const adminPage = await signInAs(browser, request, baseURL!, ADMIN_USER);
		await adminPage.goto(wishlistPath);

		const giftCard = adminPage.locator('[data-gift-item]').filter({ hasText: TEST_GIFT.name });
		await expect(giftCard).toBeVisible();
		// Fully reserved browse surfaces communicate status on the image and intentionally
		// render neither the redundant disabled reserve control nor privileged release.
		await expect(giftCard.getByTestId('reserve-button')).toHaveCount(0);
		await expect(giftCard.getByTestId('release-reservation-button')).toHaveCount(0);

		await giftCard.getByRole('heading', { name: TEST_GIFT.name, exact: true }).click();
		const giftDialog = adminPage.getByRole('dialog').filter({
			has: adminPage.getByRole('heading', { name: TEST_GIFT.name, exact: true }),
		});
		await expect(giftDialog).toBeVisible({ timeout: 5_000 });

		// An app administrator who does not manage this list reaches the override from the
		// read-only gift detail modal (issue #255 REQ-7).
		const releaseButton = giftDialog.getByTestId('release-reservation-button');
		await expect(releaseButton).toBeVisible({ timeout: 15_000 });
		await releaseButton.click();

		// One reservation on the gift → the picker is skipped and the confirmation names both
		// the gifter and the gift (REQ-4/REQ-8).
		const confirmation = adminPage.getByTestId('release-reservation-confirm');
		await expect(confirmation).toBeVisible({ timeout: 5_000 });
		await expect(confirmation).toContainText(GIFTER_DISPLAY_NAME);
		await expect(confirmation).toContainText(TEST_GIFT.name);

		await adminPage.getByTestId('release-reservation-confirm-action').click();
		await expect(confirmation).not.toBeVisible({ timeout: 10_000 });
		await expect(releaseButton).toHaveCount(0, { timeout: 15_000 });

		await adminPage.keyboard.press('Escape');
		await expect(giftDialog).not.toBeVisible({ timeout: 5_000 });
		await waitForDialogOverlayRemoval(adminPage);

		// Released capacity returns immediately on the refreshed browse surface.
		await expect(giftCard.getByTestId('reserve-button')).toBeEnabled({ timeout: 15_000 });
		await expect(giftCard.getByTestId('reserve-button')).toHaveText(/Rezervovat|Reserve/);
		await expect(giftCard.getByTestId('release-reservation-button')).toHaveCount(0);

		await adminPage.context().close();
	});

	test('renders no release control for a signed-in visitor who is not the administrator', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('release-denied-owner');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(ownerPage, 'E2E bez uvolneni');
		await addGift(ownerPage, TEST_GIFT.name, { price: TEST_GIFT.price });
		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;
		await ownerPage.context().close();

		const gifterPage = await signInAs(browser, request, baseURL!, GIFTER_USER);
		await gifterPage.goto(wishlistPath);
		await expect(
			gifterPage.getByRole('heading', { name: TEST_GIFT.name, level: 3 }),
		).toBeVisible();
		await reserveTheGift(gifterPage);
		await gifterPage.context().close();

		// A plain signed-in visitor sees the reserved status without a redundant disabled
		// control, and never gets release on either the browse surface or read-only detail.
		const visitor = createTestUser('release-denied-visitor');
		const visitorPage = await registerAndGetPage(browser, request, baseURL!, visitor);
		await visitorPage.goto(wishlistPath);

		const giftCard = visitorPage
			.locator('[data-gift-item]')
			.filter({ hasText: TEST_GIFT.name });
		await expect(giftCard.getByText(/Rezervováno|Reserved/).first()).toBeVisible();
		await expect(giftCard.getByTestId('reserve-button')).toHaveCount(0);
		await expect(giftCard.getByTestId('release-reservation-button')).toHaveCount(0);

		await giftCard.getByRole('heading', { name: TEST_GIFT.name, exact: true }).click();
		const giftDialog = visitorPage.getByRole('dialog').filter({
			has: visitorPage.getByRole('heading', { name: TEST_GIFT.name, exact: true }),
		});
		await expect(giftDialog).toBeVisible({ timeout: 5_000 });
		await expect(giftDialog.getByTestId('reserve-button')).toHaveCount(0);
		await expect(giftDialog.getByTestId('release-reservation-button')).toHaveCount(0);

		await visitorPage.context().close();
	});
	test('does not grant release or reservation visibility to an administrator who is the recipient', async ({
		browser,
		request,
		baseURL,
	}) => {
		const recipientPage = await signInAs(browser, request, baseURL!, ADMIN_USER);
		await createWishlistAndNavigate(recipientPage, 'E2E admin recipient privacy');
		await addGift(recipientPage, TEST_GIFT.name, { price: TEST_GIFT.price });
		await shareWishlist(recipientPage);
		const wishlistPath = new URL(recipientPage.url()).pathname;
		await recipientPage.context().close();

		const gifterPage = await signInAs(browser, request, baseURL!, GIFTER_USER);
		await gifterPage.goto(wishlistPath);
		await expect(
			gifterPage.getByRole('heading', { name: TEST_GIFT.name, level: 3 }),
		).toBeVisible();
		await reserveTheGift(gifterPage);
		await gifterPage.context().close();

		const returningRecipient = await signInAs(browser, request, baseURL!, ADMIN_USER);
		await returningRecipient.goto(wishlistPath);
		const giftCard = returningRecipient
			.locator('[data-gift-item]')
			.filter({ hasText: TEST_GIFT.name });
		await expect(giftCard).toBeVisible();

		// Admin capability stops at the recipient boundary. Neither status, identity, nor
		// privileged controls may reveal that another person reserved this gift.
		await expect(giftCard.getByText(/Rezervov[a\u00e1]no|Reserved/)).toHaveCount(0);
		await expect(giftCard.getByText(GIFTER_DISPLAY_NAME, { exact: true })).toHaveCount(0);
		await expect(giftCard.getByTestId('release-reservation-button')).toHaveCount(0);
		await expect(giftCard.getByTestId('reserve-button')).toHaveCount(0);

		await giftCard.getByRole('heading', { name: TEST_GIFT.name, exact: true }).click();
		const editDialog = returningRecipient.getByRole('dialog', {
			name: /Upravit dárek|Edit gift/,
		});
		await expect(editDialog).toBeVisible();
		await expect(editDialog.getByRole('textbox', { name: /Název|Name/ })).toHaveValue(
			TEST_GIFT.name,
		);
		await expect(editDialog.getByText(/Rezervov[a\u00e1]no|Reserved/)).toHaveCount(0);
		await expect(editDialog.getByText(GIFTER_DISPLAY_NAME, { exact: true })).toHaveCount(0);
		await expect(editDialog.getByTestId('release-reservation-button')).toHaveCount(0);

		await returningRecipient.context().close();
	});
});
