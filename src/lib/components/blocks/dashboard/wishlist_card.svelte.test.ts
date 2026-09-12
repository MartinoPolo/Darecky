import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import type { Wishlist } from '$lib/modules/wishlists/types.js';
import * as m from '$lib/paraglide/messages.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: WishlistCard } = await import('./WishlistCard.svelte');

const wishlist = {
	id: 'wishlist-1',
	shortId: 'test-list',
	title: 'Testovací seznam',
	status: 'active',
	theme: 'default',
	imageKey: null,
	imageSlots: null,
	eventDate: null,
	createdAt: new Date('2026-01-01T00:00:00Z'),
	updatedAt: new Date('2026-01-02T00:00:00Z'),
} as unknown as Wishlist;

function progressParts() {
	const progress = document.querySelector('[data-slot="progress"]') as HTMLElement;
	const indicator = progress?.querySelector('[data-slot="progress-indicator"]') as HTMLElement;
	return { progress, indicator };
}

describe('WishlistCard reservation progress', () => {
	it.each([
		{
			label: 'zero',
			reserved: 0,
			total: 0,
			max: '1',
			now: '0',
			transform: 'translateX(-100%)',
		},
		{
			label: 'partial',
			reserved: 2,
			total: 4,
			max: '4',
			now: '2',
			transform: 'translateX(-50%)',
		},
		{ label: 'full', reserved: 4, total: 4, max: '4', now: '4', transform: 'translateX(-0%)' },
	])(
		'renders finite, accurate $label semantics',
		async ({ reserved, total, max, now, transform }) => {
			const screen = await render(WishlistCard, {
				wishlist,
				reservationProgress: { reserved, total },
			});
			const { progress, indicator } = progressParts();

			expect(progress.getAttribute('aria-valuemax')).toBe(max);
			expect(progress.getAttribute('aria-valuenow')).toBe(now);
			expect(progress.getAttribute('aria-valuetext')).toBe(
				m.wishlist_reserved_ratio({ reserved, total }),
			);
			const renderedOffset = Number.parseFloat(
				indicator.style.transform.match(/translateX\((-?[\d.]+)%\)/)?.[1] ?? 'NaN',
			);
			const expectedOffset = Number.parseFloat(
				transform.match(/translateX\((-?[\d.]+)%\)/)?.[1] ?? 'NaN',
			);
			expect(Math.abs(renderedOffset)).toBe(Math.abs(expectedOffset));
			expect(Number.isFinite(renderedOffset)).toBe(true);
			expect(indicator.className).not.toContain('invisible');
			expect(screen.container.textContent).toContain(
				m.wishlist_reserved_ratio({ reserved, total }),
			);
			await screen.unmount();
		},
	);

	it('never renders reservation progress for the recipient card branch', async () => {
		const screen = await render(WishlistCard, { wishlist, giftCount: 0 });

		expect(screen.container.querySelector('[data-slot="progress"]')).toBeNull();
		expect(screen.container.textContent).not.toContain(m.wishlist_reservation_progress());
		await screen.unmount();
	});
});
