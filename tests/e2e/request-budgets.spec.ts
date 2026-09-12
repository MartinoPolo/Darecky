import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import {
	registerAndGetPage,
	loginViaApi,
	createAuthenticatedContext,
} from './fixtures/auth-helpers';
import { createTestUser } from './fixtures/test-data';
import { createWishlistAndNavigate, addGift, shareWishlist } from './fixtures/wishlist-helpers';

const SAMPLE_IMAGE_PATH = fileURLToPath(new URL('./fixtures/sample-image.jpg', import.meta.url));

/**
 * Dynamic-request budgets per user flow (issue #108, REQ-7).
 *
 * Every SvelteKit remote function call is one dynamic Worker invocation at
 * `/_app/remote/<hash>/<name>`. These tests pin the agreed maximum number of
 * such requests per flow and assert that mutations carry their refreshed data
 * back on the same response (single-flight) instead of triggering follow-up
 * fetches, and that dashboard queries are never invoked by unrelated mutations.
 */

/** Collect remote-function request names fired on `page` until `stop()` is called. */
function trackRemoteRequests(page: Page): { names: () => string[]; stop: () => void } {
	const names: string[] = [];
	const onRequest = (request: { url(): string }) => {
		const url = request.url();
		const marker = '/_app/remote/';
		const idx = url.indexOf(marker);
		if (idx === -1) {
			return;
		}
		// <hash>/<functionName>[?payload=...]
		names.push(url.slice(idx + marker.length).split('?')[0]!);
	};
	page.on('request', onRequest);
	return {
		names: () => [...names],
		stop: () => page.off('request', onRequest),
	};
}

function countByFunction(names: string[], functionName: string): number {
	return names.filter((name) => name.endsWith(`/${functionName}`)).length;
}

const DASHBOARD_QUERIES = ['getMyWishlists', 'getModeratedWishlists', 'getFollowedWishlists'];

function expectNoDashboardQueries(names: string[]): void {
	for (const dashboardQuery of DASHBOARD_QUERIES) {
		expect(
			countByFunction(names, dashboardQuery),
			`${dashboardQuery} must not be invoked`,
		).toBe(0);
	}
}

