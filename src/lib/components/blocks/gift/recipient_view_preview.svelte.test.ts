import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { IMAGE_FIT_MODES, type ImageMetadata } from '$lib/modules/images/index.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: RecipientViewPreviewTestHost } =
	await import('./RecipientViewPreviewTestHost.svelte');

const IMAGE_URL =
	'data:image/svg+xml,' +
	encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="64"/>');

function imageMeta(bgColor: string | null): ImageMetadata {
	return {
		fitMode: IMAGE_FIT_MODES.containPadded,
		cropRect: null,
		focal: { x: 50, y: 50 },
		zoom: 1,
		bgColor,
	};
}

function makeReservedGift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
	return {
		id: 'gift-preview',
		wishlistId: 'wishlist-1',
		name: 'Tajný dárek',
		description: 'Popis dárku',
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [],
		price: 100,
		priceMax: null,
		currency: 'CZK',
		imageUrl: null,
		imageKey: null,
		imageMeta: null,
		quantity: 3,
		sortOrder: 0,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		likeCount: 4,
		reservedCount: 2,
		isFullyReserved: true,
		reserverNames: ['Babička'],
		myReservationId: 'reservation-mine',
		myReservationPurchasedAt: new Date('2026-01-02T00:00:00Z'),
		...overrides,
	};
}

describe('recipient-view preview reservation privacy (#241)', () => {
	beforeEach(async () => {
		await page.viewport(800, 720);
	});

	it.each(['card', 'list', 'compact', 'detail'] as const)(
		'hides reservation presentation and controls on the %s surface',
		async (surface) => {
			const screen = await render(RecipientViewPreviewTestHost, {
				gift: makeReservedGift(),
				role: WISHLIST_ROLES.moderator,
				surface,
			});

			await expect.element(screen.getByText('Tajný dárek')).toBeVisible();
			await expect.element(screen.getByText('Rezervováno')).not.toBeInTheDocument();
			await expect.element(screen.getByText('rezervováno')).not.toBeInTheDocument();
			await expect.element(screen.getByText('Babička')).not.toBeInTheDocument();
			await expect.element(screen.getByText('2 rezervováno')).not.toBeInTheDocument();
			await expect.element(screen.getByTestId('reserve-button')).not.toBeInTheDocument();
			await expect
				.element(screen.getByTestId('release-reservation-button'))
				.not.toBeInTheDocument();

			await screen.unmount();
		},
	);

	it('paints the detail photo frame with explicit black', async () => {
		const screen = await render(RecipientViewPreviewTestHost, {
			gift: makeReservedGift({ imageUrl: IMAGE_URL, imageMeta: imageMeta('#000000') }),
			role: WISHLIST_ROLES.moderator,
			surface: 'detail',
		});

		const detailFrame = screen.container.querySelector(
			'[data-testid="gift-detail-image-frame"]',
		) as HTMLElement;
		const imageFrame = detailFrame.querySelector('[data-testid="image-frame"]') as HTMLElement;

		expect(detailFrame).toBeTruthy();
		expect(imageFrame).toBeTruthy();
		expect(getComputedStyle(detailFrame).backgroundColor).toBe('rgb(0, 0, 0)');
		expect(getComputedStyle(imageFrame).backgroundColor).toBe('rgb(0, 0, 0)');

		await screen.unmount();
	});

	it.each(['card', 'list', 'compact'] as const)(
		'shows received and omits release as browse actions on the %s surface',
		async (surface) => {
			const screen = await render(RecipientViewPreviewTestHost, {
				gift: makeReservedGift(),
				role: WISHLIST_ROLES.moderator,
				surface,
				hideReservationState: false,
				onreceived: vi.fn(),
			});

			await expect.element(screen.getByTestId('gift-received-toggle')).toBeVisible();
			await expect
				.element(screen.getByTestId('release-reservation-button'))
				.not.toBeInTheDocument();

			await screen.unmount();
		},
	);

	it.each(['compact', 'detail'] as const)(
		'shows counts without identity or gifter actions to a self-promoted recipient in %s',
		async (surface) => {
			const screen = await render(RecipientViewPreviewTestHost, {
				gift: makeReservedGift({ isFullyReserved: false, myReservationId: null }),
				role: WISHLIST_ROLES.recipient,
				surface,
				hideReservationState: false,
				onreceived: vi.fn(),
			});

			await expect.element(screen.getByText('2 rezervováno', { exact: true })).toBeVisible();
			await expect.element(screen.getByText('Babička')).not.toBeInTheDocument();
			await expect.element(screen.getByTestId('reserve-button')).not.toBeInTheDocument();
			await expect
				.element(screen.getByRole('button', { name: /oblíbených/ }))
				.not.toBeInTheDocument();

			await screen.unmount();
		},
	);

	it.each(['card', 'list'] as const)(
		'restores exactly one reservation action without a received callback on %s',
		async (surface) => {
			const screen = await render(RecipientViewPreviewTestHost, {
				gift: makeReservedGift(),
				role: WISHLIST_ROLES.moderator,
				surface,
				hideReservationState: false,
			});

			const overlay = screen.getByTestId('gift-state-overlay');
			await expect
				.element(screen.getByText('Rezervováno vámi', { exact: true }))
				.toBeVisible();
			const reserverLine = screen.getByText(/Babička/);
			await expect.element(reserverLine).toBeVisible();
			expect(reserverLine.element().textContent).toContain('Babička');
			expect(overlay.element().contains(reserverLine.element())).toBe(false);
			expect(overlay.element().textContent).not.toContain('Babička');
			await expect
				.element(screen.getByText('2 rezervováno', { exact: true }))
				.not.toBeInTheDocument();
			expect(
				screen.container.querySelectorAll('[data-testid="reserve-button"]'),
			).toHaveLength(1);
			await expect
				.element(screen.getByTestId('gift-received-toggle'))
				.not.toBeInTheDocument();

			await screen.unmount();
		},
	);
});
