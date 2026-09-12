// Installed Chrome can stall temporary-profile cleanup on Windows after the browser exits.
export const sharedChromeLaunchOptions = Object.freeze(
	process.platform === 'win32' ? {} : { channel: 'chrome' },
);

export const automatedServerEnvironment = Object.freeze({
	BROWSER: 'none',
	BROWSER_ARGS: '',
});
