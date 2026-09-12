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

import * as v from 'valibot';
import {
	updateProfile,
	updatePreferredLocale,
	setUserPalette,
	setUserDepthStyle,
	deleteAccount,
} from './settings.remote.js';
import { SetUserDepthStyleInputSchema, SetUserPaletteInputSchema } from './types.js';
import { getDb } from '$lib/server/db/index.js';
import { getRequestEvent } from '$app/server';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import { user as mockedUserTable } from '$lib/server/db/auth.schema.js';

const mockGetDb = vi.mocked(getDb);
const mockGetRequestEvent = vi.mocked(getRequestEvent);
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

describe('updateProfile', () => {
	const callUpdateProfile = (input: { name: string; image: string | null }) =>
		(updateProfile as unknown as (...args: unknown[]) => Promise<void>)(testAuthContext, input);

	it('deletes the previous uploaded avatar object when replaced (REQ-6)', async () => {
		mockGetDb.mockReturnValue(createMockDb([[{ image: 'avatars/old.jpg' }], []]));

		await callUpdateProfile({ name: 'Name', image: 'avatars/new.jpg' });

		expect(mockDeleteObjects).toHaveBeenCalledWith(['avatars/old.jpg']);
	});

	it('does not delete anything when the avatar is unchanged', async () => {
		mockGetDb.mockReturnValue(createMockDb([[{ image: 'avatars/same.jpg' }], []]));

		await callUpdateProfile({ name: 'Name', image: 'avatars/same.jpg' });

		expect(mockDeleteObjects).not.toHaveBeenCalled();
	});

	it('never deletes an external URL avatar (Google profile picture)', async () => {
		mockGetDb.mockReturnValue(
			createMockDb([[{ image: 'https://lh3.googleusercontent.com/x' }], []]),
		);

		await callUpdateProfile({ name: 'Name', image: 'avatars/new.jpg' });

		expect(mockDeleteObjects).not.toHaveBeenCalled();
	});
});

describe('deleteAccount', () => {
	it('deletes the avatar plus own-wishlist and gift images from storage (REQ-6)', async () => {
		mockGetDb.mockReturnValue(
			createMockDb([
				// 1: user row (avatar is an uploaded object key)
				[{ image: 'avatars/me.jpg' }],
				// 2: recipient wishlists
				[
					{ id: 'w1', imageKey: 'wishlists/banners/w1.jpg' },
					{ id: 'w2', imageKey: null },
				],
				// 3: gifts of those wishlists
				[{ imageKey: 'gifts/g1.jpg' }, { imageKey: null }],
				// 4: user delete
				[],
			]),
		);

		await (deleteAccount as unknown as (...args: unknown[]) => Promise<void>)(testAuthContext);

		expect(mockDeleteObjects).toHaveBeenCalledWith([
			'avatars/me.jpg',
			'wishlists/banners/w1.jpg',
			null,
			'gifts/g1.jpg',
			null,
		]);
	});

	it('skips the gift query when the user has no recipient wishlists', async () => {
		const mockDb = createMockDb([[{ image: null }], [], []]);
		mockGetDb.mockReturnValue(mockDb);

		await (deleteAccount as unknown as (...args: unknown[]) => Promise<void>)(testAuthContext);

		expect(mockDeleteObjects).toHaveBeenCalledWith([]);
		expect(mockDb.delete).toHaveBeenCalledTimes(1);
	});
});

describe('setUserPalette', () => {
	function mockCookies() {
		const cookieSet = vi.fn();
		mockGetRequestEvent.mockReturnValue({
			cookies: { set: cookieSet },
		} as unknown as ReturnType<typeof getRequestEvent>);
		return cookieSet;
	}

	it('validates input via isPalette: accepts palettes, rejects everything else', () => {
		expect(v.is(SetUserPaletteInputSchema, 'mint')).toBe(true);
		expect(v.is(SetUserPaletteInputSchema, 'graphite')).toBe(true);
		expect(v.is(SetUserPaletteInputSchema, 'neon')).toBe(false);
		expect(v.is(SetUserPaletteInputSchema, '')).toBe(false);
		expect(v.is(SetUserPaletteInputSchema, 42)).toBe(false);
		expect(v.is(SetUserPaletteInputSchema, null)).toBe(false);
	});

	it('anonymous: sets the app-palette cookie only, no DB write, no error', async () => {
		const cookieSet = mockCookies();
		const mockDb = createMockDb([[]]);
		mockGetDb.mockReturnValue(mockDb);

		await (setUserPalette as unknown as (...args: unknown[]) => Promise<void>)(null, 'ruby');

		expect(cookieSet).toHaveBeenCalledWith(
			'app-palette',
			'ruby',
			expect.objectContaining({ path: '/', httpOnly: false, sameSite: 'lax' }),
		);
		expect(mockDb.update).not.toHaveBeenCalled();
	});

	it('logged in: sets the cookie AND persists the palette on the user row', async () => {
		const cookieSet = mockCookies();
		const mockDb = createMockDb([[]]);
		mockGetDb.mockReturnValue(mockDb);

		await (setUserPalette as unknown as (...args: unknown[]) => Promise<void>)(
			testAuthContext,
			'ocean',
		);

		expect(cookieSet).toHaveBeenCalledWith('app-palette', 'ocean', expect.any(Object));
		expect(mockDb.update).toHaveBeenCalledTimes(1);
	});
});

