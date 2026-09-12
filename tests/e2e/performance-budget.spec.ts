import { test, expect, type Page } from '@playwright/test';
import { waitForAppHydration } from './fixtures/auth-helpers.js';

/**
 * Initial-load performance budget for the public entry pages (issue #106).
 *
 * Guards two things, before any user interaction:
 * 1. Landing (/) and login (/login) never download authenticated app code
 *    (dashboards, settings, import wizard, wishlist management, app shell).
 * 2. The initial JavaScript request count and transferred bytes stay within
 *    the documented budget.
 *
 * Budget numbers, rationale, and re-measurement instructions live in
 * docs/performance-budget.md. The suite runs against the Vite dev server
 * locally and in CI, so modules arrive unbundled — the numbers
 * are dev-mode module counts/bytes, not production chunk sizes. They are
 * deterministic for a given source tree, which is what makes them a usable
 * regression gate for code fan-out.
 */

// Bounded settle window after the page is interactive: long enough to catch any
// eager `preloadCode()` fan-out (which fires immediately after hydration) and the
// 100–200ms requestIdleCallback window, without `networkidle` (SSE surfaces hang).
const POST_HYDRATION_SETTLE_MILLISECONDS = 2_500;

// Code that public/auth pages must never request before user intent.
// Matched against decoded request URLs (Vite dev serves source paths directly).
const FORBIDDEN_MODULE_PATH_FRAGMENTS = [
	'/routes/(app)/', // all authenticated routes: dashboards, settings, /w/ management
	'/lib/modules/import/', // import wizard
	'/lib/modules/wishlists/', // wishlist management module
	'/lib/modules/gifts/', // gift management module
	'/lib/modules/notifications/', // authenticated shell notifications
	// Authenticated app-shell chrome only. NOT the whole navbar/ folder — LogoMark
	// there is a dependency-light shared logo used by the public LandingNav/Footer
	// and the auth pages, so guarding the folder would false-positive. Navbar.svelte
	// is the authenticated shell root and transitively pulls UserMenu / MobileNav /
	// NavDropdown, so gating it covers the real app chrome.
	'/lib/components/blocks/navbar/Navbar.svelte', // authenticated app shell root
	'/lib/components/blocks/navbar/UserMenu.svelte',
	'/lib/components/blocks/navbar/MobileNav.svelte',
	'/lib/components/blocks/navbar/NavDropdown.svelte',
];

// The landing demo (issue #218, REQ-3) renders the real `GiftCard`/`GiftListItem` so the
// demo can never drift from the shipped product, and REQ-10 keeps it server-rendered. That
// makes this exact set of gift/wishlist presentation modules public code by design.
// Enumerated file by file rather than as a folder-wide hole: gift/wishlist *management*
// (drafts, deletion rules, dashboards, wishlist creation) and every `*.remote.ts` data
// module stays forbidden, so a new fan-out still fails the gate. Landing-only — the login
// page passes no exceptions and remains fully strict.
const LANDING_DEMO_PUBLIC_MODULE_PATHS = [
	'/lib/modules/gifts/types.ts',
	'/lib/modules/gifts/gift_display.ts',
	'/lib/modules/gifts/gift_display_state.ts',
	'/lib/modules/gifts/gift_url.ts',
	'/lib/modules/gifts/gifts.context.svelte.ts',
	// Pulled in transitively by gifts.context.svelte.ts since the reserved-band
	// ordering refactor (#227): pure section/ordering computation, no server data.
	'/lib/modules/gifts/gift_ordering.ts',
	'/lib/modules/wishlists/types.ts',
	'/lib/modules/wishlists/wishlist_capabilities.ts',
	// Added when the demo gained the real `WishlistHeader` above the panes: both are
	// pure presentation helpers (status badge labels, day-granular countdown string).
	'/lib/modules/wishlists/dashboard_types.ts',
	'/lib/modules/wishlists/event_countdown.ts',
] as const;

// Locale-resilient login-link selector. The base locale is cs, so the landing
// login link renders "Přihlásit se" (cs) / "Log in" (en) — never match on that
// text. Instead match the anchor by href: LandingNav uses
// localizeInternalHref(resolve('/login')), which for base locale cs yields
// "/login" (no locale prefix). `$=` also tolerates a locale prefix like /en/login.
function loginLink(page: Page) {
	return page.locator('a[href$="/login"], a[href="/login"]').first();
}

interface JavaScriptLoadInventory {
	requestCount: number;
	totalBytes: number;
	urls: string[];
}

interface InitialLoadBudget {
	maxJavaScriptRequests: number;
	maxJavaScriptBytes: number;
}

