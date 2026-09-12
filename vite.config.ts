import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { sentrySvelteKit } from '@sentry/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { paraglideCompilerOptions } from './scripts/paraglide-options.mjs';
import devtoolsJson from 'vite-plugin-devtools-json';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { resolveDevelopmentEnvironment } from './src/lib/config/mpx_development.js';
import { sharedChromeLaunchOptions } from './scripts/browser-automation.mjs';

// Read current git branch at dev-server start so each worktree gets its own
// branch name baked in – consumed by +layout.svelte to prefix browser tab titles.
const gitBranch = (() => {
	try {
		return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
	} catch {
		return 'local';
	}
})();

const dirname =
	typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const isVitest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
const development = resolveDevelopmentEnvironment(process.env);

interface VitestBrowserRunnerFallback {
	wrapDynamicImport<T>(factory: () => Promise<T>): Promise<T>;
}

declare global {
	var __vitest_browser_runner__: VitestBrowserRunnerFallback | undefined;
}

if (isVitest) {
	// Vitest stable transforms SSR imports but removes its browser runner during teardown;
	// `??=` preserves the real runner while supplying the upstream-documented fallback.
	globalThis.__vitest_browser_runner__ ??= {
		wrapDynamicImport: <T>(factory: () => Promise<T>) => factory(),
	};
}

const sentryUploadEnvironmentVariables = [
	process.env.SENTRY_AUTH_TOKEN,
	process.env.SENTRY_ORG,
	process.env.SENTRY_PROJECT,
];
const configuredSentryUploadVariables = sentryUploadEnvironmentVariables.filter(
	(value) => value !== undefined && value !== '',
).length;
const shouldUploadSentrySourceMaps =
	process.env.GITHUB_ACTIONS === 'true' &&
	process.env.GITHUB_REF === 'refs/heads/production' &&
	process.env.SENTRY_UPLOAD_SOURCE_MAPS === 'true';
if (shouldUploadSentrySourceMaps && configuredSentryUploadVariables < 3) {
	throw new Error(
		'Sentry source-map upload requires SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT together.',
	);
}

/**
 * Dev-only: evaluate the SSR module graph once, uncontended, before serving
 * requests. Vite's module runner hands out HALF-EVALUATED module exports when
 * concurrent cold-start requests evaluate a shared module and its
 * circular-import heuristic misfires: `cachedRequest` consults the cumulative
 * cross-request importers graph BEFORE awaiting the module's pending
 * evaluation promise (vite 7.3.2, dist/node/module-runner.js). hooks.server.ts
 * then calls into a mid-evaluation $lib/server/db/index.js and the first
 * page load 500s with "Cannot access 'runtimeConnectionString' before
 * initialization". Only a SECOND concurrent toucher of a pending module can
 * receive partial exports, so serializing the first evaluation of the hooks
 * graph closes the window entirely.
 */
function prewarmServerModuleGraph(): Plugin {
	let warmupPromise: Promise<void> | undefined;
	return {
		name: 'prewarm-server-module-graph',
		apply: 'serve',
		configureServer(server) {
			const warmup = () =>
				(warmupPromise ??= server
					.ssrLoadModule('/src/hooks.server.ts')
					.then(() => undefined)
					.catch((error: unknown) => {
						console.error('[prewarm-server-module-graph] warmup failed', error);
					}));
			server.httpServer?.once('listening', () => {
				void warmup();
			});
			server.middlewares.use((_req, _res, next) => {
				void warmup().then(() => next());
			});
		},
	};
}

