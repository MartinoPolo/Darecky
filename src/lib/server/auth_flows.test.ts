import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import type { createAuth as createAuthFunction } from './auth.js';
import * as authSchema from './db/auth.schema.js';

const fixtures = vi.hoisted(() => ({
	database: {} as Record<string, Record<string, unknown>[]>,
	emails: [] as { actionUrl?: string }[],
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		AUTH_SECRET: 'local-only-auth-regression-secret-not-for-production',
		ORIGIN: 'http://localhost:8300',
	},
}));
vi.mock('./db/index.js', () => ({ getDb: () => ({}) }));
vi.mock('better-auth/adapters/drizzle', async () => {
	const { memoryAdapter } = await import('better-auth/adapters/memory');
	return { drizzleAdapter: () => memoryAdapter(fixtures.database) };
});
vi.mock('better-auth/plugins', () => ({ captcha: () => ({ id: 'test-captcha' }) }));
vi.mock('better-auth/svelte-kit', () => ({
	sveltekitCookies: () => ({ id: 'test-cookie-bridge' }),
}));
vi.mock('./email.js', () => ({
	sendEmail: async (email: { actionUrl?: string }) => {
		fixtures.emails.push(email);
	},
	renderActionEmailParts: () => ({}),
}));

let createAuth: typeof createAuthFunction;

beforeAll(async () => {
	vi.stubEnv('DEV', false);
	// Keep production email verification without throttling this local regression sequence.
	vi.stubEnv('PROD', false);
	({ createAuth } = await import('./auth.js'));
}, 30_000);
afterAll(() => vi.unstubAllEnvs());
beforeEach(() => {
	for (const key of ['user', 'account', 'session', 'verification', 'rateLimit']) {
		fixtures.database[key] = [];
	}
	fixtures.emails.length = 0;
});

function latestEmailUrl() {
	const url = fixtures.emails.at(-1)?.actionUrl;
	if (url === undefined) {
		throw new Error('Expected an authentication email');
	}
	return url;
}

function request(path: string, body?: Record<string, unknown>, cookie?: string) {
	return new Request(new URL(path, 'http://localhost:8300'), {
		method: body === undefined ? 'GET' : 'POST',
		headers: {
			Origin: 'http://localhost:8300',
			'Content-Type': 'application/json',
			...(cookie === undefined ? {} : { Cookie: cookie }),
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}

function responseCookies(response: Response) {
	return response.headers
		.getSetCookie()
		.map((cookie) => cookie.split(';')[0])
		.join('; ');
}

describe('production authentication flows', () => {
	it('has existing database columns for every configured core auth field', async () => {
		const { tables } = await createAuth().$context;
		for (const model of ['user', 'session', 'account', 'verification'] as const) {
			const columns = getTableColumns(authSchema[model]);
			for (const field of Object.keys(tables[model].fields)) {
				expect(columns, `${model}.${field}`).toHaveProperty(field);
			}
		}
	});

	it('does not expose magic-link issuance or redemption', async () => {
		const auth = createAuth();
		for (const removedRequest of [
			request('/api/auth/sign-in/magic-link', {
				email: 'owner@example.test',
				callbackURL: '/home',
			}),
			request('/api/auth/magic-link/verify?token=previously-issued-token&callbackURL=/home'),
		]) {
			const response = await auth.handler(removedRequest);
			expect(response.status).toBe(404);
			expect(response.headers.getSetCookie()).toEqual([]);
		}
		expect(fixtures.emails).toEqual([]);
		expect(fixtures.database.user).toEqual([]);
		expect(fixtures.database.session).toEqual([]);
	});

	it.each([
		{ accountType: 'password', hasPassword: true },
		{ accountType: 'legacy passwordless', hasPassword: false },
	])('verifies email and recovers a $accountType account', async ({ hasPassword }) => {
		const auth = createAuth();
		const credentials = { email: 'owner@example.test', password: 'original-owner-password' };
		const registration = await auth.handler(
			request('/api/auth/sign-up/email', { ...credentials, name: 'Verified owner' }),
		);
		expect(registration.status).toBe(200);
		expect(fixtures.database.user[0].emailVerified).toBe(false);
		expect((await auth.handler(request('/api/auth/sign-in/email', credentials))).status).toBe(
			403,
		);
		const verification = await auth.handler(request(latestEmailUrl()));
		expect(verification.status).toBeLessThan(400);
		expect(fixtures.database.user[0].emailVerified).toBe(true);
		const signIn = await auth.handler(request('/api/auth/sign-in/email', credentials));
		expect(signIn.status).toBe(200);
		const session = await auth.handler(
			request('/api/auth/get-session', undefined, responseCookies(signIn)),
		);
		expect(await session.json()).toMatchObject({
			user: { email: credentials.email, emailVerified: true },
		});

		const originalUserId = fixtures.database.user[0].id;
		if (!hasPassword) {
			// A legacy magic-link-only account has no password credential.
			fixtures.database.account = [];
		}

		expect(
			(
				await auth.handler(
					request('/api/auth/request-password-reset', {
						email: credentials.email,
						redirectTo: '/reset-password',
					}),
				)
			).status,
		).toBe(200);
		const resetRedirect = await auth.handler(request(latestEmailUrl()));
		const resetUrl = new URL(resetRedirect.headers.get('location')!, 'http://localhost:8300');
		const newPassword = 'replacement-owner-password';
		expect(
			(
				await auth.handler(
					request('/api/auth/reset-password', {
						token: resetUrl.searchParams.get('token'),
						newPassword,
					}),
				)
			).status,
		).toBe(200);
		expect((await auth.handler(request('/api/auth/sign-in/email', credentials))).status).toBe(
			401,
		);
		expect(
			(
				await auth.handler(
					request('/api/auth/sign-in/email', {
						email: credentials.email,
						password: newPassword,
					}),
				)
			).status,
		).toBe(200);
		expect(fixtures.database.user).toHaveLength(1);
		expect(fixtures.database.user[0].id).toBe(originalUserId);
	});
});