// Match the reviewed public-demo baseline and headroom in docs/performance-budget.md.
const LANDING_BUDGET: InitialLoadBudget = {
	maxJavaScriptRequests: 444,
	maxJavaScriptBytes: 17_102_094,
};
const LOGIN_BUDGET: InitialLoadBudget = {
	maxJavaScriptRequests: 202,
	maxJavaScriptBytes: 12_110_852,
};

async function collectInitialJavaScript(
	page: Page,
	path: string,
	readyLocator: (page: Page) => ReturnType<Page['locator']>,
): Promise<JavaScriptLoadInventory> {
	const urls: string[] = [];
	const bodySizePromises: Promise<number>[] = [];

	page.on('response', (response) => {
		const request = response.request();
		const contentType = response.headers()['content-type'] ?? '';
		const isJavaScript =
			request.resourceType() === 'script' || contentType.includes('javascript');
		if (!isJavaScript) {
			return;
		}
		urls.push(decodeURIComponent(response.url()));
		bodySizePromises.push(
			response
				.body()
				.then((body) => body.byteLength)
				// Redirects / aborted responses have no body — count as zero.
				.catch(() => 0),
		);
	});

	await page.goto(path);
	await expect(readyLocator(page)).toBeVisible({ timeout: 30_000 });
	await waitForAppHydration(page);
	// Deliberately NOT networkidle (see file header) — a fixed, bounded settle
	// window that outlasts hydration and any idle-time preload heuristics.
	await page.waitForTimeout(POST_HYDRATION_SETTLE_MILLISECONDS);

	const bodySizes = await Promise.all(bodySizePromises);
	const totalBytes = bodySizes.reduce((sum, size) => sum + size, 0);

	return { requestCount: urls.length, totalBytes, urls };
}

function findForbiddenRequests(
	urls: readonly string[],
	allowedModulePaths: readonly string[] = [],
): string[] {
	return urls.filter(
		(url) =>
			FORBIDDEN_MODULE_PATH_FRAGMENTS.some((fragment) => url.includes(fragment)) &&
			!allowedModulePaths.some((allowedPath) => url.includes(allowedPath)),
	);
}

test.describe('Initial-load performance budget', () => {
	test('landing page requests no authenticated app code and stays within budget', async ({
		page,
	}) => {
		const inventory = await collectInitialJavaScript(page, '/', (p) =>
			p.getByRole('heading', { level: 1 }).first(),
		);

		console.log(
			`[budget] landing: ${inventory.requestCount} JS requests, ${inventory.totalBytes} bytes`,
		);

		expect(findForbiddenRequests(inventory.urls, LANDING_DEMO_PUBLIC_MODULE_PATHS)).toEqual([]);
		expect(inventory.requestCount).toBeLessThanOrEqual(LANDING_BUDGET.maxJavaScriptRequests);
		expect(inventory.totalBytes).toBeLessThanOrEqual(LANDING_BUDGET.maxJavaScriptBytes);
	});

	test('login page requests no authenticated app code and stays within budget', async ({
		page,
	}) => {
		const inventory = await collectInitialJavaScript(page, '/login', (p) =>
			p.getByRole('textbox', { name: /e-?mail/i }),
		);

		console.log(
			`[budget] login: ${inventory.requestCount} JS requests, ${inventory.totalBytes} bytes`,
		);

		expect(findForbiddenRequests(inventory.urls)).toEqual([]);
		expect(inventory.requestCount).toBeLessThanOrEqual(LOGIN_BUDGET.maxJavaScriptRequests);
		expect(inventory.totalBytes).toBeLessThanOrEqual(LOGIN_BUDGET.maxJavaScriptBytes);
	});

	test('hover intent preloads the login route code from the landing page', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({
			timeout: 30_000,
		});
		// The h1 is server-rendered and can become visible before SvelteKit installs its
		// hover-preload listener. Under a busy CI Vite server, a fixed delay can still
		// finish during hydration. Retry the actual user intent instead: moving away
		// first guarantees each attempt emits a fresh mousemove over the link, while
		// the request assertion still proves that hover (not the later click) loaded
		// the login route module.
		await expect(async () => {
			const loginModuleRequest = page.waitForRequest(
				(request) => decodeURIComponent(request.url()).includes('/routes/(auth)/login/'),
				{ timeout: 5_000 },
			);
			await page.mouse.move(0, 0);
			await loginLink(page).hover();
			await loginModuleRequest;
		}).toPass({ timeout: 30_000, intervals: [250, 500, 1_000] });

		// Navigation after intent-preload must still work end to end.
		await loginLink(page).click();
		await expect(page).toHaveURL(/\/login/);
		await expect(page.getByRole('textbox', { name: /e-?mail/i })).toBeVisible();
	});
});
