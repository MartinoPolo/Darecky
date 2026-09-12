import { sharedChromeLaunchOptions } from './browser-automation.mjs';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

export function median(values) {
	if (!values.length) {
		return null;
	}
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function compressedSizes(input) {
	const data = Buffer.isBuffer(input) ? input : Buffer.from(input);
	return {
		raw: data.length,
		gzip: gzipSync(data).length,
		brotli: brotliCompressSync(data).length,
	};
}

const metricNames = [
	'jsBrotliBytes',
	'jsRequestCount',
	'cssBrotliBytes',
	'cssRequestCount',
	'fcp',
	'lcp',
	'longTaskCount',
	'longTaskTotal',
	'longTaskMax',
];
const runtimeNames = new Set(['fcp', 'lcp', 'longTaskCount', 'longTaskTotal', 'longTaskMax']);
const STARTUP_SETTLE_MILLISECONDS = 2_500;

function value(report, route, metric) {
	return report?.routes?.[route]?.[metric] ?? null;
}

export function compareReports(base, head) {
	const routes = [
		...new Set([
			...Object.keys(base?.routes ?? {}),
			...Object.keys(head?.routes ?? {}),
			'/',
			'/login',
		]),
	];
	return {
		base: base ?? null,
		head: head ?? null,
		routes: routes.map((route) => ({
			route,
			metrics: Object.fromEntries(
				metricNames.map((metric) => {
					const before = value(base, route, metric);
					const after = value(head, route, metric);
					const delta = before == null || after == null ? null : after - before;
					const relative = delta == null || before === 0 ? null : delta / before;
					const threshold = runtimeNames.has(metric)
						? 0.15
						: metric.endsWith('BrotliBytes')
							? 0.1
							: null;
					return [
						metric,
						{
							base: before,
							head: after,
							delta,
							relative,
							warning: threshold != null && relative != null && relative >= threshold,
						},
					];
				}),
			),
		})),
	};
}

function format(number, decimals = 0) {
	return number == null
		? '—'
		: Number(number).toLocaleString('en-US', { maximumFractionDigits: decimals });
}

export function renderMarkdown(comparison) {
	const lines = [
		'<!-- production-performance-report -->',
		'# Production performance delta report',
		'',
	];
	for (const [label, report] of [
		['Base', comparison?.base],
		['Head', comparison?.head],
	]) {
		if (!report) {
			lines.push(`> ⚠️ **${label} report is missing.**`);
		} else if (report.error) {
			lines.push(`> ⚠️ **${label} collection failed:** ${report.error}`);
		}
	}
	lines.push(
		'',
		'| Route | Metric | Base | Head | Delta | Change |',
		'| --- | --- | ---: | ---: | ---: | ---: |',
	);
	for (const route of comparison?.routes ?? []) {
		for (const [name, metric] of Object.entries(route.metrics)) {
			const warning = metric.warning ? ' ⚠️' : '';
			const label =
				name === 'jsBrotliBytes'
					? 'startup-window JS Brotli bytes'
					: name === 'cssBrotliBytes'
						? 'startup-window CSS Brotli bytes'
						: name;
			lines.push(
				`| \`${route.route}\` | ${label}${warning} | ${format(metric.base, 1)} | ${format(metric.head, 1)} | ${metric.delta == null ? '—' : `${metric.delta >= 0 ? '+' : ''}${format(metric.delta, 1)}`} | ${metric.relative == null ? '—' : `${metric.relative >= 0 ? '+' : ''}${format(metric.relative * 100, 1)}%`} |`,
			);
		}
	}
	lines.push(
		'',
		'⚠️ Warnings identify relative regressions of **≥10% for startup-window JS/CSS Brotli bytes** or **≥15% for runtime metrics**.',
		'',
		'Asset totals cover a fixed 2.5-second post-load startup window, including dynamic work in that window.',
		'',
		'This report is **informational and non-blocking**. Raw Chromium diagnostics are not Lighthouse measurements or deployed-edge results.',
	);
	return `${lines.join('\n')}\n`;
}

function args(argv) {
	const result = { _: [] };
	for (let i = 0; i < argv.length; i++) {
		if (!argv[i].startsWith('--')) {
			result._.push(argv[i]);
		} else {
			result[argv[i].slice(2)] = argv[++i];
		}
	}
	return result;
}

async function run(command, commandArgs, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, commandArgs, { stdio: 'inherit', ...options });
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)),
		);
	});
}

