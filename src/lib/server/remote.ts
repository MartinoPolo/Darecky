import { getRequestEvent, query, command } from '$app/server';
import { error } from '@sveltejs/kit';
import type { User, Session } from 'better-auth';
import type { StandardSchemaV1 } from '@standard-schema/spec';

interface AuthContext {
	user: User;
	session: Session;
}

function getAuthContext(): AuthContext {
	const event = getRequestEvent();
	const user = event.locals.user;
	const session = event.locals.session;

	if (user === undefined || session === undefined) {
		error(401, 'Authentication required');
	}

	return { user, session };
}

export function guardedQuery<TResult>(
	handler: (authContext: AuthContext) => TResult | Promise<TResult>,
) {
	return query(() => {
		const authContext = getAuthContext();
		return handler(authContext);
	});
}

export function guardedQueryWithArgs<TSchema extends StandardSchemaV1, TResult>(
	schema: TSchema,
	handler: (
		authContext: AuthContext,
		arg: StandardSchemaV1.InferOutput<TSchema>,
	) => TResult | Promise<TResult>,
) {
	return query(schema, (arg: StandardSchemaV1.InferOutput<TSchema>) => {
		const authContext = getAuthContext();
		return handler(authContext, arg);
	});
}

export function publicQuery<TSchema extends StandardSchemaV1, TResult>(
	schema: TSchema,
	handler: (
		authContext: AuthContext | null,
		arg: StandardSchemaV1.InferOutput<TSchema>,
	) => TResult | Promise<TResult>,
) {
	return query(schema, (arg: StandardSchemaV1.InferOutput<TSchema>) => {
		const event = getRequestEvent();
		const user = event.locals.user;
		const session = event.locals.session;
		const authContext = user !== undefined && session !== undefined ? { user, session } : null;
		return handler(authContext, arg);
	});
}

export function guardedCommand<TSchema extends StandardSchemaV1, TResult>(
	schema: TSchema,
	handler: (
		authContext: AuthContext,
		arg: StandardSchemaV1.InferOutput<TSchema>,
	) => TResult | Promise<TResult>,
) {
	return command(schema, (arg: StandardSchemaV1.InferOutput<TSchema>) => {
		const authContext = getAuthContext();
		return handler(authContext, arg);
	});
}

export function guardedCommandNoArgs<TResult>(
	handler: (authContext: AuthContext) => TResult | Promise<TResult>,
) {
	return command(() => {
		const authContext = getAuthContext();
		return handler(authContext);
	});
}

export function publicCommand<TSchema extends StandardSchemaV1, TResult>(
	schema: TSchema,
	handler: (
		authContext: AuthContext | null,
		arg: StandardSchemaV1.InferOutput<TSchema>,
	) => TResult | Promise<TResult>,
) {
	return command(schema, (arg: StandardSchemaV1.InferOutput<TSchema>) => {
		const event = getRequestEvent();
		const user = event.locals.user;
		const session = event.locals.session;
		const authContext = user !== undefined && session !== undefined ? { user, session } : null;
		return handler(authContext, arg);
	});
}

interface RefreshableQueryResult {
	refresh(): Promise<void>;
}

/**
 * Single-flight refresh from inside a command handler (issue #108, REQ-3/4/5):
 * re-runs the query on the server and sends the fresh result back on the same
 * command response, where it updates any client-side tracked instance of the
 * query. Untracked instances discard the payload — the client never issues a
 * follow-up fetch either way.
 *
 * No-ops outside a remote request (SSR, unit tests), mirroring SvelteKit's own
 * rule that refreshed data can only ride back on a command/form response.
 */
export async function singleFlightRefresh<TArg>(
	queryFunction: (arg: TArg) => RefreshableQueryResult,
	...arg: TArg extends void ? [] : [TArg]
): Promise<void> {
	try {
		if (!getRequestEvent().isRemoteRequest) {
			return;
		}
	} catch {
		return;
	}

	return (queryFunction as (arg?: TArg) => RefreshableQueryResult)(arg[0]).refresh();
}
