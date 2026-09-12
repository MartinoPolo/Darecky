import { test, expect, type Page } from '@playwright/test';
import { createTestUser } from './fixtures/test-data.js';
import { registerViaApi, registerAndGetPage } from './fixtures/auth-helpers.js';

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

test.describe('Authentication', () => {
	test('register with valid credentials redirects to my-lists', async ({
		browser,
		request,
		baseURL,
	}) => {
		const user = createTestUser('register');
		const page = await registerAndGetPage(browser, request, baseURL!, user);
		await page.goto('/my-lists');
		await expect(page.getByRole('heading', { name: 'Moje seznamy' })).toBeVisible({
			timeout: 10_000,
		});
		await page.context().close();
	});

	test('login with valid credentials', async ({ page, request, baseURL }) => {
		const user = createTestUser('login');
		await registerViaApi(request, baseURL!, user);

		await installTurnstileMock(page);
		await page.goto('/login');
		const loginButton = page.getByRole('button', { name: 'Přihlásit se', exact: true });
		await expect(loginButton).toBeEnabled();
		await page.getByRole('textbox', { name: 'E-mail' }).fill(user.email);
		await page.getByRole('textbox', { name: 'Heslo' }).fill(user.password);
		await loginButton.click();

		// Post-login default redirect now lands on the „Přehled" overview at /home (issue #225),
		// no longer /my-lists.
		await expect(page).toHaveURL(/\/home\/?$/);
		await expect(page.getByRole('heading', { name: 'Přehled', level: 1 })).toBeVisible({
			timeout: 10_000,
		});
	});

	test('login with invalid credentials shows error', async ({ page }) => {
		await installTurnstileMock(page);
		await page.goto('/login');
		const loginButton = page.getByRole('button', { name: 'Přihlásit se', exact: true });
		await expect(loginButton).toBeEnabled();
		await page.getByRole('textbox', { name: 'E-mail' }).fill('nonexistent@test.cz');
		await page.getByRole('textbox', { name: 'Heslo' }).fill('wrongpassword123');
		await loginButton.click();

		await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
	});

	test('unauthenticated user redirected from app routes to login', async ({ page }) => {
		await page.goto('/my-lists');
		await expect(page).toHaveURL(/\/login/);
	});

	test('register page shows password strength indicator', async ({ page }) => {
		await page.goto('/register');
		await page.getByRole('textbox', { name: 'Heslo' }).fill('abcdefgh');
		await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 5_000 });
	});

	test('magic-link sign-in is unavailable in either locale', async ({ page }) => {
		for (const localePrefix of ['', '/en']) {
			await page.goto(`${localePrefix}/login`);
			await expect(page.getByTestId('google-login')).toBeVisible();
			await expect(page.locator('#login-password')).toBeVisible();
			await expect(page.locator('a[href*="magic-link"]')).toHaveCount(0);
			const response = await page.goto(`${localePrefix}/magic-link`);
			expect(response?.status()).toBe(404);
		}
	});

	for (const protectedRequest of [
		{
			name: 'password sign-in',
			path: '/api/auth/sign-in/email',
			data: { email: 'turnstile-login@test.cz', password: 'password123' },
		},
		{
			name: 'registration',
			path: '/api/auth/sign-up/email',
			data: {
				name: 'Turnstile Test',
				email: 'turnstile-register@test.cz',
				password: 'password123',
			},
		},
		{
			name: 'password reset request',
			path: '/api/auth/request-password-reset',
			data: { email: 'turnstile-reset@test.cz', redirectTo: '/reset-password' },
		},
	] as const) {
		test(`${protectedRequest.name} rejects a missing Turnstile token`, async ({
			request,
			baseURL,
		}) => {
			const response = await request.post(`${baseURL}${protectedRequest.path}`, {
				headers: { Origin: baseURL! },
				data: protectedRequest.data,
			});

			expect(response.status()).toBe(400);
			expect(await response.text()).toContain('Missing CAPTCHA response');
		});
	}
});
