import { defineConfig, devices } from '@playwright/test';
import { resolveDevelopmentEnvironment } from './src/lib/config/mpx_development.js';
import {
	automatedServerEnvironment,
	sharedChromeLaunchOptions,
} from './scripts/browser-automation.mjs';

const development = resolveDevelopmentEnvironment(process.env);
const devServerPort = development.appPort;
const devServerCommand = process.env.CI ? 'pnpm exec vite dev' : 'pnpm run dev';

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	retries: 1,
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
	webServer: {
		// No `--` separator: pnpm forwards it verbatim and vite would treat the flags as positionals.
		// CI already provisions PostgreSQL as a service; bypass `predev` there to avoid
		// starting a second Docker database on the occupied service port.
		command: `${devServerCommand} --port ${devServerPort} --strictPort`,
		port: devServerPort,
		// Cold Vite/Paraglide startup can exceed Playwright's 60-second default on Windows.
		timeout: 120_000,
		// Never reuse a server that may lack the controlled local E2E environment.
		reuseExistingServer: false,
		env: {
			...automatedServerEnvironment,
			// Local E2E signing only; this deterministic fallback is not a production secret.
			AUTH_SECRET:
				process.env.AUTH_SECRET ??
				'local-e2e-only-auth-secret-never-use-in-production-2026',
			// Keep Better Auth aligned with the localhost URL used by Playwright.
			ORIGIN: development.appOrigin,
			// The app administrator is env-based (`isAppAdmin`), so the admin-only specs
			// (revert-to-draft #150, release reservation #213) need a known operator address.
			ADMIN_EMAILS: 'tomas@test.cz',
		},
	},
	projects: [
		{
			name: 'setup',
			testMatch: /global-setup\.spec\.ts/,
		},
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['setup'],
		},
	],
});
