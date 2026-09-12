import { vi, describe, it, expect, beforeEach } from 'vitest';

// Hoisted so the $lib/server/auth.js mock factory (also hoisted) can reference it.
const { mockGetUserInfo } = vi.hoisted(() => ({ mockGetUserInfo: vi.fn() }));

// Replace the real auth module so its heavy transitive imports ($env, better-auth,
// email, turnstile) never load in the unit env; expose a controllable Google provider.
vi.mock('$lib/server/auth.js', () => ({
	createAuth: vi.fn(() => ({
		$context: Promise.resolve({
			socialProviders: [{ id: 'google', getUserInfo: mockGetUserInfo }],
		}),
	})),
}));

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

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}),
}));

vi.mock('$lib/server/remote.js', () => ({
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'command' };
		return wrapped;
	}),
	guardedCommandNoArgs: vi.fn((handler: (...args: unknown[]) => unknown) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'command' };
		return wrapped;
	}),
	guardedQuery: vi.fn((handler: (...args: unknown[]) => unknown) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'query' };
		return wrapped;
	}),
	publicCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'command' };
		return wrapped;
	}),
}));

vi.mock('$lib/server/db/index.js', () => ({ getDb: vi.fn() }));

vi.mock('$lib/server/db/auth.schema.js', () => ({
	user: {
		id: 'u.id',
		name: 'u.name',
		email: 'u.email',
		image: 'u.image',
		appBackgroundTheme: 'u.appBackgroundTheme',
		preferredLocale: 'u.preferredLocale',
		palette: 'u.palette',
		depthStyle: 'u.depthStyle',
		updatedAt: 'u.updatedAt',
	},
	account: {
		userId: 'a.userId',
		providerId: 'a.providerId',
		idToken: 'a.idToken',
		accessToken: 'a.accessToken',
	},
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((...a: unknown[]) => a),
	and: vi.fn((...a: unknown[]) => a),
	isNull: vi.fn((...a: unknown[]) => a),
	inArray: vi.fn((...a: unknown[]) => a),
}));

vi.mock('$lib/server/db/wishlist.schema.js', () => ({
	wishlist: { id: 'w.id', recipientUserId: 'w.recipientUserId', imageKey: 'w.imageKey' },
}));

vi.mock('$lib/server/db/gift.schema.js', () => ({
	gift: { wishlistId: 'g.wishlistId', imageKey: 'g.imageKey', deletedAt: 'g.deletedAt' },
}));

vi.mock('$env/dynamic/public', () => ({
	env: {},
}));

vi.mock('$lib/server/storage/r2.js', () => ({
	deleteObjectsBestEffort: vi.fn(() => Promise.resolve()),
}));

import { getUserProfile, refreshGoogleAvatar } from './settings.remote.js';
import { getDb } from '$lib/server/db/index.js';

import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';

const mockGetDb = vi.mocked(getDb);

const mockDeleteObjects = vi.mocked(deleteObjectsBestEffort);

function createMockDb(queryResults: unknown[][]): ReturnType<typeof getDb> {
	let queryIndex = 0;

	const createChain = (): unknown =>
		new Proxy(
			{},
			{
				get: (_target, prop) => {
					if (prop === 'then') {
						const result = queryResults[queryIndex] ?? [];
						queryIndex++;
						return (resolve: (value: unknown) => void) => resolve(result);
					}
					return vi.fn(() => createChain());
				},
			},
		);

	return {
		select: vi.fn(() => createChain()),
		insert: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
		delete: vi.fn(() => createChain()),
	} as unknown as ReturnType<typeof getDb>;
}

const testUser = {
	id: 'user-1',
	name: 'Test User',
	email: 'test@example.com',
	image: 'https://example.com/avatar.jpg',
};
const testAuthContext = { user: testUser };

beforeEach(() => {
	vi.clearAllMocks();
});

