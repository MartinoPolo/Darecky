import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Suppress SvelteKit's remote-function validator injected by the Vite transform
vi.mock('@sveltejs/kit/internal', () => ({
	init_remote_functions: vi.fn(),
}));

// ── Mock $app/server to prevent SvelteKit remote-function validation ─────────
vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(),
	query: vi.fn((...args: unknown[]) => {
		const callback = args.length === 1 ? args[0] : args[1];
		return callback;
	}),
	command: vi.fn((...args: unknown[]) => {
		const callback = args.length === 1 ? args[0] : args[1];
		return callback;
	}),
}));

// ── Mock remote wrappers – extract handlers directly ────────────────────────
function wrapWithRemoteMarker(
	handler: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
	(handler as unknown as Record<string, unknown>).__ = {};
	return handler;
}

vi.mock('$lib/server/remote.js', () => ({
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		wrapWithRemoteMarker(handler),
	),
}));

// ── Mock SvelteKit error so it throws with a .status property ───────────────
vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}),
}));

vi.mock('$lib/server/db/id.js', () => ({
	generateId: vi.fn(() => 'test-id-123'),
}));

// Statement-budget tripwire (issue #108, REQ-7): upload authorization must issue
// ZERO database statements. If uploads.remote.ts ever starts using the db, every
// test in this suite fails loudly instead of silently blowing the budget.
vi.mock('$lib/server/db/index.js', () => ({
	getDb: vi.fn(() => {
		throw new Error(
			'authorizeUpload must not touch the database (issue #108: 0-statement budget)',
		);
	}),
}));

vi.mock('$env/dynamic/private', () => ({
	env: { AUTH_SECRET: 'test-auth-secret-for-hmac' },
}));

// ── Presign mock: null → proxy fallback; set a URL to exercise presigned mode ─
const { mockPresignUploadUrl } = vi.hoisted(() => ({
	mockPresignUploadUrl: vi.fn<(input: unknown) => Promise<string | null>>(() =>
		Promise.resolve(null),
	),
}));

vi.mock('$lib/server/storage/presign.js', () => ({
	presignUploadUrl: mockPresignUploadUrl,
	PRESIGNED_UPLOAD_EXPIRY_SECONDS: 600,
}));

vi.mock('$lib/server/storage/r2.js', async () => {
	const types = await import('./types.js');
	return {
		UPLOAD_TARGETS: {
			'gift-image': 'gifts',
			'wishlist-banner': 'wishlists/banners',
			'wishlist-thumbnail': 'wishlists/thumbnails',
			avatar: 'avatars',
		} as Record<string, string>,
		MAX_FILE_SIZE: {
			'gift-image': 5 * 1024 * 1024,
			'wishlist-banner': 10 * 1024 * 1024,
			'wishlist-thumbnail': 5 * 1024 * 1024,
			avatar: 5 * 1024 * 1024,
		} as Record<string, number>,
		isAllowedContentType: types.isAllowedContentType,
		getPublicUrl: vi.fn((objectKey: string) => `https://cdn.example.com/${objectKey}`),
	};
});

import { authorizeUpload } from './uploads.remote.js';
import type { UploadAuthorization } from './types.js';

// ── Typed handler aliases ───────────────────────────────────────────────────
const fakeAuthContext = { user: { id: 'test-user' }, session: {} };

const callAuthorizeUpload = async (input: {
	target: string;
	fileName: string;
	contentType: string;
	fileSize: number;
}): Promise<UploadAuthorization> => {
	return (authorizeUpload as unknown as (...args: unknown[]) => Promise<unknown>)(
		fakeAuthContext,
		input,
	) as Promise<UploadAuthorization>;
};

beforeEach(() => {
	vi.clearAllMocks();
	mockPresignUploadUrl.mockResolvedValue(null);
});

