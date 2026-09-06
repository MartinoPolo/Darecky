/**
 * @typedef {{ tabs: {
 * onUpdated: { addListener: (listener: (tabId: number, changeInfo: { status?: string }, tab: { url?: string }) => void) => void },
 * setZoom: (tabId: number, zoom: number) => Promise<void>
 * } }} ChromeTabsApi
 */
const chromeApi = /** @type {{ chrome: ChromeTabsApi }} */ (/** @type {unknown} */ (globalThis))
	.chrome;

chromeApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.status !== 'complete' || tab.url === undefined) {
		return;
	}

	const zoom = Number(new URL(tab.url).searchParams.get('browserZoom'));
	if (Number.isFinite(zoom) && zoom > 0) {
		void chromeApi.tabs.setZoom(tabId, zoom);
	}
});
