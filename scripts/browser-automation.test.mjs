import assert from 'node:assert/strict';
import test from 'node:test';
import { automatedServerEnvironment, sharedChromeLaunchOptions } from './browser-automation.mjs';

test('pins automation to installed Google Chrome with browser opening suppressed', () => {
	assert.deepEqual(sharedChromeLaunchOptions, { channel: 'chrome' });
	assert.deepEqual(automatedServerEnvironment, { BROWSER: 'none', BROWSER_ARGS: '' });
	assert.ok(Object.isFrozen(sharedChromeLaunchOptions));
	assert.ok(Object.isFrozen(automatedServerEnvironment));
});