export async function waitReady(url, child, signal) {
	const deadline = Date.now() + 60_000;
	while (Date.now() < deadline) {
		if (signal?.aborted) {
			throw signal.reason ?? new Error('Wrangler readiness cancelled');
		}
		if (child.exitCode != null) {
			throw new Error(`Wrangler exited with code ${child.exitCode}`);
		}
		try {
			if ((await fetch(url, { signal })).ok) {
				return;
			}
		} catch (error) {
			if (signal?.aborted) {
				throw signal.reason ?? error;
			}
		}
		await new Promise((resolve, reject) => {
			const onAbort = () => {
				clearTimeout(timer);
				reject(signal.reason ?? new Error('Wrangler readiness cancelled'));
			};
			const timer = setTimeout(() => {
				signal?.removeEventListener('abort', onAbort);
				resolve();
			}, 500);
			signal?.addEventListener('abort', onAbort, { once: true });
		});
	}
	throw new Error('Wrangler did not become ready within 60 seconds');
}

async function terminateProcessTree(child) {
	if (!child?.pid || child.exitCode != null) {
		return;
	}
	if (process.platform === 'win32') {
		await new Promise((resolve) => {
			const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
				stdio: 'ignore',
			});
			killer.once('error', resolve);
			killer.once('exit', resolve);
		});
	} else {
		try {
			process.kill(-child.pid, 'SIGTERM');
		} catch {
			child.kill('SIGTERM');
		}
		await new Promise((resolve) => setTimeout(resolve, 1_000));
		if (child.exitCode == null) {
			try {
				process.kill(-child.pid, 'SIGKILL');
			} catch {
				child.kill('SIGKILL');
			}
		}
	}
}

