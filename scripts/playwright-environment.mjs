import { automatedServerEnvironment } from './browser-automation.mjs';

function requireLoopback(url) {
	if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
		throw new Error('Playwright requires loopback application and database targets.');
	}
}

function requireApplicationOrigin(value) {
	const url = new URL(value);
	requireLoopback(url);
	if (
		url.protocol !== 'http:' ||
		url.username ||
		url.password ||
		url.pathname !== '/' ||
		url.search ||
		url.hash
	) {
		throw new Error('Playwright requires an uncredentialed local HTTP origin.');
	}
	return url.origin;
}

export function resolvePlaywrightServer({ environment, applicationOrigin, baseUrl, databaseUrl }) {
	const origin = requireApplicationOrigin(applicationOrigin);
	if (requireApplicationOrigin(baseUrl) !== origin) {
		throw new Error('PLAYWRIGHT_BASE_URL must match the assigned application origin.');
	}
	const database = new URL(databaseUrl);
	requireLoopback(database);
	if (!['postgres:', 'postgresql:'].includes(database.protocol)) {
		throw new Error('Playwright requires a PostgreSQL database URL.');
	}

	return {
		external: environment.PLAYWRIGHT_EXTERNAL_SERVER === '1',
		environment: {
			...automatedServerEnvironment,
			DATABASE_URL: databaseUrl,
			// The adapter's local Hyperdrive binding takes precedence over DATABASE_URL.
			CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: databaseUrl,
			AUTH_SECRET:
				environment.AUTH_SECRET ??
				'local-e2e-only-auth-secret-never-use-in-production-2026',
			ORIGIN: origin,
			ADMIN_EMAILS: 'tomas@test.cz',
			R2_ACCOUNT_ID: '',
			R2_ACCESS_KEY_ID: '',
			R2_SECRET_ACCESS_KEY: '',
			PUBLIC_R2_URL: '',
			RESEND_API_KEY: '',
		},
	};
}
