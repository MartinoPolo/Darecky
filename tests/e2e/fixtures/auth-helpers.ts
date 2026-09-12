import { expect } from '@playwright/test';
import type {
	Page,
	BrowserContext,
	Browser,
	APIRequestContext,
	APIResponse,
} from '@playwright/test';

interface TestUser {
	name: string;
	email: string;
	password: string;
}

const AUTH_REQUEST_ATTEMPTS = 3;
const TURNSTILE_TEST_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

export async function waitForAppHydration(
	page: Page,
	options: { timeout?: number } = {},
): Promise<void> {
	await expect(page.locator('html')).toHaveAttribute('data-app-hydrated', 'true', options);
}

function isTransientConnectionReset(error: unknown): boolean {
	return error instanceof Error && /ECONNRESET|socket hang up/i.test(error.message);
}

async function postAuthRequest(
	request: APIRequestContext,
	baseURL: string,
	path: string,
	data: Record<string, string>,
): Promise<{ response: APIResponse; recoveredFromReset: boolean }> {
	let recoveredFromReset = false;

	for (let attempt = 1; attempt <= AUTH_REQUEST_ATTEMPTS; attempt += 1) {
		try {
			return {
				response: await request.post(`${baseURL}${path}`, {
					// better-auth rejects state-changing requests without an Origin header
					// (MISSING_OR_NULL_ORIGIN); Playwright's APIRequestContext omits it by default.
					headers: { Origin: baseURL, 'x-captcha-response': TURNSTILE_TEST_TOKEN },
					data,
				}),
				recoveredFromReset,
			};
		} catch (error) {
			if (!isTransientConnectionReset(error) || attempt === AUTH_REQUEST_ATTEMPTS) {
				throw error;
			}
			recoveredFromReset = true;
			await new Promise((resolve) => setTimeout(resolve, attempt * 250));
		}
	}

	throw new Error('Unreachable auth request retry state');
}

function sessionCookies(response: APIResponse, operation: string): string[] {
	const cookies = response
		.headersArray()
		.filter((header) => header.name === 'set-cookie')
		.map((header) => header.value);
	if (cookies.length === 0) {
		throw new Error(`No session cookie returned from ${operation}`);
	}
	return cookies;
}

export async function registerViaApi(
	request: APIRequestContext,
	baseURL: string,
	user: TestUser,
): Promise<string[]> {
	const registration = await postAuthRequest(request, baseURL, '/api/auth/sign-up/email', {
		name: user.name,
		email: user.email,
		password: user.password,
	});
	let response = registration.response;

	if (!response.ok() && registration.recoveredFromReset) {
		// A reset may happen after the server committed the user but before Playwright read
		// the response. In that case a repeated sign-up correctly reports "already exists";
		// recover the session by signing in instead of treating the committed request as a
		// failed fixture setup.
		const recovery = await postAuthRequest(request, baseURL, '/api/auth/sign-in/email', {
			email: user.email,
			password: user.password,
		});
		if (recovery.response.ok()) {
			response = recovery.response;
		}
	}

	if (!response.ok()) {
		const body = await response.text();
		throw new Error(`Registration failed (${response.status()}): ${body}`);
	}

	return sessionCookies(response, 'registration');
}

export async function loginViaApi(
	request: APIRequestContext,
	baseURL: string,
	user: Pick<TestUser, 'email' | 'password'>,
): Promise<string[]> {
	const { response } = await postAuthRequest(request, baseURL, '/api/auth/sign-in/email', {
		email: user.email,
		password: user.password,
	});

	if (!response.ok()) {
		const body = await response.text();
		throw new Error(`Login failed (${response.status()}): ${body}`);
	}

	return sessionCookies(response, 'login');
}

export function parseCookiesForContext(rawCookies: string[], baseURL: string) {
	const url = new URL(baseURL);
	return rawCookies.map((raw) => {
		const [nameValue] = raw.split(';');
		const eqIdx = nameValue!.indexOf('=');
		return {
			name: nameValue!.slice(0, eqIdx).trim(),
			value: decodeURIComponent(nameValue!.slice(eqIdx + 1).trim()),
			domain: url.hostname,
			path: '/',
		};
	});
}

export async function createAuthenticatedContext(
	browser: Browser,
	rawCookies: string[],
	baseURL: string,
): Promise<BrowserContext> {
	const cookies = parseCookiesForContext(rawCookies, baseURL);
	const context = await browser.newContext();
	await context.addCookies(cookies);
	return context;
}

export async function registerAndGetPage(
	browser: Browser,
	request: APIRequestContext,
	baseURL: string,
	user: TestUser,
): Promise<Page> {
	const cookies = await registerViaApi(request, baseURL, user);
	const context = await createAuthenticatedContext(browser, cookies, baseURL);
	return context.newPage();
}
