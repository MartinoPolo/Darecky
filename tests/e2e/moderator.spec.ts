import { test, expect, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import {
	registerAndGetPage,
	registerViaApi,
	createAuthenticatedContext,
} from './fixtures/auth-helpers.js';
import {
	createWishlistAndNavigate,
	createWishlistForSomeoneAndNavigate,
	addGift,
	shareWishlist,
	openModeratorPanel,
	generateInviteLink,
} from './fixtures/wishlist-helpers.js';

// ── Shared helpers ────────────────────────────────────────────────────────────

async function addGiftAndShare(page: Page, giftName: string) {
	await addGift(page, giftName);
	await shareWishlist(page);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Moderator system', () => {
	test('manager can open správci management from the responsive hero actions', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('mod-owner-btn');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(page, 'Mod Owner Btn Test');

		// The manager command is capability-gated inside the responsive hero More surface.
		const panel = await openModeratorPanel(page);
		await expect(panel).toBeVisible();

		await page.context().close();
	});

	test('owner can generate moderator invite link', async ({ browser, request, baseURL }) => {
		const owner = createTestUser('mod-invite-gen');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(page, 'Mod Invite Gen Test');

		const panel = await openModeratorPanel(page);

		// "Generovat pozvánku" button is present
		await expect(panel.getByRole('button', { name: /Generovat pozvánku/ })).toBeVisible();

		// Click to generate
		await panel.getByRole('button', { name: /Generovat pozvánku/ }).click();

		// A monospace link box with the invite URL appears
		const linkBox = panel.getByTestId('invite-link');
		await expect(linkBox).toBeVisible({ timeout: 5_000 });
		const generatedUrl = (await linkBox.textContent()) ?? '';
		expect(generatedUrl.trim()).toContain('/invite/');

		// A copy button also becomes visible
		await expect(panel.getByTestId('copy-invite-link')).toBeVisible();

		await page.context().close();
	});

	test('another user can accept moderator invite and becomes moderator', async ({
		browser,
		request,
		baseURL,
	}) => {
		// ── Step 1: owner sets up wishlist + gift + sharing + invite ──────────
		const owner = createTestUser('mod-owner-flow');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);

		await createWishlistAndNavigate(ownerPage, 'Mod Invite Flow Test');
		await addGiftAndShare(ownerPage, 'Invite Flow Gift');

		const inviteUrl = await generateInviteLink(ownerPage);
		// Close the moderator panel
		await ownerPage.keyboard.press('Escape');

		const wishlistPath = new URL(ownerPage.url()).pathname;

		// ── Step 2: new user accepts invite ───────────────────────────────────
		const invitee = createTestUser('mod-invitee');
		const inviteeCookies = await registerViaApi(request, baseURL!, invitee);
		const inviteeContext = await createAuthenticatedContext(browser, inviteeCookies, baseURL!);
		const inviteePage = await inviteeContext.newPage();

		// inviteUrl is a full URL string from the panel; navigate to the path portion
		const invitePath = new URL(inviteUrl).pathname;
		await inviteePage.goto(invitePath);

		// Invite acceptance page shows the pending state
		await expect(inviteePage.getByRole('button', { name: /Přijmout pozvánku/ })).toBeVisible({
			timeout: 5_000,
		});
		await inviteePage.getByRole('button', { name: /Přijmout pozvánku/ }).click();

		// After acceptance the page redirects to the wishlist
		await inviteePage.waitForURL(`**${wishlistPath}`, { timeout: 10_000 });

		// Správce sees gift reservation status (same as visitor, with full detail). The gift is
		// visible; the správci-management button IS available (any správce can invite/revoke
		// správci per the rights matrix), so we assert on the gift only, not on button absence.
		await expect(inviteePage.getByText('Invite Flow Gift')).toBeVisible({ timeout: 5_000 });

		// ── Step 3: anonymous visitor reserves the gift ───────────────────────
		const anonymousContext = await browser.newContext();
		const anonymousPage = await anonymousContext.newPage();
		await anonymousPage.goto(wishlistPath);

		// Locale-agnostic: ReserveButton's label is i18n'd (issue #154), select the
		// card-level trigger via its stable data-testid.
		const anonymousReserve = anonymousPage.getByTestId('reserve-button').first();
		await expect(anonymousReserve).toBeVisible();
		await anonymousReserve.click();
		const reserveDialog = anonymousPage.getByRole('dialog');
		await expect(reserveDialog).toBeVisible({ timeout: 5_000 });
		await reserveDialog.getByRole('textbox', { name: /Vaše jméno/i }).fill('Anon Reserver');
		await reserveDialog.getByRole('button', { name: /Rezervovat/ }).click();
		await expect(anonymousPage.getByText(/Rezervov[aá]no/).first()).toBeVisible({
			timeout: 5_000,
		});
		await anonymousContext.close();

		// ── Step 4: moderator can see the reservation status ──────────────────
		await inviteePage.reload();
		// As a moderator, gift shows as reserved
		await expect(inviteePage.getByText(/Rezervov[aá]no/).first()).toBeVisible({
			timeout: 5_000,
		});

		await inviteeContext.close();
		await ownerPage.context().close();
	});

	test('recipient self-promote shows in-panel disclosure and the loud visitor trust warning', async ({
		browser,
		request,
		baseURL,
	}) => {
		// A linked recipient (for-me list) self-promotes to also see reservation state.
		// Anime-sky redesign (#102, REQ-13): the bespoke purple header strip is gone. The
		// recipient's own confirmation is the permanent in-panel active disclosure; the
		// visitor-facing notice becomes the loud accent trust warning Alert (shown to any
		// viewer who is NOT the recipient), which is the notice visitors must not miss.
		const recipient = createTestUser('mod-self-promote');
		const page = await registerAndGetPage(browser, request, baseURL!, recipient);

		const wishlistPath = await createWishlistAndNavigate(page, 'Self Promote Test');

		// Share wishlist so the disclosure is meaningful
		await shareWishlist(page);

		// Open the správci panel
		const panel = await openModeratorPanel(page);

		// „Aktivovat zobrazení" / „Activate visibility" button is in the self-promote section
		await expect(
			panel.getByRole('button', { name: /Aktivovat zobrazení|Activate visibility/ }),
		).toBeVisible({ timeout: 5_000 });
		await panel
			.getByRole('button', { name: /Aktivovat zobrazení|Activate visibility/ })
			.click();

		// The panel updates in place (it does not close): the self-promote button is replaced by
		// the permanent active-disclosure text (moderator_active_disclosure). This is the
		// recipient's permanent disclosure now that the header strip is removed.
		await expect(
			panel.getByText(/Vidíte stav rezervací|You can see reservation status/),
		).toBeVisible({ timeout: 5_000 });
		await expect(
			panel.getByRole('button', { name: /Aktivovat zobrazení|Activate visibility/ }),
		).not.toBeVisible();

		await page.context().close();

		// A separate visitor to the shared list sees the loud trust warning (REQ-13): the
		// recipient is also a manager and can see reservations. Shown for any non-recipient
		// viewer; the recipient themselves never sees this header alert.
		const visitorUser = createTestUser('self-promote-visitor');
		const visitorCookies = await registerViaApi(request, baseURL!, visitorUser);
		const visitorContext = await createAuthenticatedContext(browser, visitorCookies, baseURL!);
		const visitorPage = await visitorContext.newPage();

		await visitorPage.goto(wishlistPath);
		await expect(
			visitorPage.getByText(
				new RegExp(`${recipient.name}.*(zároveň správcem|is also a manager)`),
			),
		).toBeVisible({ timeout: 10_000 });

		await visitorContext.close();
	});

	test('recipient rename via the header pencil reflects in the wishlist banner without reload', async ({
		browser,
		request,
		baseURL,
	}) => {
		// Issue #150 relocated recipient editing out of the správci panel: the header „Pro: {name}"
		// pencil opens the shared EditRecipientDialog (rename mode on free-text lists). Regression
		// (issue #119): the page banner (data-testid="wishlist-banner", driven by the page-local
		// getWishlistByShortId query) must update in place — the old panel save never refreshed it.
		const manager = createTestUser('recipient-rename-header');
		const page = await registerAndGetPage(browser, request, baseURL!, manager);

		await createWishlistForSomeoneAndNavigate(page, {
			title: 'Recipient Rename Test',
			recipientName: 'Rosie',
		});

		const banner = page.getByTestId('wishlist-banner');
		await expect(banner).toContainText('Rosie');

		// Open the header recipient-edit pencil → shared dialog (rename mode on free-text lists).
		await page.getByTestId('edit-recipient-button').click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		const recipientInput = dialog.getByLabel(/Jméno obdarovaného|Recipient name/);
		await expect(recipientInput).toHaveValue('Rosie');
		await recipientInput.fill('Rosalie');
		await dialog.getByRole('button', { name: /Uložit jméno|Save name/ }).click();

		await expect(
			page.getByText(/Jméno obdarovaného bylo změněno|Recipient name updated/),
		).toBeVisible({
			timeout: 5_000,
		});

		// No page.reload() – the banner must update from the refreshed query alone.
		await expect(banner).toContainText('Rosalie', { timeout: 5_000 });
		await expect(banner).not.toContainText('Rosie po');

		await page.context().close();
	});
});
