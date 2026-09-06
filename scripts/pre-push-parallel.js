import { execSync } from 'node:child_process';
import { runParallelChecks } from './lib/run-parallel-checks.mjs';

const totalStart = performance.now();

console.log('Pre-push: typecheck and Fallow; full lint and test suites run in CI.');
execSync('pnpm exec svelte-kit sync', { stdio: 'inherit' });

const commands = [
	{ name: 'fallow', command: 'pnpm check:fallow' },
	{ name: 'typecheck', command: 'pnpm exec svelte-check --tsconfig ./tsconfig.json' },
];

const results = await runParallelChecks(commands);
const totalElapsed = ((performance.now() - totalStart) / 1000).toFixed(1);

let failed = false;
for (const { name, exitCode, output, durationSeconds } of results) {
	if (exitCode === 0) {
		console.log(`  \x1b[32m✓\x1b[0m ${name} \x1b[2m(${durationSeconds}s)\x1b[0m`);
	} else {
		failed = true;
		console.log(`  \x1b[31m✗\x1b[0m ${name} \x1b[2m(${durationSeconds}s)\x1b[0m`);
		console.log(output);
	}
}

console.log(
	`\n  ${failed ? '\x1b[31mPre-push failed\x1b[0m' : '\x1b[32mAll checks passed\x1b[0m'} \x1b[2m(${totalElapsed}s total)\x1b[0m`,
);
process.exit(failed ? 1 : 0);
