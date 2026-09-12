import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
	loginViaApi,
	createAuthenticatedContext,
	registerAndGetPage,
} from './fixtures/auth-helpers';
import { createTestUser } from './fixtures/test-data';

/**
 * Přehled overview at /home (issue #225).
 *
 * Personas come from the seed (`pnpm db:seed`, shared password below): Martin owns lists,
 * moderates for-someone lists and follows others, so his overview exercises all four rows.
 * Fresh users are registered per test for the empty-state and visit-tracking flows.
 */

const SEED_PASSWORD = 'password123';
const MARTIN = { email: 'martin@test.cz', password: SEED_PASSWORD };

async function signInAs(
	browser: Browser,
	request: APIRequestContext,
	baseURL: string,
	user: { email: string; password: string },
): Promise<Page> {
	const cookies = await loginViaApi(request, baseURL, user);
	const context = await createAuthenticatedContext(browser, cookies, baseURL);
	return context.newPage();
}

/** The shelf (carousel row) whose heading matches `title`. */
function shelf(page: Page, title: string) {
	return page
		.getByTestId('home-shelf')
		.filter({ has: page.getByRole('heading', { name: title, level: 2 }) });
}

test.describe('Home overview (issue #225)', () => {
	test('a signed-in user landing on `/` is redirected to the overview', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await signInAs(browser, request, baseURL!, MARTIN);

		await page.goto('/');

		await expect(page).toHaveURL(/\/home\/?$/);
		await expect(page.getByRole('heading', { name: 'Přehled', level: 1 })).toBeVisible({
			timeout: 10_000,
		});

		await page.context().close();
	});

	test('renders all four category rows for a multi-role user', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await signInAs(browser, request, baseURL!, MARTIN);

		await page.goto('/home');
		await expect(page.getByRole('heading', { name: 'Přehled', level: 1 })).toBeVisible({
			timeout: 10_000,
		});

		for (const title of ['Nedávné', 'Sledované', 'Spravované', 'Moje seznamy']) {
			await expect(shelf(page, title), `the „${title}" row should be present`).toHaveCount(1);
		}

		await page.context().close();
	});

	test('a category row links through to its full page', async ({ browser, request, baseURL }) => {
		const page = await signInAs(browser, request, baseURL!, MARTIN);

		await page.goto('/home');
		const followed = shelf(page, 'Sledované');
		await expect(followed).toHaveCount(1);

		await followed.getByTestId('shelf-view-all-link').click();

		await expect(page).toHaveURL(/\/followed\/?$/);

		await page.context().close();
	});

	test('the Nedávné row is capped at six cards and carries no view-all card', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await signInAs(browser, request, baseURL!, MARTIN);

		await page.goto('/home');
		const recent = shelf(page, 'Nedávné');
		await expect(recent).toHaveCount(1);

		const cardCount = await recent.getByTestId('wishlist-card').count();
		expect(cardCount).toBeLessThanOrEqual(6);
		await expect(recent.getByTestId('view-all-card')).toHaveCount(0);

		await page.context().close();
	});

	test('a new user with no lists sees the onboarding hero instead of rows', async ({
		browser,
		request,
		baseURL,
	}) => {
		const newcomer = createTestUser('home-empty');
		const page = await registerAndGetPage(browser, request, baseURL!, newcomer);

		await page.goto('/home');
		await expect(page.getByRole('heading', { name: 'Vytvořte první seznam' })).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByTestId('home-shelf')).toHaveCount(0);

		await page.context().close();
	});

	test('Next moves a visible wishlist card and enables Previous', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await signInAs(browser, request, baseURL!, MARTIN);
		await page.setViewportSize({ width: 390, height: 844 });

		await page.goto('/home');
		await expect(page.getByRole('heading', { name: 'Přehled', level: 1 })).toBeVisible({
			timeout: 10_000,
		});

		const overflowingRow = page
			.getByTestId('home-shelf')
			.filter({ has: page.getByRole('button', { name: 'Další' }) })
			.first();
		await expect(overflowingRow).toHaveCount(1);

		const viewport = overflowingRow.locator("[data-slot='carousel-content']");
		const visibleCard = overflowingRow.locator('[data-testid="wishlist-card"]:visible').first();
		await expect(visibleCard).toBeVisible();
		const cardName = await visibleCard.getAttribute('aria-label');
		expect(cardName).toBeTruthy();
		const namedCard = overflowingRow.getByLabel(cardName!, { exact: true });
		const viewportBox = await viewport.boundingBox();
		const cardBox = await namedCard.boundingBox();
		expect(viewportBox).not.toBeNull();
		expect(cardBox).not.toBeNull();
		expect(cardBox!.x + cardBox!.width).toBeGreaterThan(viewportBox!.x);
		expect(cardBox!.x).toBeLessThan(viewportBox!.x + viewportBox!.width);
		const initialOffset = cardBox!.x - viewportBox!.x;

		await overflowingRow.getByRole('button', { name: 'Další' }).click();

		await expect
			.poll(async () => {
				const currentCardBox = await namedCard.boundingBox();
				const currentViewportBox = await viewport.boundingBox();
				return currentCardBox!.x - currentViewportBox!.x;
			})
			.toBeLessThan(initialOffset);
		await expect(overflowingRow.getByRole('button', { name: 'Předchozí' })).toBeEnabled();

		await page.context().close();
	});

	test('an overflowing shelf shows the right-edge fade until scrolled to the end', async ({
		browser,
		request,
		baseURL,
	}) => {
		const page = await signInAs(browser, request, baseURL!, MARTIN);

		await page.goto('/home');
		await expect(page.getByRole('heading', { name: 'Přehled', level: 1 })).toBeVisible({
			timeout: 10_000,
		});

		const rows = page.getByTestId('home-shelf');
		const overflowingRow = rows
			.filter({ has: page.getByRole('button', { name: 'Další' }) })
			.first();
		await expect(overflowingRow).toHaveCount(1);

		// Fade present at the start (more cards exist to the right).
		await expect(overflowingRow).toHaveAttribute('data-can-scroll-next', 'true');

		// Click Next until the end; the fade clears once nothing more can scroll right.
		const next = overflowingRow.getByRole('button', { name: 'Další' });
		for (let clicks = 0; clicks < 20; clicks++) {
			if ((await overflowingRow.getAttribute('data-can-scroll-next')) === 'false') {
				break;
			}
			if (await next.isDisabled()) {
				break;
			}
			// The free-scroll boundary can disable Next between the guard and Playwright's
			// actionability check. A native click is a no-op if that boundary was reached.
			await next.evaluate((button) => {
				if (button instanceof HTMLButtonElement) {
					button.click();
				}
			});
			await page.waitForTimeout(150);
		}

		await expect(overflowingRow).toHaveAttribute('data-can-scroll-next', 'false', {
			timeout: 8_000,
		});
		await expect(next).toBeDisabled();

		await page.context().close();
	});

	test('opening a wishlist records a visit that surfaces in Nedávné', async ({
		browser,
		request,
		baseURL,
	}) => {
		const gifter = createTestUser('home-visit');
		const page = await registerAndGetPage(browser, request, baseURL!, gifter);

		// The visit is fire-and-forget in the page's onMount, so wait for its remote response
		// before navigating on, otherwise the /home SSR query can race ahead of the write.
		const visitRecorded = page.waitForResponse(
			(response) => response.url().includes('recordWishlistVisit') && response.ok(),
			{ timeout: 15_000 },
		);
		await page.goto('/w/xmas2026');
		await expect(page.getByRole('heading', { name: 'Vánoce 2026' }).first()).toBeVisible({
			timeout: 10_000,
		});
		await visitRecorded;

		await page.goto('/home');
		const recent = shelf(page, 'Nedávné');
		await expect(recent).toHaveCount(1);
		await expect(recent.getByText('Vánoce 2026').first()).toBeVisible({ timeout: 10_000 });

		await page.context().close();
	});
});
