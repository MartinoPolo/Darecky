import { test, expect } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import {
	registerViaApi,
	createAuthenticatedContext,
	waitForAppHydration,
} from './fixtures/auth-helpers.js';

// Cold compilation needs a larger budget than navigation in the warmed application.
test.use({ navigationTimeout: 90_000 });
test.setTimeout(180_000);

// Warms Vite's on-demand dev compilation for the primary routes so the real suites
// don't each eat the first-hit transform cost.
//
// Deliberately NOT using `waitForLoadState('networkidle')`: a cold SvelteKit dev
// page streams hundreds of on-demand module-transform requests (`/_app/...`,
// `/node_modules/.vite/...`) plus the dashboard's remote queries, and rarely gets
// the 500ms of network quiet `networkidle` requires within the timeout – so the
// warmup would time out even though the route compiled fine. `goto`'s default
// 'load' wait already forces each route's server modules to compile; a deterministic
// content assertion then proves the rendered output is ready.
test('warmup: compile all route modules', async ({ page, request, browser, baseURL }) => {
	if (baseURL == null) {
		throw new Error('baseURL must be configured in playwright.config.ts');
	}

	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await waitForAppHydration(page, { timeout: 45_000 });
	await page.goto('/register');
	await expect(
		page.getByRole('heading', { name: /Vytvořte si účet|Create an account/ }),
	).toBeVisible();
	await waitForAppHydration(page, { timeout: 45_000 });
	await page.goto('/login');
	await expect(page.getByRole('heading', { name: /Přihlašte se|Log in/ })).toBeVisible();
	await waitForAppHydration(page, { timeout: 45_000 });

	const user = createTestUser('warmup');
	const cookies = await registerViaApi(request, baseURL, user);
	const ctx = await createAuthenticatedContext(browser, cookies, baseURL);
	try {
		const authPage = await ctx.newPage();

		await authPage.goto('/my-lists');
		// Generous timeout: the first cold compile of the authenticated shell (Navbar +
		// dashboard + gift/bits-ui component trees) can far exceed the default expect
		// timeout. Locale-agnostic: the app serves cs at `/` and en at `/en` (base locale
		// en), so a fresh context's default locale can be either – match both.
		await expect(authPage.getByRole('heading', { name: /Moje seznamy|My lists/ })).toBeVisible({
			timeout: 45_000,
		});
		await waitForAppHydration(authPage, { timeout: 45_000 });
	} finally {
		await ctx.close();
	}
});
