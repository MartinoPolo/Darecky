import { describe, expect, it, vi } from 'vitest';
import { verifyTurnstileToken } from './turnstile.js';

const secretKey = 'test-secret';

function response(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

describe('verifyTurnstileToken', () => {
	it('rejects a missing token', async () => {
		expect(
			await verifyTurnstileToken({ token: undefined, secretKey, fetcher: vi.fn() }),
		).toEqual({ success: false, reason: 'missing' });
	});

	it('rejects an invalid token', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(
				response({ success: false, 'error-codes': ['invalid-input-response'] }),
			);
		expect(await verifyTurnstileToken({ token: 'invalid', secretKey, fetcher })).toEqual({
			success: false,
			reason: 'invalid',
		});
	});

	it('rejects an overlong token without calling Siteverify', async () => {
		const fetcher = vi.fn();
		expect(
			await verifyTurnstileToken({ token: 'x'.repeat(2_049), secretKey, fetcher }),
		).toEqual({ success: false, reason: 'invalid' });
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('accepts a token at the documented maximum length', async () => {
		const fetcher = vi.fn().mockResolvedValue(response({ success: true }));
		expect(
			await verifyTurnstileToken({ token: 'x'.repeat(2_048), secretKey, fetcher }),
		).toEqual({ success: true });
		expect(fetcher).toHaveBeenCalledOnce();
	});

	it('classifies expired or replayed tokens', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(
				response({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
			);
		expect(await verifyTurnstileToken({ token: 'used', secretKey, fetcher })).toEqual({
			success: false,
			reason: 'expired_or_replayed',
		});
	});

	it.each(['missing-input-secret', 'invalid-input-secret', 'bad-request'])(
		'classifies %s as a configuration failure',
		async (errorCode) => {
			const fetcher = vi
				.fn()
				.mockResolvedValue(response({ success: false, 'error-codes': [errorCode] }));
			expect(await verifyTurnstileToken({ token: 'valid', secretKey, fetcher })).toEqual({
				success: false,
				reason: 'configuration',
			});
		},
	);

	it('classifies an internal Siteverify error as unavailable', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(response({ success: false, 'error-codes': ['internal-error'] }));
		expect(await verifyTurnstileToken({ token: 'valid', secretKey, fetcher })).toEqual({
			success: false,
			reason: 'unavailable',
		});
	});

	it('classifies a network failure as unavailable for caller fail-open handling', async () => {
		const fetcher = vi.fn().mockRejectedValue(new TypeError('network unavailable'));
		expect(await verifyTurnstileToken({ token: 'valid', secretKey, fetcher })).toEqual({
			success: false,
			reason: 'unavailable',
		});
	});

	it('classifies a non-2xx response as unavailable', async () => {
		const fetcher = vi.fn().mockResolvedValue(response({}, 503));
		expect(await verifyTurnstileToken({ token: 'valid', secretKey, fetcher })).toEqual({
			success: false,
			reason: 'unavailable',
		});
	});

	it('classifies malformed JSON as unavailable', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response('{not json'));
		expect(await verifyTurnstileToken({ token: 'valid', secretKey, fetcher })).toEqual({
			success: false,
			reason: 'unavailable',
		});
	});

	it('classifies a valid but unusable response shape as unavailable', async () => {
		const fetcher = vi.fn().mockResolvedValue(response([]));
		expect(await verifyTurnstileToken({ token: 'valid', secretKey, fetcher })).toEqual({
			success: false,
			reason: 'unavailable',
		});
	});

	it('aborts a verification request after the bounded timeout', async () => {
		vi.useFakeTimers();
		try {
			const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
				return new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () =>
						reject(new DOMException('Aborted', 'AbortError')),
					);
				});
			});
			const verification = verifyTurnstileToken({
				token: 'valid',
				secretKey,
				fetcher,
				timeoutMs: 25,
			});
			await vi.advanceTimersByTimeAsync(25);
			await expect(verification).resolves.toEqual({ success: false, reason: 'unavailable' });
			expect(fetcher.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
		} finally {
			vi.useRealTimers();
		}
	});

	it('accepts a successful Siteverify response', async () => {
		const fetcher = vi.fn().mockResolvedValue(response({ success: true }));
		expect(await verifyTurnstileToken({ token: 'valid', secretKey, fetcher })).toEqual({
			success: true,
		});
		expect(fetcher).toHaveBeenCalledWith(
			'https://challenges.cloudflare.com/turnstile/v0/siteverify',
			expect.objectContaining({
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ secret: secretKey, response: 'valid' }),
				signal: expect.any(AbortSignal),
			}),
		);
	});

	it('classifies missing production configuration for caller fail-open handling', async () => {
		expect(
			await verifyTurnstileToken({
				token: 'valid',
				secretKey: undefined,
				fetcher: vi.fn(),
				isDevelopment: false,
			}),
		).toEqual({ success: false, reason: 'configuration' });
	});
});
