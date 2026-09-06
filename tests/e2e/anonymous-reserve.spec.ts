import {
	test,
	expect,
	type APIRequestContext,
	type Browser,
	type Locator,
	type Page,
} from '@playwright/test';
import { createTestUser, TEST_GIFT, ANONYMOUS_RESERVER } from './fixtures/test-data.js';
import { registerAndGetPage, registerViaApi } from './fixtures/auth-helpers.js';
import { createWishlistAndNavigate, addGift, shareWishlist } from './fixtures/wishlist-helpers.js';
import { GIFT_CROP_TARGET_SPECS } from '../../src/lib/modules/images/crop_targets.js';

async function createSharedWishlistPath(
	browser: Browser,
	request: APIRequestContext,
	baseURL: string,
	ownerRole: string,
): Promise<string> {
	const owner = createTestUser(ownerRole);
	const ownerPage = await registerAndGetPage(browser, request, baseURL, owner);

	await createWishlistAndNavigate(ownerPage, `Anonymous ${ownerRole}`);
	await addGift(ownerPage, TEST_GIFT.name, {
		description: 'Popis pro mobilní rozložení',
		price: String(TEST_GIFT.price),
		primaryLink: TEST_GIFT.url,
	});
	await shareWishlist(ownerPage);

	const wishlistPath = new URL(ownerPage.url()).pathname;
	await ownerPage.context().close();
	return wishlistPath;
}

async function installTurnstileMock(page: Page): Promise<void> {
	await page.addInitScript(() => {
		(window as unknown as { turnstile: unknown }).turnstile = {
			render: (_container: HTMLElement, options: { callback: (token: string) => void }) => {
				queueMicrotask(() => options.callback('XXXX.DUMMY.TOKEN.XXXX'));
				return 'playwright-turnstile';
			},
			reset: () => undefined,
			remove: () => undefined,
		};
	});
}

async function expectWishlistRedirectAuthLinks(
	dialog: Locator,
	baseURL: string,
	expectedRedirectHref: string,
	expectedAuthenticationPrefix = '',
): Promise<void> {
	for (const authenticationPath of ['/login', '/register'] as const) {
		const link = dialog.locator(`a[href*="${authenticationPath}"]`);
		await expect(link).toHaveCount(1);

		const href = await link.getAttribute('href');
		expect(href).not.toBeNull();
		const parsedHref = new URL(href!, baseURL);
		expect(parsedHref.pathname).toBe(`${expectedAuthenticationPrefix}${authenticationPath}`);
		expect(parsedHref.searchParams.get('redirect')).toBe(expectedRedirectHref);
	}
}