async function findBuiltAsset(root, pathname) {
	const candidates = [
		join(root, pathname.replace(/^\//, '')),
		join(root, 'static', pathname.replace(/^\//, '')),
	];
	for (const candidate of candidates) {
		try {
			return await readFile(candidate);
		} catch {}
	}
	throw new Error(`Built asset not found: ${pathname}`);
}

async function collect(options) {
	const project = normalize(options.project);
	const output = normalize(options.output);
	const port = Number(options.port);
	const runs = Number(options.runs ?? 5);
	const report = {
		schemaVersion: 1,
		commit: options.commit,
		profile: {
			runs,
			viewport: { width: 390, height: 844 },
			cpuThrottling: 4,
			latencyMs: 150,
			downloadMbps: 1.6,
			cache: 'disabled',
			browser: 'Chromium',
			startupSettleMilliseconds: STARTUP_SETTLE_MILLISECONDS,
		},
		routes: {},
		assets: [],
	};
	let wrangler;
	let browser;
	const readiness = new AbortController();
	try {
		await run(process.platform === 'win32' ? 'pnpm.exe' : 'pnpm', ['run', 'build'], {
			cwd: project,
		});
		const wranglerArgs = [
			'node_modules/wrangler/bin/wrangler.js',
			'dev',
			'.svelte-kit/cloudflare/_worker.js',
			'--port',
			String(port),
			'--var',
			`ORIGIN:http://127.0.0.1:${port}`,
		];
		if (process.env.AUTH_SECRET) {
			wranglerArgs.push('--var', `AUTH_SECRET:${process.env.AUTH_SECRET}`);
		}
		wrangler = spawn(process.execPath, wranglerArgs, {
			cwd: project,
			stdio: 'inherit',
			detached: process.platform !== 'win32',
		});
		const wranglerSpawnFailure = new Promise((_, reject) => {
			wrangler.once('error', (error) => {
				readiness.abort(error);
				reject(error);
			});
		});
		await Promise.race([
			waitReady(`http://127.0.0.1:${port}/`, wrangler, readiness.signal),
			wranglerSpawnFailure,
		]);
		const { chromium } = await import('playwright');
		browser = await chromium.launch({ ...sharedChromeLaunchOptions, headless: true });
		for (const route of ['/', '/login']) {
			const samples = [];
			const routeAssets = new Set();
			for (let index = 0; index < runs; index++) {
				const context = await browser.newContext({
					viewport: { width: 390, height: 844 },
					serviceWorkers: 'block',
				});
				await context.addInitScript(() => {
					globalThis.__perf = { longTasks: [], lcp: 0 };
					new PerformanceObserver((list) =>
						globalThis.__perf.longTasks.push(
							...list.getEntries().map((entry) => entry.duration),
						),
					).observe({ type: 'longtask', buffered: true });
					new PerformanceObserver((list) => {
						const entries = list.getEntries();
						globalThis.__perf.lcp = entries.at(-1)?.startTime ?? 0;
					}).observe({ type: 'largest-contentful-paint', buffered: true });
				});
				const page = await context.newPage();
				const session = await context.newCDPSession(page);
				await session.send('Network.enable');
				await session.send('Network.setCacheDisabled', { cacheDisabled: true });
				await session.send('Network.emulateNetworkConditions', {
					offline: false,
					latency: 150,
					downloadThroughput: 1_600_000 / 8,
					uploadThroughput: 750_000 / 8,
				});
				await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
				const runAssets = new Set();
				page.on('response', (response) => {
					const url = new URL(response.url());
					if (
						url.origin === `http://127.0.0.1:${port}` &&
						/\.(?:js|css)$/.test(url.pathname)
					) {
						routeAssets.add(url.href);
						runAssets.add(url.href);
					}
				});
				await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'load' });
				await page.waitForTimeout(STARTUP_SETTLE_MILLISECONDS);
				const sample = await page.evaluate(() => {
					const fcp =
						performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
					const tasks = globalThis.__perf.longTasks;
					return {
						fcp,
						lcp: globalThis.__perf.lcp,
						longTaskCount: tasks.length,
						longTaskTotal: tasks.reduce((sum, item) => sum + item, 0),
						longTaskMax: Math.max(0, ...tasks),
					};
				});
				samples.push({ ...sample, assetUrls: [...runAssets] });
				await context.close();
			}
			const assets = [];
			for (const url of [...routeAssets].sort()) {
				const data = await findBuiltAsset(
					join(project, '.svelte-kit', 'cloudflare'),
					new URL(url).pathname,
				);
				assets.push({
					url,
					type: new URL(url).pathname.endsWith('.css') ? 'css' : 'js',
					...compressedSizes(data),
				});
			}
			const assetsByUrl = new Map(assets.map((asset) => [asset.url, asset]));
			const measuredSamples = samples.map((sample) => {
				const loadedAssets = sample.assetUrls
					.map((url) => assetsByUrl.get(url))
					.filter(Boolean);
				const jsAssets = loadedAssets.filter((asset) => asset.type === 'js');
				const cssAssets = loadedAssets.filter((asset) => asset.type === 'css');
				return {
					...sample,
					jsRequestCount: jsAssets.length,
					jsBrotliBytes: jsAssets.reduce((sum, asset) => sum + asset.brotli, 0),
					cssRequestCount: cssAssets.length,
					cssBrotliBytes: cssAssets.reduce((sum, asset) => sum + asset.brotli, 0),
				};
			});
			report.assets.push(...assets.map((asset) => ({ route, ...asset })));
			report.routes[route] = Object.fromEntries(
				metricNames.map((name) => [
					name,
					median(measuredSamples.map((sample) => sample[name])),
				]),
			);
		}
	} catch (error) {
		report.error = error instanceof Error ? (error.stack ?? error.message) : String(error);
	} finally {
		readiness.abort(new Error('Performance collection cleanup'));
		await browser?.close().catch(() => {});
		await terminateProcessTree(wrangler);
		await mkdir(dirname(output), { recursive: true });
		await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
	}
}

export async function compare(options) {
	let base = null,
		head = null;
	try {
		base = JSON.parse(await readFile(options.base, 'utf8'));
	} catch (error) {
		base = { error: `Missing or unreadable base report: ${error.message}` };
	}
	try {
		head = JSON.parse(await readFile(options.head, 'utf8'));
	} catch (error) {
		head = { error: `Missing or unreadable head report: ${error.message}` };
	}
	await mkdir(dirname(options.output), { recursive: true });
	await writeFile(options.output, renderMarkdown(compareReports(base, head)));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const options = args(process.argv.slice(2));
	if (options._[0] === 'collect') {
		await collect(options);
	} else if (options._[0] === 'compare') {
		await compare(options);
	} else {
		console.error('Usage: production-performance.mjs <collect|compare> [options]');
	}
}
