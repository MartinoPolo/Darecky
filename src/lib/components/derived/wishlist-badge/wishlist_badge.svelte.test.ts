import '../../../../app.css';
import { createRawSnippet } from 'svelte';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import WishlistBadge from './WishlistBadge.svelte';

function textSnippet(text: 'Badge' | 'draft' | 'active' | 'archived') {
	return createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));
}

const cases = [
	['card-status', '12.5px', '600', '12px'],
	['card-metadata', '13px', '600', '12px'],
	['reservation-count', '11px', '700', '10px'],
	['list-status', '11px', '600', '10px'],
] as const;

describe('WishlistBadge dashboard presentations', () => {
	it.each(cases)(
		'restores %s intrinsic geometry',
		async (presentation, fontSize, weight, padding) => {
			const screen = await render(WishlistBadge, {
				presentation,
				status: presentation.includes('status') ? 'active' : 'none',
				children: textSnippet('Badge'),
			});
			const badge = screen.container.querySelector('[data-slot="badge"]') as HTMLElement;
			const style = getComputedStyle(badge);

			expect(style.height).not.toBe('20px');
			expect(style.fontSize).toBe(fontSize);
			expect(style.fontWeight).toBe(weight);
			expect(style.paddingInlineStart).toBe(padding);
			expect(style.borderTopWidth).toBe('2px');
			expect(Number.parseFloat(style.borderRadius)).toBeGreaterThanOrEqual(12);
			await screen.unmount();
		},
	);

	it('uses the loud primary fill only for active status', async () => {
		const colors: string[] = [];
		for (const status of ['draft', 'active', 'archived'] as const) {
			const screen = await render(WishlistBadge, {
				presentation: 'card-status',
				status,
				children: textSnippet(status),
			});
			const badge = screen.container.querySelector('[data-slot="badge"]') as HTMLElement;
			colors.push(getComputedStyle(badge).backgroundColor);
			await screen.unmount();
		}
		expect(colors[0]).toBe(colors[2]);
		expect(colors[1]).not.toBe(colors[0]);
	});
});
