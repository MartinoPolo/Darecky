import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';
import {
	resolveDatabaseUrl,
	resolveDevelopmentEnvironment,
} from './src/lib/config/mpx_development.js';
import { sharedChromeLaunchOptions } from './scripts/browser-automation.mjs';
import { resolvePlaywrightServer } from './scripts/playwright-environment.mjs';

const environment = { ...loadEnv('development', process.cwd(), ''), ...process.env };
const development = resolveDevelopmentEnvironment(environment);
const devServerPort = development.appPort;
const databaseUrl = resolveDatabaseUrl(environment);
if (!databaseUrl) {
	throw new Error(
		'Prepare a seeded local E2E database and set DATABASE_URL before running Playwright.',
	);
}
const server = resolvePlaywrightServer({
	environment,
	applicationOrigin: development.appOrigin,
	baseUrl: development.playwrightBaseUrl,
	databaseUrl,
});

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	retries: process.env.CI ? 1 : 0,
	reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
	timeout: 60_000,
	preserveOutput: process.env.UPDATE_HOVER_EVIDENCE === '1' ? 'always' : 'failures-only',
	expect: { timeout: 10_000 },
	// Keep the shared Vite dev server and PostgreSQL fixture below saturation. On high-core
	// developer machines Playwright's default worker count overloads first-hit SSR/remote
	// requests, producing migrating timeouts that pass immediately on retry.
	workers: 2,
	use: {
		...sharedChromeLaunchOptions,
		baseURL: development.playwrightBaseUrl,
		trace: 'on-first-retry',
		actionTimeout: 15_000,
		navigationTimeout: 30_000,
	},
	webServer: server.external
		? undefined
		: {
				command: `pnpm dev:agent --port ${devServerPort} --strictPort`,
				port: devServerPort,
				timeout: 120_000,
				reuseExistingServer: false,
				env: server.environment,
			},
	projects: [
		{
			name: 'setup',
			testMatch: /global-setup\.spec\.ts/,
		},
		{
			name: 'chromium',
			testIgnore: /global-setup\.spec\.ts/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['setup'],
		},
	],
});