export default defineConfig({
	optimizeDeps: {
		include: [
			'@lucide/svelte/icons/archive',
			'@lucide/svelte/icons/arrow-right',
			'@lucide/svelte/icons/bell',
			'@lucide/svelte/icons/bookmark-check',
			'@lucide/svelte/icons/bookmark-x',
			'@lucide/svelte/icons/circle-alert',
			'@lucide/svelte/icons/copy',
			'@lucide/svelte/icons/gift',
			'@lucide/svelte/icons/hand',
			'@lucide/svelte/icons/layers',
			'@lucide/svelte/icons/list-filter-plus',
			'@lucide/svelte/icons/shield',
			'@lucide/svelte/icons/sparkles',
			'@lucide/svelte/icons/user-check',
			'@lucide/svelte/icons/user-plus',
			'drizzle-orm',
			'drizzle-orm/pg-core',
			'nanoid',
		],
	},
	server: {
		...development.appServer,
		strictPort: true,
		open: isVitest ? false : development.appOrigin,
		watch: {
			ignored: ['**/.mpx/**', './*.html'],
		},
		warmup: isVitest
			? undefined
			: {
					clientFiles: [
						'./src/routes/(app)/home/+page.svelte',
						'./src/routes/(app)/my-lists/+page.svelte',
						'./src/routes/(app)/moderated/+page.svelte',
						'./src/routes/(app)/followed/+page.svelte',
						'./src/routes/(app)/settings/+page.svelte',
						'./src/routes/(auth)/login/+page.svelte',
						'./src/routes/(auth)/register/+page.svelte',
					],
				},
	},
	define: {
		// Exposed as __GIT_BRANCH__ global; consumed in +layout.svelte to prefix tab titles.
		__GIT_BRANCH__: JSON.stringify(gitBranch),
	},
	plugins: [
		...(isVitest
			? []
			: [
					sentrySvelteKit({
						adapter: 'cloudflare',
						autoInstrument: false,
						autoUploadSourceMaps: shouldUploadSentrySourceMaps,
						authToken: process.env.SENTRY_AUTH_TOKEN,
						org: process.env.SENTRY_ORG,
						project: process.env.SENTRY_PROJECT,
						telemetry: false,
					}),
				]),
		tailwindcss(),
		sveltekit(),
		// Options live in scripts/paraglide-options.mjs, shared with the standalone
		// `paraglide:compile` script — see there for why cleanOutdir must stay false.
		paraglideVitePlugin(paraglideCompilerOptions),
		devtoolsJson(),
		// Vitest browser projects extend this config and spin up their own Vite
		// servers; they never serve SvelteKit SSR, so skip the warmup there.
		...(isVitest ? [] : [prewarmServerModuleGraph()]),
	],
	test: {
		passWithNoTests: true,
		expect: {
			requireAssertions: true,
		},
		coverage: {
			include: [
				'src/lib/modules/**/*.remote.ts',
				'src/lib/modules/gifts/gift_url.ts',
				'src/lib/modules/import/parse_tabular.ts',
				'src/lib/modules/import/detect_columns.ts',
				'src/lib/modules/import/sheets_link.ts',
				'src/lib/modules/uploads/upload.ts',
				'src/lib/server/remote.ts',
				'src/lib/server/crypto/**/*.ts',
			],
			exclude: ['**/*.test.ts', '**/*.stories.svelte'],
			thresholds: {
				statements: 80,
				branches: 80,
				functions: 80,
				lines: 80,
			},
		},
		projects: [
			{
				extends: true,
				test: {
					name: 'client',
					// Sequential project groups avoid races in shared SvelteKit generated state.
					sequence: { groupOrder: 0 },
					// Retry once: browser-mode interaction tests can drop a simulated event
					// under CI load. Play functions already gate keystrokes on focus to fix
					// the root cause; this is a documented safety net so a single stray drop
					// in any story doesn't redden CI.
					retry: 1,
					browser: {
						enabled: true,
						provider: playwright({ launchOptions: sharedChromeLaunchOptions }),
						instances: [{ browser: 'chromium', headless: true }],
						// Fixed API port so the two browser projects (client + storybook) bind
						// distinct Vitest servers instead of racing for a default port when both
						// run under `test --coverage`.
						api: {
							host: '127.0.0.1',
							port: development.vitestClientPort,
							strictPort: true,
						},
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
				},
			},
			{
				extends: true,
				test: {
					name: 'server',
					sequence: { groupOrder: 1 },
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
				},
			},
			{
				extends: true,
				plugins: [
					storybookTest({
						configDir: path.join(dirname, '.storybook'),
					}),
				],
				test: {
					name: 'storybook',
					sequence: { groupOrder: 2 },
					// See the client project: retry once as a safety net for browser-mode
					// interaction flakiness; the real fix is in the story play functions.
					retry: 1,
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({ launchOptions: sharedChromeLaunchOptions }),
						instances: [{ browser: 'chromium' }],
						api: {
							host: '127.0.0.1',
							port: development.vitestStorybookPort,
							strictPort: true,
						},
					},
				},
			},
		],
	},
});