describe('getUserProfile', () => {
	it('returns DB-sourced name/image (source of truth, not the stale session)', async () => {
		// getUserProfile reads name/image from the user table because the better-auth
		// session is cached and goes stale after a profile update. The DB values (here
		// deliberately different from the session) must win so edits persist on reload.
		mockGetDb.mockReturnValue(
			createMockDb([
				[{ providerId: 'credential' }, { providerId: 'credential' }],
				[
					{
						name: 'Fresh Name',
						image: 'https://example.com/fresh.jpg',
						preferredLocale: null,
					},
				],
			]),
		);

		const result = await (getUserProfile as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
		);

		expect(result).toEqual({
			id: testUser.id,
			name: 'Fresh Name',
			email: testUser.email,
			image: 'https://example.com/fresh.jpg',
			imageUrl: 'https://example.com/fresh.jpg',
			isOAuthUser: false,
			hasGoogleAccount: false,
			preferredLocale: null,
		});
	});

	it('resolves an uploaded-avatar object key to a display URL', async () => {
		mockGetDb.mockReturnValue(
			createMockDb([
				[{ providerId: 'credential' }],
				[{ name: 'Fresh Name', image: 'avatars/abc.jpg', preferredLocale: null }],
			]),
		);

		const result = (await (getUserProfile as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
		)) as { image: string; imageUrl: string };

		expect(result.image).toBe('avatars/abc.jpg');
		expect(result.imageUrl).toBe('/api/upload/avatars/abc.jpg');
	});

	it('returns profile with isOAuthUser=true and hasGoogleAccount=true for a Google account', async () => {
		mockGetDb.mockReturnValue(
			createMockDb([
				[{ providerId: 'credential' }, { providerId: 'google' }],
				[
					{
						name: testUser.name,
						image: testUser.image,
						preferredLocale: null,
					},
				],
			]),
		);

		const result = await (getUserProfile as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
		);

		expect(result).toEqual({
			id: testUser.id,
			name: testUser.name,
			email: testUser.email,
			image: testUser.image,
			imageUrl: testUser.image,
			isOAuthUser: true,
			hasGoogleAccount: true,
			preferredLocale: null,
		});
	});
});

describe('refreshGoogleAvatar', () => {
	const callRefresh = () =>
		(refreshGoogleAvatar as unknown as (...args: unknown[]) => Promise<unknown>)(
			testAuthContext,
		);

	it('returns { ok: false } and writes nothing when no Google account is linked', async () => {
		const db = createMockDb([[]]); // no google account row
		mockGetDb.mockReturnValue(db);

		const result = await callRefresh();

		expect(result).toEqual({ ok: false });
		expect(mockGetUserInfo).not.toHaveBeenCalled();
		expect(db.update).not.toHaveBeenCalled();
	});

	it('decodes the id_token picture claim and persists it as the avatar', async () => {
		const db = createMockDb([
			[{ idToken: 'id.jwt.tok', accessToken: null }], // google account
			[{ image: null }], // previous user image
		]);
		mockGetDb.mockReturnValue(db);
		mockGetUserInfo.mockResolvedValue({
			user: { image: 'https://lh3.googleusercontent.com/newpic' },
		});

		const result = await callRefresh();

		expect(mockGetUserInfo).toHaveBeenCalledWith({ idToken: 'id.jwt.tok' });
		expect(db.update).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			ok: true,
			image: 'https://lh3.googleusercontent.com/newpic',
			imageUrl: 'https://lh3.googleusercontent.com/newpic',
		});
		expect(mockDeleteObjects).not.toHaveBeenCalled();
	});

	it('deletes the previous uploaded avatar object when replaced by the Google photo', async () => {
		const db = createMockDb([
			[{ idToken: 'id.jwt.tok', accessToken: null }],
			[{ image: 'avatars/old.jpg' }],
		]);
		mockGetDb.mockReturnValue(db);
		mockGetUserInfo.mockResolvedValue({
			user: { image: 'https://lh3.googleusercontent.com/newpic' },
		});

		await callRefresh();

		expect(mockDeleteObjects).toHaveBeenCalledWith(['avatars/old.jpg']);
	});

	it('returns { ok: false } when neither an id_token nor an access token is stored', async () => {
		const db = createMockDb([[{ idToken: null, accessToken: null }]]);
		mockGetDb.mockReturnValue(db);

		const result = await callRefresh();

		expect(result).toEqual({ ok: false });
		expect(mockGetUserInfo).not.toHaveBeenCalled();
		expect(db.update).not.toHaveBeenCalled();
	});
});