test.describe('Anonymous visitor reservation', () => {
	test('anonymous visitor can view and reserve on shared wishlist', async ({
		browser,
		request,
		baseURL,
	}) => {
		const wishlistPath = await createSharedWishlistPath(
			browser,
			request,
			baseURL!,
			'anon-owner',
		);

		// Anonymous visitor
		const visitorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
		const visitorPage = await visitorContext.newPage();
		await installTurnstileMock(visitorPage);
		await visitorPage.goto(wishlistPath);
		await visitorPage.waitForLoadState('networkidle');
		await expect(visitorPage.getByText(TEST_GIFT.name)).toBeVisible();
		// Locale-agnostic: ReserveButton's label/aria-label are i18n'd (issue #154), so
		// select the card-level trigger via its stable data-testid.
		await expect(visitorPage.getByTestId('reserve-button').first()).toBeVisible();

		// Mobile gift layout (issue #163): switch to list view and assert the image/actions
		// arrangement. Use stable data-testids so the assertions stay locale-robust (issue #154).
		await visitorPage.getByTestId('gift-view-list').click();

		const mobileListItem = visitorPage
			.getByTestId('gift-list-item')
			.filter({ hasText: TEST_GIFT.name });
		const image = mobileListItem.getByTestId('gift-list-image');
		const reserve = mobileListItem.getByTestId('reserve-button');
		const like = mobileListItem.getByRole('button', {
			name: `Přidat do oblíbených: ${TEST_GIFT.name}`,
		});
		const moreActions = mobileListItem.getByRole('button', {
			name: /Další akce|More actions/i,
		});
		const [imageElement, reserveElement, likeElement, moreActionsElement] = await Promise.all([
			image.elementHandle(),
			reserve.elementHandle(),
			like.elementHandle(),
			moreActions.elementHandle(),
		]);
		expect(imageElement).not.toBeNull();
		expect(reserveElement).not.toBeNull();
		expect(likeElement).not.toBeNull();
		expect(moreActionsElement).not.toBeNull();

		// Read every rectangle in one browser task so a running view transition cannot
		// move the card between separately awaited protocol calls.
		const [imageBounds, reserveBounds, likeBounds, moreActionsBounds] =
			await visitorPage.evaluate(
				(elements) =>
					elements.map((element) => {
						const { x, y, width, height } = element.getBoundingClientRect();
						return { x, y, width, height };
					}),
				[imageElement!, reserveElement!, likeElement!, moreActionsElement!],
			);

		expect(imageBounds).not.toBeNull();
		expect(reserveBounds).not.toBeNull();
		expect(likeBounds).not.toBeNull();
		expect(moreActionsBounds).not.toBeNull();
		await expect(mobileListItem.getByRole('link', { name: /example\.com/ })).toBeVisible();
		expect(imageBounds!.width).toBeGreaterThanOrEqual(128);
		expect(imageBounds!.width).toBeLessThanOrEqual(152);
		// 1:1 list/reservation crop (issue #189, reverting the interim 4:3 list thumb
		// from #183): the thumb is square again, so height ≈ width via the same
		// registry aspect the real surface renders at.
		expect(imageBounds!.height).toBeCloseTo(
			imageBounds!.width / GIFT_CROP_TARGET_SPECS.thumb.aspect,
			0,
		);
		expect(reserveBounds!.x).toBeGreaterThanOrEqual(imageBounds!.x + imageBounds!.width);
		expect(moreActionsBounds!.x).toBeGreaterThanOrEqual(imageBounds!.x + imageBounds!.width);
		expect(likeBounds!.x).toBeGreaterThanOrEqual(imageBounds!.x);
		expect(likeBounds!.y).toBeGreaterThanOrEqual(imageBounds!.y);
		expect(likeBounds!.x + likeBounds!.width).toBeLessThanOrEqual(
			imageBounds!.x + imageBounds!.width,
		);
		expect(likeBounds!.y + likeBounds!.height).toBeLessThanOrEqual(
			imageBounds!.y + imageBounds!.height,
		);

		await moreActions.click();
		const moreActionsDialog = visitorPage.getByRole('dialog');
		await expect(moreActionsDialog).toBeVisible();
		await expect(
			moreActionsDialog.getByRole('link', {
				name: /Otevřít hlavní odkaz|Open primary link/i,
			}),
		).toBeVisible();
		await visitorPage.keyboard.press('Escape');
		await expect(moreActionsDialog).toBeHidden();

		// Anonymous like prompt keeps the wishlist context on both auth links.
		await visitorPage
			.getByRole('button', { name: `Přidat do oblíbených: ${TEST_GIFT.name}` })
			.click();
		const authPromptDialog = visitorPage.getByRole('dialog');
		await expect(authPromptDialog).toBeVisible();
		await expectWishlistRedirectAuthLinks(authPromptDialog, baseURL!, wishlistPath);
		await visitorPage.keyboard.press('Escape');
		await expect(authPromptDialog).not.toBeVisible();
		await expect(visitorPage.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);

		// Reserve
		await visitorPage.getByTestId('reserve-button').first().click();
		const reserveDialog = visitorPage.getByRole('dialog');
		await expect(reserveDialog).toBeVisible();
		await expectWishlistRedirectAuthLinks(reserveDialog, baseURL!, wishlistPath);
		await reserveDialog
			.getByRole('textbox', { name: /Vaše jméno/i })
			.fill(ANONYMOUS_RESERVER.name);
		const submitReservationButton = reserveDialog.getByRole('button', { name: /Rezervovat/ });
		await expect(submitReservationButton).toBeEnabled();
		await submitReservationButton.click();
		await expect(visitorPage.getByText(/[Rr]ezervov/).first()).toBeVisible();

		await visitorContext.close();
	});

	test('wishlist auth links preserve the English route prefix', async ({
		browser,
		request,
		baseURL,
	}) => {
		const wishlistPath = await createSharedWishlistPath(
			browser,
			request,
			baseURL!,
			'localized-links-owner',
		);
		const visitorContext = await browser.newContext();
		const visitorPage = await visitorContext.newPage();
		await installTurnstileMock(visitorPage);
		const localizedWishlistPath = `/en${wishlistPath}`;

		await visitorPage.goto(localizedWishlistPath);
		// Locale-agnostic: ReserveButton's label/aria-label are i18n'd (issue #154), so
		// select the card-level trigger via its stable data-testid.
		await visitorPage.getByTestId('reserve-button').first().click();
		const reserveDialog = visitorPage.getByRole('dialog');
		await expect(reserveDialog).toBeVisible();
		await expectWishlistRedirectAuthLinks(
			reserveDialog,
			baseURL!,
			localizedWishlistPath,
			'/en',
		);
		await visitorPage.keyboard.press('Escape');
		await expect(reserveDialog).not.toBeVisible();
		await expect(visitorPage.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);

		await visitorPage
			.getByRole('button', { name: `Add to favorites: ${TEST_GIFT.name}` })
			.click();
		const authPromptDialog = visitorPage.getByRole('dialog');
		await expect(authPromptDialog).toBeVisible();
		await expectWishlistRedirectAuthLinks(
			authPromptDialog,
			baseURL!,
			localizedWishlistPath,
			'/en',
		);

		await visitorContext.close();
	});

	test('register from reservation returns to the wishlist', async ({
		browser,
		request,
		baseURL,
		page,
	}) => {
		const wishlistPath = await createSharedWishlistPath(
			browser,
			request,
			baseURL!,
			'registration-return-owner',
		);

		const registrationUser = createTestUser('wishlist-register');
		await installTurnstileMock(page);
		await page.goto(wishlistPath);
		await page.getByTestId('reserve-button').first().click();
		await page.getByRole('dialog').locator('a[href*="/register"]').click();
		await expect(page).toHaveURL(
			(url) =>
				url.pathname === '/register' && url.searchParams.get('redirect') === wishlistPath,
		);
		const createAccountButton = page.getByRole('button', {
			name: 'Vytvořit účet',
		});
		await expect(createAccountButton).toBeEnabled();
		await createAccountButton.click();
		await expect(page.getByText('Jméno musí mít alespoň 2 znaky')).toBeVisible();

		await page.getByRole('textbox', { name: 'Jméno' }).fill(registrationUser.name);
		await page.getByRole('textbox', { name: 'E-mail' }).fill(registrationUser.email);
		const registrationPasswordInput = page.getByRole('textbox', { name: 'Heslo' });
		await registrationPasswordInput.fill(registrationUser.password);
		await registrationPasswordInput.blur();
		await expect(page.getByText('Heslo musí mít alespoň 8 znaků')).not.toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Jméno' })).toHaveValue(
			registrationUser.name,
		);
		await expect(page.getByRole('textbox', { name: 'E-mail' })).toHaveValue(
			registrationUser.email,
		);
		await createAccountButton.click();
		await expect(page).toHaveURL((url) => url.pathname === wishlistPath, { timeout: 20_000 });
	});

	test('login from reservation returns to the wishlist', async ({
		browser,
		request,
		baseURL,
		page,
	}) => {
		const wishlistPath = await createSharedWishlistPath(
			browser,
			request,
			baseURL!,
			'login-return-owner',
		);
		const loginUser = createTestUser('wishlist-login');
		await registerViaApi(request, baseURL!, loginUser);
		await page.goto(wishlistPath);
		await page.getByTestId('reserve-button').first().click();
		await page.getByRole('dialog').locator('a[href*="/login"]').click();
		await expect(page).toHaveURL(
			(url) => url.pathname === '/login' && url.searchParams.get('redirect') === wishlistPath,
		);
		const loginButton = page.getByRole('button', { name: 'Přihlásit se', exact: true });
		await loginButton.click();
		await expect(page.getByText('Zadejte emailovou adresu')).toBeVisible();

		await page.getByRole('textbox', { name: 'E-mail' }).fill(loginUser.email);
		await page.getByRole('textbox', { name: 'Heslo' }).fill(loginUser.password);
		await expect(page.getByRole('textbox', { name: 'E-mail' })).toHaveValue(loginUser.email);
		await loginButton.click();
		await expect(page).toHaveURL((url) => url.pathname === wishlistPath);
	});
});
