import assert from 'node:assert/strict';
import test from 'node:test';
import { developmentServiceDefinitions } from './run-development-service.mjs';

test('agent starts Vite directly with forwarded arguments and isolated environment', () => {
	const env = { BROWSER: 'personal', KEEP: 'yes' };
	const definitions = developmentServiceDefinitions(
		['node', 'runner', 'agent', '--port', '8307'],
		env,
	);
	assert.equal(definitions.agent.bin.pathname.endsWith('/node_modules/vite/bin/vite.js'), true);
	assert.deepEqual(definitions.agent.args, ['dev', '--port', '8307']);
	assert.deepEqual(definitions.agent.env, { ...env, BROWSER: 'none', BROWSER_ARGS: '' });
	assert.deepEqual(env, { BROWSER: 'personal', KEEP: 'yes' });
});

test('manual services retain the inherited environment and existing commands', () => {
	const env = { BROWSER: 'personal' };
	const definitions = developmentServiceDefinitions(['node', 'runner', 'preview'], env);
	assert.equal(definitions.preview.env, undefined);
	assert.equal(definitions.storybook.env, undefined);
	assert.equal(definitions.preview.args[0], 'dev');
	assert.deepEqual(definitions.storybook.args.slice(0, 2), ['dev', '--port']);
});
