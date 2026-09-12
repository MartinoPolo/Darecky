import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlaywrightServer } from './playwright-environment.mjs';

const applicationOrigin = 'http://localhost:8315';
const databaseUrl = 'postgres://root:local-password@localhost:5432/e2e_isolated';

function resolve(environment = {}, overrides = {}) {
	return resolvePlaywrightServer({
		environment,
		applicationOrigin,
		baseUrl: applicationOrigin,
		databaseUrl,
		...overrides,
	});
}

test('the application and direct fixtures use the same explicit database', () => {
	const server = resolve({
		CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:
			'postgres://root:local-password@localhost:5432/unrelated',
	});
	assert.equal(server.environment.DATABASE_URL, databaseUrl);
	assert.equal(
		server.environment.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE,
		databaseUrl,
	);
	assert.equal(server.environment.ORIGIN, applicationOrigin);
	assert.equal(server.external, false);
});

test('external server use requires explicit opt-in and a matching URL', () => {
	assert.equal(resolve({ PLAYWRIGHT_EXTERNAL_SERVER: '1' }).external, true);
	assert.throws(
		() => resolve({ PLAYWRIGHT_EXTERNAL_SERVER: '1' }, { baseUrl: 'http://localhost:8316' }),
		/match/,
	);
});

test('automation refuses remote app and database targets', () => {
	assert.throws(
		() => resolve({}, { databaseUrl: 'postgres://user:secret@example.com/app' }),
		/loopback/,
	);
	assert.throws(
		() =>
			resolve(
				{},
				{ applicationOrigin: 'https://prejemesi.cz', baseUrl: 'https://prejemesi.cz' },
			),
		/loopback/,
	);
	assert.throws(() => resolve({}, { baseUrl: 'https://prejemesi.cz' }), /loopback/);
});

test('automation does not permit credentialed or non-origin application URLs', () => {
	for (const origin of [
		'http://user:secret@localhost:8315',
		'http://localhost:8315/path',
		'http://localhost:8315?x=1',
	]) {
		assert.throws(() => resolve({}, { applicationOrigin: origin, baseUrl: origin }), /origin/);
	}
});

test('automation disables remote upload and email credentials while preserving local auth', () => {
	const server = resolve({ AUTH_SECRET: 'explicit-local-signing-secret' });
	assert.equal(server.environment.AUTH_SECRET, 'explicit-local-signing-secret');
	assert.equal(server.environment.BROWSER, 'none');
	for (const name of [
		'R2_ACCESS_KEY_ID',
		'R2_SECRET_ACCESS_KEY',
		'PUBLIC_R2_URL',
		'RESEND_API_KEY',
	]) {
		assert.equal(server.environment[name], '');
	}
});
