import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as v from 'valibot';
import type { User, Session } from 'better-auth';

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

import { getRequestEvent } from '$app/server';
import {
	guardedQuery,
	guardedQueryWithArgs,
	publicQuery,
	guardedCommand,
	guardedCommandNoArgs,
	publicCommand,
	singleFlightRefresh,
} from './remote.js';

const mockGetRequestEvent = vi.mocked(getRequestEvent);

const fakeUser = { id: 'user-1', email: 'test@example.com' } as unknown as User;
const fakeSession = { id: 'session-1', userId: 'user-1' } as unknown as Session;

function setupAuthenticatedEvent(): void {
	mockGetRequestEvent.mockReturnValue({
		locals: { user: fakeUser, session: fakeSession },
	} as ReturnType<typeof getRequestEvent>);
}

function setupUnauthenticatedEvent(): void {
	mockGetRequestEvent.mockReturnValue({
		locals: { user: undefined, session: undefined },
	} as unknown as ReturnType<typeof getRequestEvent>);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('guardedQuery', () => {
	it('calls handler with auth context and returns result when authenticated', () => {
		setupAuthenticatedEvent();
		const handler = vi.fn(() => 'query-result');
		const wrappedQuery = guardedQuery(handler) as () => unknown;

		const result = wrappedQuery();

		expect(handler).toHaveBeenCalledWith({ user: fakeUser, session: fakeSession });
		expect(result).toBe('query-result');
	});

	it('throws 401 when unauthenticated', () => {
		setupUnauthenticatedEvent();
		const handler = vi.fn();
		const wrappedQuery = guardedQuery(handler) as () => unknown;

		expect(() => wrappedQuery()).toThrowError(expect.objectContaining({ status: 401 }));
		expect(handler).not.toHaveBeenCalled();
	});
});

describe('guardedQueryWithArgs', () => {
	it('passes auth context and arg to handler when authenticated', () => {
		setupAuthenticatedEvent();
		const handler = vi.fn(() => 'result-with-args');
		const wrappedQuery = guardedQueryWithArgs(v.unknown(), handler) as (
			arg: unknown,
		) => unknown;

		const result = wrappedQuery({ page: 1 });

		expect(handler).toHaveBeenCalledWith({ user: fakeUser, session: fakeSession }, { page: 1 });
		expect(result).toBe('result-with-args');
	});

	it('throws 401 when unauthenticated', () => {
		setupUnauthenticatedEvent();
		const handler = vi.fn();
		const wrappedQuery = guardedQueryWithArgs(v.unknown(), handler) as (
			arg: unknown,
		) => unknown;

		expect(() => wrappedQuery({ page: 1 })).toThrowError(
			expect.objectContaining({ status: 401 }),
		);
		expect(handler).not.toHaveBeenCalled();
	});
});

describe('publicQuery', () => {
	it('passes AuthContext to handler when authenticated', () => {
		setupAuthenticatedEvent();
		const handler = vi.fn(() => 'public-auth-result');
		const wrappedQuery = publicQuery(v.unknown(), handler) as (arg: unknown) => unknown;

		const result = wrappedQuery('some-arg');

		expect(handler).toHaveBeenCalledWith({ user: fakeUser, session: fakeSession }, 'some-arg');
		expect(result).toBe('public-auth-result');
	});

	it('passes null as authContext when unauthenticated', () => {
		setupUnauthenticatedEvent();
		const handler = vi.fn(() => 'public-anon-result');
		const wrappedQuery = publicQuery(v.unknown(), handler) as (arg: unknown) => unknown;

		const result = wrappedQuery('some-arg');

		expect(handler).toHaveBeenCalledWith(null, 'some-arg');
		expect(result).toBe('public-anon-result');
	});
});

describe('guardedCommand', () => {
	it('calls handler with auth context and arg when authenticated', () => {
		setupAuthenticatedEvent();
		const handler = vi.fn(() => 'command-result');
		const wrappedCommand = guardedCommand(v.unknown(), handler) as (arg: unknown) => unknown;

		const result = wrappedCommand({ action: 'create' });

		expect(handler).toHaveBeenCalledWith(
			{ user: fakeUser, session: fakeSession },
			{ action: 'create' },
		);
		expect(result).toBe('command-result');
	});

	it('throws 401 when unauthenticated', () => {
		setupUnauthenticatedEvent();
		const handler = vi.fn();
		const wrappedCommand = guardedCommand(v.unknown(), handler) as (arg: unknown) => unknown;

		expect(() => wrappedCommand({ action: 'create' })).toThrowError(
			expect.objectContaining({ status: 401 }),
		);
		expect(handler).not.toHaveBeenCalled();
	});
});

describe('guardedCommandNoArgs', () => {
	it('calls handler with auth context when authenticated', () => {
		setupAuthenticatedEvent();
		const handler = vi.fn(() => 'no-args-result');
		const wrappedCommand = guardedCommandNoArgs(handler) as () => unknown;

		const result = wrappedCommand();

		expect(handler).toHaveBeenCalledWith({ user: fakeUser, session: fakeSession });
		expect(result).toBe('no-args-result');
	});

	it('throws 401 when unauthenticated', () => {
		setupUnauthenticatedEvent();
		const handler = vi.fn();
		const wrappedCommand = guardedCommandNoArgs(handler) as () => unknown;

		expect(() => wrappedCommand()).toThrowError(expect.objectContaining({ status: 401 }));
		expect(handler).not.toHaveBeenCalled();
	});
});

describe('singleFlightRefresh', () => {
	it('awaits a remote query refresh and passes its argument', async () => {
		mockGetRequestEvent.mockReturnValue({
			isRemoteRequest: true,
		} as ReturnType<typeof getRequestEvent>);
		let resolveRefresh!: () => void;
		const refreshPromise = new Promise<void>((resolve) => (resolveRefresh = resolve));
		const refresh = vi.fn(() => refreshPromise);
		const queryFunction = vi.fn(() => ({ refresh }));
		let settled = false;

		const result = singleFlightRefresh(queryFunction, 'wishlist-1').then(
			() => (settled = true),
		);
		await Promise.resolve();

		expect(queryFunction).toHaveBeenCalledWith('wishlist-1');
		expect(refresh).toHaveBeenCalledOnce();
		expect(settled).toBe(false);

		resolveRefresh();
		await result;
		expect(settled).toBe(true);
	});

	it('does not refresh outside a remote request', async () => {
		mockGetRequestEvent.mockReturnValue({
			isRemoteRequest: false,
		} as ReturnType<typeof getRequestEvent>);
		const queryFunction = vi.fn(() => ({ refresh: vi.fn() }));

		await expect(singleFlightRefresh(queryFunction, 'wishlist-1')).resolves.toBeUndefined();

		expect(queryFunction).not.toHaveBeenCalled();
	});
});

describe('publicCommand', () => {
	it('passes AuthContext to handler when authenticated', () => {
		setupAuthenticatedEvent();
		const handler = vi.fn(() => 'public-cmd-auth-result');
		const wrappedCommand = publicCommand(v.unknown(), handler) as (arg: unknown) => unknown;

		const result = wrappedCommand({ data: 'value' });

		expect(handler).toHaveBeenCalledWith(
			{ user: fakeUser, session: fakeSession },
			{ data: 'value' },
		);
		expect(result).toBe('public-cmd-auth-result');
	});

	it('passes null as authContext when unauthenticated', () => {
		setupUnauthenticatedEvent();
		const handler = vi.fn(() => 'public-cmd-anon-result');
		const wrappedCommand = publicCommand(v.unknown(), handler) as (arg: unknown) => unknown;

		const result = wrappedCommand({ data: 'value' });

		expect(handler).toHaveBeenCalledWith(null, { data: 'value' });
		expect(result).toBe('public-cmd-anon-result');
	});
});
