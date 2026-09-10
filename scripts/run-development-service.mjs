#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { automatedServerEnvironment } from './browser-automation.mjs';
import { assignedService } from './development-service-environment.mjs';

export function developmentServiceDefinitions(argv = process.argv, env = process.env) {
	const preview = assignedService(env.MPX_PREVIEW_PORT, '8301');
	const storybook = assignedService(env.MPX_STORYBOOK_PORT, '8302');
	return {
		agent: {
			bin: new URL('../node_modules/vite/bin/vite.js', import.meta.url),
			args: ['dev', ...argv.slice(3)],
			env: { ...env, ...automatedServerEnvironment },
		},
		preview: {
			bin: new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url),
			args: [
				'dev',
				'.svelte-kit/cloudflare/_worker.js',
				'--port',
				preview.port,
				'--var',
				`ORIGIN:${preview.origin}`,
			],
		},
		storybook: {
			bin: new URL('../node_modules/storybook/dist/bin/dispatcher.js', import.meta.url),
			args: ['dev', '--port', storybook.port],
		},
	};
}

export function runDevelopmentService(service = process.argv[2]) {
	const definition = developmentServiceDefinitions()[service];
	if (!definition) {
		console.error(`Unknown development service: ${service ?? ''}`);
		process.exitCode = 2;
		return;
	}
	const child = spawn(process.execPath, [fileURLToPath(definition.bin), ...definition.args], {
		stdio: 'inherit',
		env: definition.env ?? process.env,
		windowsHide: true,
	});
	child.on('error', (error) => {
		console.error(`Failed to start development service ${service}:`, error);
		process.exitCode = 1;
	});
	for (const signal of ['SIGINT', 'SIGTERM']) {
		process.on(signal, () => child.kill(signal));
	}
	child.on('exit', (code, signal) => {
		process.exitCode = code ?? (signal ? 1 : 0);
	});
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	runDevelopmentService();
}