describe('authorizeUpload', () => {
	// ── Valid uploads for all targets ──────────────────────────────────────────

	describe('valid uploads for all targets', () => {
		it.each([
			{ target: 'gift-image', prefix: 'gifts', contentType: 'image/jpeg', extension: 'jpg' },
			{
				target: 'wishlist-banner',
				prefix: 'wishlists/banners',
				contentType: 'image/png',
				extension: 'png',
			},
			{
				target: 'wishlist-thumbnail',
				prefix: 'wishlists/thumbnails',
				contentType: 'image/webp',
				extension: 'webp',
			},
		])(
			'$target returns objectKey with $prefix/ prefix',
			async ({ target, prefix, contentType, extension }) => {
				const result = await callAuthorizeUpload({
					target,
					fileName: `photo.${extension}`,
					contentType,
					fileSize: 1024 * 1024,
				});

				expect(result.objectKey).toBe(`${prefix}/test-id-123.${extension}`);
				expect(result.uploadMode).toBe('proxy');
				expect(result.uploadUrl).toMatch(/^\/api\/upload\//);
				expect(result.publicUrl).toContain(result.objectKey);
				expect(result.uploadToken).toBeTypeOf('string');
				expect(result.uploadToken).toContain('.');
				expect(result.deleteToken).toBeTypeOf('string');
				expect(result.deleteToken).toContain('.');
				expect(result.expiresAt).toBeTypeOf('number');
				expect(result.expiresAt).toBeGreaterThan(Date.now());
			},
		);
	});

	// ── Presigned mode (REQ-1) ───────────────────────────────────────────────

	describe('presigned mode', () => {
		it('returns the presigned URL with no proxy token when presigning is configured', async () => {
			mockPresignUploadUrl.mockResolvedValue(
				'https://account.r2.cloudflarestorage.com/bucket/gifts/test-id-123.jpg?X-Amz-Signature=abc',
			);

			const result = await callAuthorizeUpload({
				target: 'gift-image',
				fileName: 'photo.jpg',
				contentType: 'image/jpeg',
				fileSize: 1024,
			});

			expect(result.uploadMode).toBe('presigned');
			expect(result.uploadUrl).toContain('r2.cloudflarestorage.com');
			expect(result.uploadToken).toBeNull();
			expect(result.deleteToken).toBeTypeOf('string');
			expect(mockPresignUploadUrl).toHaveBeenCalledWith({
				objectKey: 'gifts/test-id-123.jpg',
				contentType: 'image/jpeg',
				contentLength: 1024,
			});
		});

		it('validation still rejects an oversized file before presigning', async () => {
			mockPresignUploadUrl.mockResolvedValue('https://presigned.example.com/');

			await expect(
				callAuthorizeUpload({
					target: 'gift-image',
					fileName: 'big.jpg',
					contentType: 'image/jpeg',
					fileSize: 5 * 1024 * 1024 + 1,
				}),
			).rejects.toThrow(expect.objectContaining({ status: 400 }));
			expect(mockPresignUploadUrl).not.toHaveBeenCalled();
		});
	});

	// ── Invalid target ───────────────────────────────────────────────────────

	describe('invalid target', () => {
		it('throws 400 for unknown target', async () => {
			await expect(
				callAuthorizeUpload({
					target: 'unknown-target',
					fileName: 'file.jpg',
					contentType: 'image/jpeg',
					fileSize: 1024,
				}),
			).rejects.toThrow(
				expect.objectContaining({
					status: 400,
					message: expect.stringContaining('Invalid upload target'),
				}),
			);
		});
	});

	// ── Content type validation ──────────────────────────────────────────────

	describe('content type validation', () => {
		it.each(['application/pdf', 'text/html', 'image/svg+xml', 'video/mp4'])(
			'rejects %s',
			async (contentType) => {
				await expect(
					callAuthorizeUpload({
						target: 'gift-image',
						fileName: 'file',
						contentType,
						fileSize: 1024,
					}),
				).rejects.toThrow(
					expect.objectContaining({
						status: 400,
						message: expect.stringContaining('Invalid content type'),
					}),
				);
			},
		);

		it.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])(
			'accepts %s',
			async (contentType) => {
				await expect(
					callAuthorizeUpload({
						target: 'gift-image',
						fileName: 'file',
						contentType,
						fileSize: 1024,
					}),
				).resolves.toBeTruthy();
			},
		);
	});

	// ── File size validation ─────────────────────────────────────────────────

	describe('file size validation', () => {
		it('rejects 0 bytes', async () => {
			await expect(
				callAuthorizeUpload({
					target: 'gift-image',
					fileName: 'file.jpg',
					contentType: 'image/jpeg',
					fileSize: 0,
				}),
			).rejects.toThrow(
				expect.objectContaining({
					status: 400,
					message: 'File size must be greater than 0',
				}),
			);
		});

		it('rejects negative file size', async () => {
			await expect(
				callAuthorizeUpload({
					target: 'gift-image',
					fileName: 'file.jpg',
					contentType: 'image/jpeg',
					fileSize: -1,
				}),
			).rejects.toThrow(expect.objectContaining({ status: 400 }));
		});

		it.each([
			{ target: 'gift-image', maxBytes: 5 * 1024 * 1024, label: '5MB' },
			{ target: 'wishlist-banner', maxBytes: 10 * 1024 * 1024, label: '10MB' },
			{ target: 'wishlist-thumbnail', maxBytes: 5 * 1024 * 1024, label: '5MB' },
		])('$target: rejects file over $label limit', async ({ target, maxBytes }) => {
			await expect(
				callAuthorizeUpload({
					target,
					fileName: 'big.jpg',
					contentType: 'image/jpeg',
					fileSize: maxBytes + 1,
				}),
			).rejects.toThrow(
				expect.objectContaining({
					status: 400,
					message: expect.stringContaining('File too large'),
				}),
			);
		});

		it.each([
			{ target: 'gift-image', maxBytes: 5 * 1024 * 1024 },
			{ target: 'wishlist-banner', maxBytes: 10 * 1024 * 1024 },
			{ target: 'wishlist-thumbnail', maxBytes: 5 * 1024 * 1024 },
		])(
			'$target: accepts file exactly at limit ($maxBytes bytes)',
			async ({ target, maxBytes }) => {
				const result = await callAuthorizeUpload({
					target,
					fileName: 'max.jpg',
					contentType: 'image/jpeg',
					fileSize: maxBytes,
				});

				expect(result.objectKey).toBeTruthy();
			},
		);

		it('rejects file at limit+1 byte (off-by-one boundary)', async () => {
			const limit = 5 * 1024 * 1024;

			await expect(
				callAuthorizeUpload({
					target: 'gift-image',
					fileName: 'file.jpg',
					contentType: 'image/jpeg',
					fileSize: limit + 1,
				}),
			).rejects.toThrow(
				expect.objectContaining({
					status: 400,
					message: expect.stringContaining('File too large'),
				}),
			);
		});
	});

	// ── Extension mapping ────────────────────────────────────────────────────

	describe('extension mapping', () => {
		it.each([
			['image/jpeg', 'jpg'],
			['image/png', 'png'],
			['image/webp', 'webp'],
			['image/gif', 'gif'],
		])('maps %s to .%s extension in objectKey', async (contentType, expectedExtension) => {
			const result = await callAuthorizeUpload({
				target: 'gift-image',
				fileName: `file.${expectedExtension}`,
				contentType,
				fileSize: 1024,
			});

			expect(result.objectKey).toBe(`gifts/test-id-123.${expectedExtension}`);
		});
	});
});
