import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import {
	registerAndGetPage,
	registerViaApi,
	loginViaApi,
	createAuthenticatedContext,
} from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	addGift,
	shareWishlist,
	generateInviteLink,
} from './fixtures/wishlist-helpers.js';

/**
 * Reserver names are moderator-only (issue #198): any viewer may see THAT a gift is
 * reserved (the anonymous badge + counts, unaffected here), but only a správce
 * (moderator) may see WHO reserved it. Superseded issue #102 REQ-14, which showed the
 * reserver's display name to visitors too — that leaked authenticated users' real
 * account names to anyone holding the wishlist link.
 *
 * Locale caution: SSR base locale (cs/en) can flip between requests, so the reserved
 * indicator accepts either localized label. Fully reserved gifts intentionally omit the
 * redundant disabled reserve control (issue #255). The reserver's account NAME string is
 * locale-independent and is what actually proves/disproves the leak.
 */
test.describe('Reserver names are moderator-only (issue #198)', () => {
	test('visitor sees the reserved indicator but never the reserver name', async ({
		browser,
		request,
		baseURL,
	}) => {
		// Owner (recipient) creates + shares a wishlist with one gift.
		const owner = createTestUser('reserver-privacy-owner');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(ownerPage, 'Reserver Privacy Test');
		await addGift(ownerPage, 'Privacy Gift');
		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;
		await ownerPage.context().close();

		// An authenticated gifter reserves while logged in – the account's real name
		// becomes the reserver identity server-side (no anonymous-name field involved).
		const reserver = createTestUser('reserver-privacy-reserver');
		await registerViaApi(request, baseURL!, reserver);
		const reserverCookies = await loginViaApi(request, baseURL!, reserver);
		const reserverContext = await createAuthenticatedContext(
			browser,
			reserverCookies,
			baseURL!,
		);
		const reserverPage = await reserverContext.newPage();
		await reserverPage.goto(wishlistPath);
		await expect(reserverPage.getByTestId('reserve-button').first()).toBeVisible({
			timeout: 10_000,
		});
		await reserverPage.getByTestId('reserve-button').first().click();
		const reserveDialog = reserverPage.getByRole('dialog');
		await expect(reserveDialog).toBeVisible({ timeout: 5_000 });
		await reserveDialog.getByRole('button', { name: /Rezervovat/ }).click();
		await expect(reserveDialog).not.toBeVisible({ timeout: 10_000 });
		await reserverContext.close();

		// A separate visitor (neither owner, moderator, nor the reserver) opens the list.
		const visitor = createTestUser('reserver-privacy-visitor');
		const visitorPage = await registerAndGetPage(browser, request, baseURL!, visitor);
		await visitorPage.goto(wishlistPath);

		const giftCard = visitorPage
			.locator('[data-gift-item]')
			.filter({ hasText: 'Privacy Gift' });
		// The image/status treatment remains the reservation signal, while issue #255 removes
		// the redundant disabled reserve control from a fully reserved gift.
		await expect(giftCard.getByText(/Rezervováno|Reserved/).first()).toBeVisible({
			timeout: 10_000,
		});
		await expect(giftCard.getByTestId('reserve-button')).toHaveCount(0);
		// The reserver's account name must appear NOWHERE on the page.
		await expect(visitorPage.getByText(reserver.name)).toHaveCount(0);

		await visitorPage.context().close();
	});

	test('moderator sees the reserver name on the same wishlist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('reserver-privacy-mod-owner');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(ownerPage, 'Reserver Privacy Mod Test');
		await addGift(ownerPage, 'Privacy Mod Gift');
		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;

		const inviteUrl = await generateInviteLink(ownerPage);
		await ownerPage.keyboard.press('Escape');

		// A second user accepts the moderator invite (správce role on the list).
		const moderatorUser = createTestUser('reserver-privacy-mod');
		const moderatorCookies = await registerViaApi(request, baseURL!, moderatorUser);
		const moderatorContext = await createAuthenticatedContext(
			browser,
			moderatorCookies,
			baseURL!,
		);
		const moderatorPage = await moderatorContext.newPage();
		const invitePath = new URL(inviteUrl).pathname;
		await moderatorPage.goto(invitePath);
		await expect(moderatorPage.getByRole('button', { name: /Přijmout pozvánku/ })).toBeVisible({
			timeout: 5_000,
		});
		const acceptButton = moderatorPage.getByRole('button', { name: /Přijmout pozvánku/ });
		// The SSR button stays disabled until the invite page mounts, preventing a lost
		// one-shot acceptance click before hydration wires its handler.
		await expect(acceptButton).toBeEnabled();
		await acceptButton.click();
		await moderatorPage.waitForURL(`**${wishlistPath}`, { timeout: 10_000 });
		await expect(moderatorPage.getByRole('heading', { level: 1 })).toBeVisible({
			timeout: 10_000,
		});

		// A reserver (distinct from both owner and moderator) reserves while authenticated.
		const reserver = createTestUser('reserver-privacy-mod-reserver');
		await registerViaApi(request, baseURL!, reserver);
		const reserverCookies = await loginViaApi(request, baseURL!, reserver);
		const reserverContext = await createAuthenticatedContext(
			browser,
			reserverCookies,
			baseURL!,
		);
		const reserverPage = await reserverContext.newPage();
		await reserverPage.goto(wishlistPath);
		await expect(reserverPage.getByTestId('reserve-button').first()).toBeVisible({
			timeout: 10_000,
		});
		await reserverPage.getByTestId('reserve-button').first().click();
		const reserveDialog = reserverPage.getByRole('dialog');
		await expect(reserveDialog).toBeVisible({ timeout: 5_000 });
		await reserveDialog.getByRole('button', { name: /Rezervovat/ }).click();
		await expect(reserveDialog).not.toBeVisible({ timeout: 10_000 });
		await reserverContext.close();

		// The moderator reloads and now sees the reserver's display name.
		await moderatorPage.reload();
		await expect(moderatorPage.getByText(reserver.name).first()).toBeVisible({
			timeout: 10_000,
		});

		await moderatorContext.close();
		await ownerPage.context().close();
	});
});