test.describe('Request budgets (issue #108)', () => {
	test('wishlist view: at most 3 dynamic requests, no metadata refetch, no dashboards', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('budget-view');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);
		const wishlistPath = await createWishlistAndNavigate(page, 'Budget View');
		await addGift(page, 'Rozpočtový dárek');

		const tracker = trackRemoteRequests(page);
		await page.goto(wishlistPath);
		await expect(page.getByRole('heading', { name: 'Rozpočtový dárek', level: 3 })).toBeVisible(
			{ timeout: 10_000 },
		);
		tracker.stop();

		const names = tracker.names();
		// Gift rows + own likes load client-side; a visit is recorded once for every
		// viewer — owner, moderator or follower (issue #225). Wishlist metadata is
		// server-rendered and must NOT be re-requested by the client.
		expect(names.length, `remote requests: ${names.join(', ')}`).toBeLessThanOrEqual(3);
		expect(countByFunction(names, 'getGiftsByWishlistShortId')).toBe(1);
		expect(countByFunction(names, 'recordWishlistVisit')).toBe(1);
		expect(countByFunction(names, 'getWishlistByShortId')).toBe(0);
		expectNoDashboardQueries(names);

		await page.context().close();
	});

	test('home overview: no hydration overview request or category fallback', async ({
		browser,
		request,
		baseURL,
	}) => {
		const viewer = createTestUser('budget-home');
		const page = await registerAndGetPage(browser, request, baseURL!, viewer);

		const tracker = trackRemoteRequests(page);
		await page.goto('/home');
		await expect(page.getByRole('heading', { name: 'Přehled', level: 1 })).toBeVisible({
			timeout: 10_000,
		});
		tracker.stop();

		const names = tracker.names();
		// The overview is supplied by the server load, so hydration makes no remote query,
		// including the three per-category dashboard fallbacks (issue #225).
		expect(names, `remote requests: ${names.join(', ')}`).toHaveLength(0);

		await page.context().close();
	});

	test('gift creation: exactly 1 dynamic request, list updates via single-flight', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('budget-create');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(page, 'Budget Create');

		// Open the gift dialog first – opening loads priority levels, which is not
		// part of the mutation flow under budget.
		await page
			.getByRole('button', { name: /Přidat (dárek|první přání)/ })
			.first()
			.click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		await dialog.getByRole('textbox', { name: 'Název' }).fill('Jednorázový dárek');

		const tracker = trackRemoteRequests(page);
		await dialog.getByRole('button', { name: 'Přidat dárek' }).click();
		// The new gift renders from the data riding back on the command response.
		await expect(
			page.getByRole('heading', { name: 'Jednorázový dárek', level: 3 }),
		).toBeVisible({ timeout: 10_000 });
		tracker.stop();

		const names = tracker.names();
		expect(names, `remote requests: ${names.join(', ')}`).toHaveLength(1);
		expect(countByFunction(names, 'createGift')).toBe(1);
		// No refresh-then-refetch: the gift list must not be re-fetched separately,
		// and wishlist metadata, likes and dashboards must stay untouched.
		expect(countByFunction(names, 'getGiftsByWishlistShortId')).toBe(0);
		expect(countByFunction(names, 'getWishlistByShortId')).toBe(0);
		expect(countByFunction(names, 'getUserLikesForWishlist')).toBe(0);
		expectNoDashboardQueries(names);

		await page.context().close();
	});

	test('reservation: exactly 1 dynamic request, reserved state via single-flight', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('budget-res-owner');
		const ownerPage = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(ownerPage, 'Budget Reserve');
		await addGift(ownerPage, 'Rezervovaný dárek');
		await shareWishlist(ownerPage);
		const wishlistPath = new URL(ownerPage.url()).pathname;
		await ownerPage.context().close();

		const gifter = createTestUser('budget-res-gifter');
		await registerAndGetPage(browser, request, baseURL!, gifter).then((p) =>
			p.context().close(),
		);
		const gifterCookies = await loginViaApi(request, baseURL!, gifter);
		const gifterContext = await createAuthenticatedContext(browser, gifterCookies, baseURL!);
		const gifterPage = await gifterContext.newPage();

		await gifterPage.goto(wishlistPath);
		const reserve = gifterPage.getByRole('button', { name: /Rezervovat/ }).first();
		await expect(reserve).toBeVisible({ timeout: 10_000 });
		await reserve.click();
		const reserveDialog = gifterPage.getByRole('dialog');
		await expect(reserveDialog).toBeVisible({ timeout: 5_000 });

		const tracker = trackRemoteRequests(gifterPage);
		await reserveDialog.getByRole('button', { name: /Rezervovat/ }).click();
		await expect(reserveDialog).not.toBeVisible({ timeout: 10_000 });
		// Reserved state renders from the single-flight payload, not a follow-up fetch.
		await expect(gifterPage.getByText(/[Rr]ezervov/).first()).toBeVisible({ timeout: 10_000 });
		tracker.stop();

		const names = tracker.names();
		expect(names, `remote requests: ${names.join(', ')}`).toHaveLength(1);
		expect(countByFunction(names, 'reserveGift')).toBe(1);
		expect(countByFunction(names, 'getGiftsByWishlistShortId')).toBe(0);
		expectNoDashboardQueries(names);

		await gifterContext.close();
	});

	test('upload authorization: exactly 1 dynamic request for the whole upload', async ({
		browser,
		request,
		baseURL,
	}) => {
		const owner = createTestUser('budget-upload');
		const page = await registerAndGetPage(browser, request, baseURL!, owner);
		await createWishlistAndNavigate(page, 'Budget Upload');

		await page
			.getByRole('button', { name: /Přidat (dárek|první přání)/ })
			.first()
			.click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 5_000 });
		// Exact match: the upload dropzone exposes an aria-label of "Nahrát obrázek",
		// so a loose /Nahrát/i also matches it — target the upload-mode tab only.
		await dialog.getByRole('button', { name: 'Nahrát', exact: true }).click();
		const fileInput = dialog.locator('input[type=file]');
		await expect(fileInput).toBeAttached();

		const tracker = trackRemoteRequests(page);
		const uploaded = page.waitForResponse(
			(response) => response.url().includes('/api/upload/') && response.status() === 201,
			{ timeout: 15_000 },
		);
		await fileInput.setInputFiles(SAMPLE_IMAGE_PATH);
		await uploaded;
		await expect(dialog.getByTestId('image-upload-preview')).toBeVisible({ timeout: 10_000 });
		tracker.stop();

		const names = tracker.names();
		expect(names, `remote requests: ${names.join(', ')}`).toHaveLength(1);
		expect(countByFunction(names, 'authorizeUpload')).toBe(1);

		await page.context().close();
	});
});