describe('setUserDepthStyle', () => {
	function mockCookies() {
		const cookieSet = vi.fn();
		mockGetRequestEvent.mockReturnValue({
			cookies: { set: cookieSet },
		} as unknown as ReturnType<typeof getRequestEvent>);
		return cookieSet;
	}

	it('validates exactly the three approved styles', () => {
		expect(
			['soft', 'ink', 'black'].every((value) => v.is(SetUserDepthStyleInputSchema, value)),
		).toBe(true);
		expect(
			['hard', '', 'Soft', null].some((value) => v.is(SetUserDepthStyleInputSchema, value)),
		).toBe(false);
	});

	it('anonymous viewers get only a one-year non-httpOnly cookie', async () => {
		const cookieSet = mockCookies();
		const mockDb = createMockDb([[]]);
		mockGetDb.mockReturnValue(mockDb);

		await (setUserDepthStyle as unknown as (...args: unknown[]) => Promise<void>)(null, 'ink');

		expect(cookieSet).toHaveBeenCalledWith('app-depth', 'ink', {
			path: '/',
			maxAge: 31_536_000,
			httpOnly: false,
			sameSite: 'lax',
		});
		expect(mockDb.update).not.toHaveBeenCalled();
	});

	it('authenticated viewers get the cookie and persist depth on the current user row', async () => {
		const cookieSet = mockCookies();
		const whereMock = vi.fn(() => Promise.resolve());
		const setMock = vi.fn(() => ({ where: whereMock }));
		const updateMock = vi.fn(() => ({ set: setMock }));
		mockGetDb.mockReturnValue({ update: updateMock } as unknown as ReturnType<typeof getDb>);

		await (setUserDepthStyle as unknown as (...args: unknown[]) => Promise<void>)(
			testAuthContext,
			'black',
		);

		expect(cookieSet).toHaveBeenCalledWith('app-depth', 'black', expect.any(Object));
		expect(updateMock).toHaveBeenCalledWith(mockedUserTable);
		expect(setMock).toHaveBeenCalledWith({
			depthStyle: 'black',
			updatedAt: expect.any(Date),
		});
		expect(whereMock).toHaveBeenCalledWith(['u.id', 'user-1']);
	});
});

describe('updateProfile', () => {
	function createRecordingDb() {
		const setMock = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }));
		const updateMock = vi.fn(() => ({ set: setMock }));
		const selectMock = vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(() => Promise.resolve([])),
				})),
			})),
		}));
		mockGetDb.mockReturnValue({
			update: updateMock,
			select: selectMock,
		} as unknown as ReturnType<typeof getDb>);
		return { setMock, updateMock };
	}

	it('persists the name and the public avatar URL verbatim on the user row', async () => {
		// user.image must hold a renderable public URL — whatever the client sends
		// as `image` is what every profile consumer will use as <img src>.
		const { setMock, updateMock } = createRecordingDb();

		await (updateProfile as unknown as (...args: unknown[]) => Promise<void>)(testAuthContext, {
			name: 'Fresh Name',
			image: 'https://cdn.example.com/avatars/abc123.jpg',
		});

		expect(updateMock).toHaveBeenCalledTimes(1);
		expect(setMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Fresh Name',
				image: 'https://cdn.example.com/avatars/abc123.jpg',
			}),
		);
	});

	it('persists a null image (no avatar) without error', async () => {
		const { setMock } = createRecordingDb();

		await (updateProfile as unknown as (...args: unknown[]) => Promise<void>)(testAuthContext, {
			name: 'Fresh Name',
			image: null,
		});

		expect(setMock).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Fresh Name', image: null }),
		);
	});
});

describe('updatePreferredLocale', () => {
	it('persists the chosen locale', async () => {
		const mockDb = createMockDb([[]]);
		mockGetDb.mockReturnValue(mockDb);

		await (updatePreferredLocale as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
			{
				preferredLocale: 'en',
			},
		);

		expect(mockDb.update).toHaveBeenCalledTimes(1);
	});
});
