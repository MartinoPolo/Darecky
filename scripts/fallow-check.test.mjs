import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wrapperPath = path.join(repositoryRoot, 'scripts', 'fallow-check.js');

async function createFixture() {
	const root = await mkdtemp(path.join(tmpdir(), 'fallow-check-'));
	const scriptsDirectory = path.join(root, 'scripts');
	const packageDirectory = path.join(root, 'node_modules', 'fallow');
	await mkdir(path.join(packageDirectory, 'bin'), { recursive: true });
	await mkdir(scriptsDirectory, { recursive: true });
	await writeFile(path.join(scriptsDirectory, 'fallow-check.js'), await readFile(wrapperPath));
	await writeFile(
		path.join(packageDirectory, 'package.json'),
		JSON.stringify({ name: 'fallow', type: 'module', exports: { './bin/*': './bin/*' } }),
	);
	await writeFile(
		path.join(packageDirectory, 'bin', 'fallow'),
		`const expected = ['dead-code', '--fail-on-regression', '--regression-baseline', 'fallow-baselines/dead-code-regression.json', '--format', 'json', '--quiet'];
if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(expected)) {
  console.error('unexpected arguments: ' + JSON.stringify(process.argv.slice(2)));
  process.exit(2);
}
if (process.env.FAKE_STDERR) console.error(process.env.FAKE_STDERR);
if (process.env.FAKE_OUTPUT) process.stdout.write(process.env.FAKE_OUTPUT);
process.exit(Number(process.env.FAKE_STATUS ?? 1));
`,
	);
	return root;
}

async function runFixture(environment) {
	const root = await createFixture();
	try {
		return spawnSync(process.execPath, [path.join(root, 'scripts', 'fallow-check.js')], {
			cwd: root,
			encoding: 'utf8',
			env: { ...process.env, ...environment, PATH: '' },
		});
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

const result = (exceeded) =>
	JSON.stringify({
		unused_files: [],
		regression: {
			exceeded,
			current_total: exceeded ? 4 : 2,
			baseline_total: 3,
			delta: exceeded ? 1 : -1,
		},
	});

test('uses the local fallow entry without requiring pnpm on PATH and accepts normal exit 1', async () => {
	const run = await runFixture({ FAKE_OUTPUT: result(false), FAKE_STATUS: '1' });
	assert.equal(run.status, 0, run.stderr);
	assert.match(run.stdout, /Regression check passed: 2 issues/);
});

test('fails when the regression baseline is exceeded', async () => {
	const run = await runFixture({ FAKE_OUTPUT: result(true), FAKE_STATUS: '1' });
	assert.equal(run.status, 1);
	assert.match(run.stdout, /REGRESSION DETECTED/);
});

test('preserves stderr when fallow returns malformed JSON', async () => {
	const run = await runFixture({
		FAKE_OUTPUT: 'not json',
		FAKE_STDERR: 'fallow detail',
		FAKE_STATUS: '1',
	});
	assert.equal(run.status, 1);
	assert.match(run.stderr, /fallow detail/);
	assert.match(run.stderr, /failed to parse JSON output/);
});

test('fails closed and preserves stderr for operational failures', async () => {
	const run = await runFixture({ FAKE_STDERR: 'operational failure', FAKE_STATUS: '2' });
	assert.equal(run.status, 1);
	assert.match(run.stderr, /operational failure/);
	assert.doesNotMatch(run.stderr, /failed to parse JSON output/);
});
