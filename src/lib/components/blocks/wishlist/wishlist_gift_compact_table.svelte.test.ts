import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import type { GiftForRecipient } from '$lib/modules/gifts/types.js';
import { GIFT_SECTION_KINDS } from '$lib/modules/gifts/gift_ordering.js';

const { default: WishlistGiftCompactTable } = await import('./WishlistGiftCompactTable.svelte');

const gift: GiftForRecipient = {
	id: 'gift-1',
	wishlistId: 'wishlist-1',
	name: 'Kolo',
	description: null,
	descriptionAppends: [],
	editedAfterShareAt: null,
	links: [],
	price: null,
	priceMax: null,
	currency: null,
	imageUrl: null,
	imageKey: null,
	imageMeta: null,
	quantity: 1,
	sortOrder: 0,
	received: false,
	createdAt: new Date('2026-01-01'),
	priorityLevelId: null,
	priorityLabel: null,
	prioritySortOrder: null,
};

function renderRecipientTable(isArchived: boolean) {
	return render(WishlistGiftCompactTable, {
		sections: [
			{ kind: GIFT_SECTION_KINDS.available, key: 'available', label: null, gifts: [gift] },
		],
		role: 'recipient',
		isArchived,
		hideReservationState: true,
		canManage: true,
		onedit: vi.fn(),
		onreserve: vi.fn(),
		onunreserve: vi.fn(),
		onreceived: vi.fn(),
	});
}

describe('WishlistGiftCompactTable actions (issue #255)', () => {
	it('shows a recipient-safe action column for active management actions', async () => {
		await renderRecipientTable(false);
		const table = document.querySelector('table')!;

		expect(table.textContent).not.toContain('To se mi líbí');
		expect(table.querySelector('[data-testid="gift-received-toggle"]')).toBeTruthy();
	});

	it('omits the recipient action column on an archived wishlist', async () => {
		await renderRecipientTable(true);
		const table = document.querySelector('table')!;

		expect(table.querySelector('[data-testid="gift-received-toggle"]')).toBeNull();
	});
});
