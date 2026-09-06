import { describe, expect, it } from 'vitest';
import { AUTH_CAPTCHA_ENDPOINTS, AUTH_IP_ADDRESS_HEADERS, authRateLimit } from './auth_security.js';

describe('BetterAuth security configuration', () => {
	it('gates every email authentication entry point with Turnstile', () => {
		expect(AUTH_CAPTCHA_ENDPOINTS).toEqual([
			'/sign-up/email',
			'/sign-in/email',
			'/request-password-reset',
		]);
	});

	it('enables the Worker-compatible built-in limiter in production', () => {
		expect(authRateLimit(true)).toEqual({ enabled: true });
	});

	it('disables the built-in limiter for deterministic local development and E2E', () => {
		expect(authRateLimit(false)).toEqual({ enabled: false });
	});

	it('uses only Cloudflare trusted client IP and ignores forwarding headers', () => {
		expect(AUTH_IP_ADDRESS_HEADERS).toEqual(['cf-connecting-ip']);
		expect(AUTH_IP_ADDRESS_HEADERS).not.toContain('x-forwarded-for');
	});
});
