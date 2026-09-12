import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import WishlistProgress from './WishlistProgress.svelte';

describe('WishlistProgress dashboard presentation', () => {
	it('renders baseline rounded track, gradient indicator, and native semantics', async () => {
		const screen = await render(WishlistProgress, {
			value: 2,
			max: 4,
			'aria-label': 'Průběh rezervací',
		});
		const track = screen.container.querySelector('[data-slot="progress"]') as HTMLElement;
		const indicator = track.querySelector('[data-slot="progress-indicator"]') as HTMLElement;
		const trackStyle = getComputedStyle(track);
		const indicatorStyle = getComputedStyle(indicator);

		expect(track.getAttribute('role')).toBe('progressbar');
		expect(track.getAttribute('aria-valuenow')).toBe('2');
		expect(track.getAttribute('aria-valuemax')).toBe('4');
		expect(track.getBoundingClientRect().height).toBe(14);
		expect(trackStyle.borderTopWidth).toBe('2px');
		expect(Number.parseFloat(trackStyle.borderRadius)).toBeGreaterThanOrEqual(7);
		expect(indicatorStyle.backgroundImage).toContain('linear-gradient');
		expect(Number.parseFloat(indicatorStyle.borderRadius)).toBeGreaterThanOrEqual(7);
		expect(indicator.style.transform).toBe('translateX(-50%)');
		await screen.unmount();
	});
});
