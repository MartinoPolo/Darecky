#!/usr/bin/env node
/**
 * Read-only mobile wishlist sheet acceptance harness.
 *
 * Requires an already-running, explicitly assigned local app. The harness signs in to seeded
 * fixtures, opens/closes sheets, changes only ephemeral view/selection state, and never invokes
 * a gift, wishlist, reservation, copy, delete, or bulk mutation.
 *
 * Usage:
 *   node scripts/verify-wishlist-sheets.mjs --base http://localhost:8305
 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const arg = (name) => {
	const index = args.indexOf(`--${name}`);
	return index < 0 ? undefined : args[index + 1];
};
const requiredEnvironment = ['SEED_PASSWORD', 'TURNSTILE_TEST_TOKEN'];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);
if (missingEnvironment.length > 0) {
	throw new Error(`Missing required environment variable(s): ${missingEnvironment.join(', ')}`);
}
const { SEED_PASSWORD: password } = process.env;
const turnstileToken = process.env.TURNSTILE_TEST_TOKEN;

const base = arg('base') ?? process.env.MPX_APP_URL ?? process.env.PLAYWRIGHT_BASE_URL;
if (!base) {
	throw new Error('No assigned URL. Pass --base or set MPX_APP_URL/PLAYWRIGHT_BASE_URL.');
}
const origin = new URL(base).origin;
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) {
	throw new Error(`Refusing non-loopback target: ${origin}`);
}
// Better Auth validates Origin. Default it to the assigned app, never to another checkout's port.
const authOrigin = arg('auth-origin') ?? process.env.ORIGIN ?? origin;
const outDir = resolve(arg('out') ?? 'test-results/wishlist-sheets');
await mkdir(outDir, { recursive: true });

const WIDTHS = [390, 320];
const HEIGHT = 844;
const TOLERANCE = 0.8;
const records = [];
const diagnostics = [];
let activeRecord = null;

function near(actual, expected, tolerance = TOLERANCE) {
	return Math.abs(actual - expected) <= tolerance;
}
function recordCheck(condition, message) {
	if (!condition) {
		activeRecord.failures.push(message);
	}
}
async function settle(page) {
	await page.getByTestId('wishlist-page-shell').waitFor({ state: 'visible' });
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
	});
}
async function settleSheet(sheet) {
	await sheet.waitFor({ state: 'visible' });
	await sheet.evaluate(async (element) => {
		await Promise.all(
			element.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined)),
		);
	});
}
async function closeSheets(page) {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const visible = page.locator('[data-slot="sheet-content"]:visible');
		if ((await visible.count()) === 0) {
			return;
		}
		await page.keyboard.press('Escape');
		await visible
			.first()
			.waitFor({ state: 'hidden' })
			.catch(() => undefined);
	}
}
function safeName(value) {
	return value
		.replaceAll(/[^a-z0-9-]+/gi, '-')
		.replaceAll(/^-|-$/g, '')
		.toLowerCase();
}

async function sheetMetrics(sheet) {
	return sheet.evaluate((element) => {
		const style = getComputedStyle(element);
		const rect = element.getBoundingClientRect();
		const header = element.querySelector(':scope > [data-slot="sheet-header"]');
		const close = element.querySelector('[data-slot="sheet-close"]');
		const headerRect = header?.getBoundingClientRect();
		const headerStyle = header ? getComputedStyle(header) : null;
		const closeRect = close?.getBoundingClientRect();
		return {
			className: element.className,
			rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
			border: {
				top: parseFloat(style.borderTopWidth),
				right: parseFloat(style.borderRightWidth),
				bottom: parseFloat(style.borderBottomWidth),
				left: parseFloat(style.borderLeftWidth),
			},
			radius: {
				topLeft: parseFloat(style.borderTopLeftRadius),
				topRight: parseFloat(style.borderTopRightRadius),
				bottomRight: parseFloat(style.borderBottomRightRadius),
				bottomLeft: parseFloat(style.borderBottomLeftRadius),
			},
			header:
				headerRect && headerStyle
					? {
							x: headerRect.x,
							width: headerRect.width,
							padding: {
								top: parseFloat(headerStyle.paddingTop),
								right: parseFloat(headerStyle.paddingRight),
								bottom: parseFloat(headerStyle.paddingBottom),
								left: parseFloat(headerStyle.paddingLeft),
							},
							borderBottom: parseFloat(headerStyle.borderBottomWidth),
						}
					: null,
			close: closeRect
				? {
						x: closeRect.x,
						y: closeRect.y,
						width: closeRect.width,
						height: closeRect.height,
					}
				: null,
		};
	});
}

async function actionMenuMetrics(body) {
	return body.evaluate((element) => {
		const style = getComputedStyle(element);
		const rect = element.getBoundingClientRect();
		const buttons = [...element.querySelectorAll('button, a')].filter((button) => {
			const buttonRect = button.getBoundingClientRect();
			return (
				buttonRect.width > 0 &&
				buttonRect.height > 0 &&
				!button.closest('[data-slot="sheet-header"]')
			);
		});
		function firstTextRect(surface) {
			const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				if (!(node.textContent ?? '').trim()) {
					continue;
				}
				if (node.parentElement?.closest('.sr-only')) {
					continue;
				}
				const range = document.createRange();
				range.selectNodeContents(node);
				const textRect = range.getBoundingClientRect();
				if (textRect.width > 0) {
					return { x: textRect.x, width: textRect.width };
				}
			}
			return null;
		}
		return {
			rect: { x: rect.x, width: rect.width },
			padding: {
				top: parseFloat(style.paddingTop),
				right: parseFloat(style.paddingRight),
				bottom: parseFloat(style.paddingBottom),
				left: parseFloat(style.paddingLeft),
			},
			rows: buttons.map((button) => {
				const row = button.getBoundingClientRect();
				const surface = button.querySelector(':scope > .elevation-surface');
				const surfaceStyle = surface ? getComputedStyle(surface) : null;
				const icon = surface?.querySelector('svg[data-icon="inline-start"], svg');
				const iconRect = icon?.getBoundingClientRect();
				return {
					text: (button.textContent ?? '').replaceAll(/\s+/g, ' ').trim(),
					x: row.x,
					width: row.width,
					height: row.height,
					hasSurface: surface !== null,
					justify: surfaceStyle?.justifyContent ?? null,
					iconX: iconRect?.x ?? null,
					label: surface ? firstTextRect(surface) : null,
				};
			}),
		};
	});
}

async function captureSheet(page, options) {
	const {
		width,
		id,
		trigger,
		open,
		expectedTitle,
		actionBody,
		contentChecks = [],
		note = '',
	} = options;
	await closeSheets(page);
	activeRecord = {
		id,
		width,
		trigger,
		expectedTitle,
		actualTitle: '',
		note,
		actionTexts: [],
		failures: [],
		screenshot: resolve(outDir, `${width}-${safeName(id)}.png`),
	};
	try {
		await open();
		const visibleSheets = page.locator('[data-slot="sheet-content"]:visible');
		recordCheck(
			(await visibleSheets.count()) === 1,
			`expected one visible sheet, found ${await visibleSheets.count()}`,
		);
		const sheet = visibleSheets.last();
		await settleSheet(sheet);
		const title = sheet.locator('[data-slot="sheet-title"]');
		activeRecord.actualTitle = ((await title.textContent()) ?? '').trim();
		recordCheck(activeRecord.actualTitle.length > 0, 'sheet title is empty');
		if (expectedTitle) {
			recordCheck(
				activeRecord.actualTitle === expectedTitle,
				`title ${JSON.stringify(activeRecord.actualTitle)} != ${JSON.stringify(expectedTitle)}`,
			);
		}

		const metrics = await sheetMetrics(sheet);
		activeRecord.metrics = metrics;
		recordCheck(
			metrics.className.includes('wishlist-bottom-sheet'),
			'does not use shared WishlistBottomSheet marker',
		);
		recordCheck(near(metrics.rect.x, 8), `left inset ${metrics.rect.x}px != 8px`);
		recordCheck(
			near(width - metrics.rect.x - metrics.rect.width, 8),
			`right inset ${width - metrics.rect.x - metrics.rect.width}px != 8px`,
		);
		recordCheck(near(metrics.border.top, 2.5), `top border ${metrics.border.top}px != 2.5px`);
		recordCheck(
			near(metrics.border.left, 2.5),
			`left border ${metrics.border.left}px != 2.5px`,
		);
		recordCheck(
			near(metrics.border.right, 2.5),
			`right border ${metrics.border.right}px != 2.5px`,
		);
		recordCheck(
			near(metrics.border.bottom, 0),
			`bottom border ${metrics.border.bottom}px != 0px`,
		);
		recordCheck(
			metrics.radius.topLeft >= 12 && metrics.radius.topRight >= 12,
			`top corners are not rounded (${metrics.radius.topLeft}/${metrics.radius.topRight}px)`,
		);
		recordCheck(
			near(metrics.radius.bottomLeft, 0) && near(metrics.radius.bottomRight, 0),
			`bottom corners must be square (${metrics.radius.bottomLeft}/${metrics.radius.bottomRight}px)`,
		);
		recordCheck(metrics.header !== null, 'missing direct shared header');
		if (metrics.header) {
			recordCheck(
				near(metrics.header.padding.left, 16) && near(metrics.header.padding.right, 56),
				`header horizontal padding is ${metrics.header.padding.left}/${metrics.header.padding.right}px, expected 16px plus 56px close-button reserve`,
			);
			recordCheck(
				near(metrics.header.padding.top, 12) && near(metrics.header.padding.bottom, 12),
				`header vertical padding is ${metrics.header.padding.top}/${metrics.header.padding.bottom}px, expected 12px`,
			);
			recordCheck(
				near(metrics.header.borderBottom, 1),
				`header divider ${metrics.header.borderBottom}px != 1px`,
			);
			recordCheck(
				near(metrics.header.x, metrics.rect.x + metrics.border.left),
				'header divider does not begin at inner left edge',
			);
			recordCheck(
				near(
					metrics.header.width,
					metrics.rect.width - metrics.border.left - metrics.border.right,
				),
				'header divider is not full inner width',
			);
		}
		recordCheck(metrics.close !== null, 'missing close control');
		if (metrics.close) {
			recordCheck(
				near(metrics.close.width, 40) && near(metrics.close.height, 40),
				`close is ${metrics.close.width}x${metrics.close.height}, expected 40x40`,
			);
		}

		if (actionBody) {
			const body = actionBody(sheet);
			recordCheck(
				(await body.count()) === 1,
				`action body locator matched ${await body.count()} elements`,
			);
			if ((await body.count()) === 1) {
				const menu = await actionMenuMetrics(body);
				activeRecord.actionMenu = menu;
				activeRecord.actionTexts = menu.rows.map((row) => row.text);
				recordCheck(
					['top', 'right', 'bottom', 'left'].every((side) => near(menu.padding[side], 8)),
					`action body padding is ${JSON.stringify(menu.padding)}, expected 8px`,
				);
				recordCheck(menu.rows.length > 0, 'action menu has no rows');
				for (const [index, row] of menu.rows.entries()) {
					recordCheck(
						row.height >= 47.5,
						`row ${index + 1} height ${row.height}px < 48px`,
					);
					recordCheck(row.hasSurface, `row ${index + 1} lacks inner elevation surface`);
					recordCheck(
						row.justify === 'flex-start',
						`row ${index + 1} inner surface is ${row.justify}, expected flex-start`,
					);
					recordCheck(
						near(row.x, menu.rect.x + menu.padding.left),
						`row ${index + 1} left edge does not match body padding`,
					);
					recordCheck(
						near(row.x + row.width, menu.rect.x + menu.rect.width - menu.padding.right),
						`row ${index + 1} right edge does not match body padding`,
					);
				}
				const iconRows = menu.rows.filter(
					(row) => row.iconX !== null && row.label !== null,
				);
				if (iconRows.length > 1) {
					const iconXs = iconRows.map((row) => row.iconX);
					const labelXs = iconRows.map((row) => row.label.x);
					recordCheck(
						Math.max(...iconXs) - Math.min(...iconXs) <= 1,
						`icon column varies by ${Math.max(...iconXs) - Math.min(...iconXs)}px`,
					);
					recordCheck(
						Math.max(...labelXs) - Math.min(...labelXs) <= 1,
						`label column varies by ${Math.max(...labelXs) - Math.min(...labelXs)}px`,
					);
				}
			}
		}
		for (const checkContent of contentChecks) {
			await checkContent(sheet, activeRecord);
		}
		await page.screenshot({ path: activeRecord.screenshot });
	} catch (error) {
		activeRecord.failures.push(
			`execution: ${error instanceof Error ? error.message : String(error)}`,
		);
		await page.screenshot({ path: activeRecord.screenshot }).catch(() => undefined);
	}
	activeRecord.result = activeRecord.failures.length === 0 ? 'PASS' : 'FAIL';
	records.push(activeRecord);
	activeRecord = null;
	await closeSheets(page);
}

const actionBodyBy = (selector) => (sheet) => sheet.locator(selector);
const roleCheck =
	({ required = [], forbidden = [] }) =>
	async (sheet, record) => {
		const text = (await sheet.textContent()) ?? '';
		for (const pattern of required) {
			recordCheck(pattern.test(text), `role content missing ${pattern}`);
		}
		for (const pattern of forbidden) {
			recordCheck(!pattern.test(text), `role content unexpectedly contains ${pattern}`);
		}
		record.roleContent = text.replaceAll(/\s+/g, ' ').trim();
	};

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({
	viewport: { width: 390, height: HEIGHT },
	hasTouch: true,
});
const response = await context.request.post(`${origin}/api/auth/sign-in/email`, {
	headers: { Origin: authOrigin, 'x-captcha-response': turnstileToken },
	data: { email: 'martin@test.cz', password },
});
if (!response.ok()) {
	throw new Error(`Seed login failed (${response.status()}): ${await response.text()}`);
}
const page = await context.newPage();
page.on('pageerror', (error) => diagnostics.push(`pageerror ${page.url()}: ${error.message}`));
page.on('console', (message) => {
	if (message.type() === 'error') {
		diagnostics.push(`console ${page.url()}: ${message.text()}`);
	}
});
page.on('requestfailed', (request) =>
	diagnostics.push(
		`requestfailed ${request.method()} ${new URL(request.url()).pathname}: ${request.failure()?.errorText ?? 'unknown'}`,
	),
);
page.on('response', (result) => {
	if (result.status() >= 400) {
		diagnostics.push(
			`HTTP ${result.status()} ${result.request().method()} ${new URL(result.url()).pathname}`,
		);
	}
});

async function goto(path, width) {
	await page.setViewportSize({ width, height: HEIGHT });
	await page.goto(`${origin}${path}`, { waitUntil: 'load' });
	await settle(page);
}
async function selectMode(mode) {
	await page.getByTestId(`gift-view-${mode}`).click();
	await page.locator(`[data-wishlist-gift-collection][data-view-mode="${mode}"]`).waitFor();
	await settle(page);
}
async function giftCapture(width, role, route, mode, checks) {
	await goto(route, width);
	await selectMode(mode);
	const item = page
		.locator('[data-gift-item]:visible')
		.filter({ has: page.getByTestId('gift-more-actions') })
		.first();
	const giftTitle = ((await item.getByRole('heading', { level: 3 }).textContent()) ?? '').trim();
	await captureSheet(page, {
		width,
		id: `gift-more-${role}-${mode}`,
		trigger: `${route} ${mode} [data-testid=gift-more-actions]`,
		expectedTitle: giftTitle,
		open: () => item.getByTestId('gift-more-actions').click(),
		actionBody: actionBodyBy(':scope > [data-slot="sheet-header"] + div'),
		contentChecks: [roleCheck(checks)],
		note: `${role} role-specific gift actions`,
	});
}

try {
	for (const width of WIDTHS) {
		await goto('/w/knihy026', width);
		const heroTrigger = page
			.getByTestId('wishlist-mobile-hero')
			.getByTestId('mobile-header-more-trigger');
		const heroTitle = await heroTrigger.getAttribute('aria-label');
		await captureSheet(page, {
			width,
			id: 'hero-more-moderated',
			trigger: '[data-testid=wishlist-mobile-hero] [data-testid=mobile-header-more-trigger]',
			expectedTitle: heroTitle,
			open: () => heroTrigger.click(),
			actionBody: actionBodyBy(':scope > [data-slot="sheet-header"] + div'),
		});

		const toolbarMore = page.getByTestId('mobile-more-trigger');
		await captureSheet(page, {
			width,
			id: 'toolbar-more-moderated',
			trigger: '[data-testid=mobile-more-trigger]',
			expectedTitle: await toolbarMore.getAttribute('aria-label'),
			open: () => toolbarMore.click(),
			actionBody: actionBodyBy(':scope > [data-slot="sheet-header"] + div'),
		});

		await captureSheet(page, {
			width,
			id: 'toolbar-display-sort-moderated',
			trigger: '[data-testid=mobile-display-trigger]',
			open: () => page.getByTestId('mobile-display-trigger').click(),
			note: 'form sheet: sort controls remain distinct',
		});
		await captureSheet(page, {
			width,
			id: 'toolbar-display-filter-moderated',
			trigger:
				'[data-testid=mobile-display-trigger] then [data-testid=mobile-sheet-filter-switch]',
			open: async () => {
				await page.getByTestId('mobile-display-trigger').click();
				const sheet = page.locator('[data-slot="sheet-content"]:visible');
				await settleSheet(sheet);
				await sheet.getByTestId('mobile-sheet-filter-switch').click();
			},
			note: 'form sheet: filter controls remain distinct',
		});

		await giftCapture(width, 'moderated', '/w/knihy026', 'card', {
			required: [
				/Upravit dárek|Edit gift/i,
				/Priorita|Priority/i,
				/Kategorie|Category/i,
				/přijat|received/i,
			],
			forbidden: [],
		});
		await giftCapture(width, 'moderated', '/w/knihy026', 'list', {
			required: [
				/Upravit dárek|Edit gift/i,
				/Priorita|Priority/i,
				/Kategorie|Category/i,
				/přijat|received/i,
			],
			forbidden: [],
		});
		await giftCapture(width, 'recipient', '/w/xmas2026', 'card', {
			required: [
				/Upravit dárek|Edit gift/i,
				/Priorita|Priority/i,
				/Kategorie|Category/i,
				/přijat|received/i,
			],
			forbidden: [/Rezervovat|Reserve$/im],
		});
		await giftCapture(width, 'followed', '/w/svatekjn', 'card', {
			required: [
				/Otevřít hlavní odkaz|Open main link/i,
				/Kopírovat hlavní odkaz|Copy main link/i,
				/Zrušit rezervaci|Cancel reservation/i,
			],
			forbidden: [
				/Upravit dárek|Edit gift/i,
				/Priorita|Priority/i,
				/Kategorie|Category/i,
				/přijat|received/i,
			],
		});

		await goto('/w/knihy026', width);
		await page.getByTestId('mobile-more-trigger').click();
		const moreSheet = page.locator('[data-slot="sheet-content"]:visible');
		await settleSheet(moreSheet);
		await moreSheet.getByRole('button', { name: /Nástroje výběru|Selection tools/i }).click();
		await page.locator('[data-gift-item]:visible').first().click();
		const selectionTrigger = page
			.getByTestId('wishlist-toolbar')
			.locator('button[aria-haspopup="dialog"]')
			.first();
		const openSelection = () => selectionTrigger.click();
		await captureSheet(page, {
			width,
			id: 'selection-actions-root',
			trigger: 'toolbar selection-actions dialog trigger',
			open: openSelection,
			actionBody: actionBodyBy(':scope > [data-slot="sheet-header"] + div'),
		});

		for (const action of ['priority', 'category', 'imageFit', 'imageBackground']) {
			await captureSheet(page, {
				width,
				id: `selection-nested-${action}`,
				trigger: `selection actions > [data-mobile-bulk-action=${action}]`,
				open: async () => {
					await openSelection();
					const sheet = page.locator('[data-slot="sheet-content"]:visible');
					await settleSheet(sheet);
					await sheet.locator(`[data-mobile-bulk-action="${action}"]`).click();
				},
				note: 'nested form sheet; no radio choice activated',
			});
		}

		await captureSheet(page, {
			width,
			id: 'bulk-copy-fallback',
			trigger: 'selection actions > [data-mobile-bulk-action=copy]',
			open: async () => {
				await openSelection();
				const sheet = page.locator('[data-slot="sheet-content"]:visible');
				await settleSheet(sheet);
				await sheet.locator('[data-mobile-bulk-action="copy"]').click();
				await page.locator('[data-slot="sheet-content"]:visible').waitFor();
			},
			note: 'form fallback opened only; confirm/copy never activated',
		});
	}

	for (const width of WIDTHS) {
		const group = records.filter((record) => record.width === width);
		const images = await Promise.all(
			group.map(async (record) => ({
				record,
				data: await readFile(record.screenshot)
					.then((value) => value.toString('base64'))
					.catch(() => ''),
			})),
		);
		const contact = await context.newPage();
		await contact.setViewportSize({ width: 1400, height: 900 });
		await contact.setContent(`<!doctype html><style>
			body{margin:0;padding:20px;background:#e5e7eb;font:16px system-ui;color:#111827}
			h1{margin:0 0 16px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
			.card{background:white;padding:10px;border:2px solid #111827;border-radius:10px;overflow:hidden}
			.meta{font-weight:700;margin-bottom:8px}.pass{color:#087f23}.fail{color:#b42318}
			img{display:block;width:100%;height:auto;border:1px solid #9ca3af}
		</style><h1>Wishlist sheets — ${width}px</h1><div class="grid">${images
			.map(
				({ record, data }) =>
					`<div class="card"><div class="meta ${record.result.toLowerCase()}">${record.result} · ${record.id}<br>${record.actualTitle}</div>${data ? `<img src="data:image/png;base64,${data}">` : '<p>Screenshot unavailable</p>'}</div>`,
			)
			.join('')}</div>`);
		await contact.screenshot({ path: resolve(outDir, `CONTACT-${width}.png`), fullPage: true });
		await contact.close();
	}
} finally {
	await context.close();
	await browser.close();
}

const report = {
	target: origin,
	generatedAt: new Date().toISOString(),
	viewportWidths: WIDTHS,
	captureCount: records.length,
	passCount: records.filter((record) => record.result === 'PASS').length,
	failCount: records.filter((record) => record.result === 'FAIL').length,
	records,
	diagnostics: [...new Set(diagnostics)],
};
await writeFile(resolve(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const markdown = [
	'# Wishlist mobile sheet acceptance',
	'',
	`Target: ${origin}`,
	`Generated: ${report.generatedAt}`,
	`Captures recorded: ${report.captureCount} | Pass: ${report.passCount} | Fail: ${report.failCount}`,
	'',
	'| Width | Surface | Trigger | Title | Result | Screenshot |',
	'|---:|---|---|---|---|---|',
	...records.map(
		(record) =>
			`| ${record.width} | ${record.id} | ${record.trigger} | ${record.actualTitle} | ${record.result} | ${record.screenshot} |`,
	),
	'',
	'## Failures',
	...records.flatMap((record) =>
		record.failures.map((failure) => `- **${record.width}/${record.id}:** ${failure}`),
	),
	...(records.every((record) => record.failures.length === 0) ? ['- None'] : []),
	'',
	'## Diagnostics',
	...(report.diagnostics.length ? report.diagnostics.map((value) => `- ${value}`) : ['- None']),
	'',
].join('\n');
await writeFile(resolve(outDir, 'REPORT.md'), markdown);

if (report.failCount > 0) {
	console.error(
		`FAIL: ${report.failCount}/${report.captureCount} sheet captures failed; see ${resolve(outDir, 'REPORT.md')}`,
	);
	process.exitCode = 1;
} else {
	console.log(
		`PASS: ${report.passCount}/${report.captureCount} sheet captures; see ${resolve(outDir, 'REPORT.md')}`,
	);
}
