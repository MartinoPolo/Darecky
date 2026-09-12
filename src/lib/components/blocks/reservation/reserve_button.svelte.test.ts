import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
import * as m from '$lib/paraglide/messages.js';

const { default: ReserveButton } = await import('./ReserveButton.svelte');

function makeGift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
	return {
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
		likeCount: 0,
		reservedCount: 1,
		isFullyReserved: true,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
		...overrides,
	};
}

afterEach(() => vi.restoreAllMocks());

describe('ReserveButton', () => {
	it('coordinates the success content and color treatment for 160 ms, then shows cancel', async () => {
		let finishAnimation!: () => void;
		const finished = new Promise<void>((resolve) => (finishAnimation = resolve));
		const animation = { cancel: vi.fn(), finished } as unknown as Animation;
		const animate = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(animation);
		const screen = await render(ReserveButton, {
			gift: makeGift({ reservedCount: 0, isFullyReserved: false }),
		});
		const initialButton = document.querySelector('[data-testid="reserve-button"]');

		expect(animate).not.toHaveBeenCalled();
		await screen.rerender({
			gift: makeGift({ myReservationId: 'reservation-1' }),
		});

		await expect.element(page.getByText(m.reserve_button_reserved())).toBeVisible();
		const button = document.querySelector(
			'[data-testid="reserve-button"]',
		) as HTMLButtonElement;
		const content = button.querySelector(
			'[data-testid="reservation-button-content"]',
		) as HTMLSpanElement;
		expect(button).toBe(initialButton);
		expect(button.getAttribute('aria-label')).toBe(
			m.reserve_button_cancel_aria({ name: 'Kolo' }),
		);
		expect(animate.mock.instances[0]).toBe(content);
		expect(animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });

		finishAnimation();
		await expect.element(page.getByText(m.reserve_button_cancel())).toBeVisible();
		expect(page.getByText(m.reserve_button_reserved()).query()).toBeNull();
	});

	it('cancels stale acknowledgement on rapid reversal and lets the final reservation win', async () => {
		const firstAnimation = { cancel: vi.fn() } as unknown as Animation;
		const secondAnimation = { cancel: vi.fn() } as unknown as Animation;
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockReturnValueOnce(firstAnimation)
			.mockReturnValueOnce(secondAnimation);
		const availableGift = makeGift({ reservedCount: 0, isFullyReserved: false });
		const ownReservation = makeGift({ myReservationId: 'reservation-1' });
		const screen = await render(ReserveButton, { gift: availableGift });

		await screen.rerender({ gift: ownReservation });
		await screen.rerender({ gift: availableGift });

		expect(firstAnimation.cancel).toHaveBeenCalledOnce();
		expect(animate).toHaveBeenCalledTimes(1);
		await expect.element(page.getByText(m.reserve_button_reserve())).toBeVisible();

		await screen.rerender({ gift: ownReservation });
		await expect.element(page.getByText(m.reserve_button_reserved())).toBeVisible();
		expect(animate).toHaveBeenCalledTimes(2);
	});

	it('does not visually confirm when reserving leaves authoritative props unchanged', async () => {
		const animation = vi.spyOn(HTMLElement.prototype, 'animate');
		const onreserve = vi.fn();
		const gift = makeGift({ reservedCount: 0, isFullyReserved: false });
		await render(ReserveButton, { gift, onreserve });

		await page
			.getByRole('button', { name: m.reserve_button_reserve_aria({ name: 'Kolo' }) })
			.click();

		expect(onreserve).toHaveBeenCalledOnce();
		await expect.element(page.getByText(m.reserve_button_reserve())).toBeVisible();
		expect(animation).not.toHaveBeenCalled();
	});

	it('settles the successful state immediately without transforms under reduced motion', async () => {
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		const screen = await render(ReserveButton, {
			gift: makeGift({ reservedCount: 0, isFullyReserved: false }),
		});

		await screen.rerender({ gift: makeGift({ myReservationId: 'reservation-1' }) });

		const button = document.querySelector(
			'[data-testid="reserve-button"]',
		) as HTMLButtonElement;
		await expect.element(page.getByText(m.reserve_button_cancel())).toBeVisible();
		expect(animate).not.toHaveBeenCalled();
		expect(button.style.transform).toBe('');
	});

	it('cancels an active acknowledgement when torn down', async () => {
		const animation = { cancel: vi.fn() } as unknown as Animation;
		vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(animation);
		const screen = await render(ReserveButton, {
			gift: makeGift({ reservedCount: 0, isFullyReserved: false }),
		});
		await screen.rerender({ gift: makeGift({ myReservationId: 'reservation-1' }) });

		await screen.unmount();

		expect(animation.cancel).toHaveBeenCalledOnce();
	});

	it('does not acknowledge an own reservation present on initial mount', async () => {
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		await render(ReserveButton, {
			gift: makeGift({ myReservationId: 'reservation-1' }),
		});

		await expect.element(page.getByText(m.reserve_button_cancel())).toBeVisible();
		expect(animate).not.toHaveBeenCalled();
	});

	it('renders nothing when fully reserved by others', async () => {
		await render(ReserveButton, { gift: makeGift(), onreserve: vi.fn(), onunreserve: vi.fn() });
		expect(document.querySelector('[data-testid="reserve-button"]')).toBeNull();
	});

	it('preserves cancelling an own reservation on an archived wishlist', async () => {
		const onunreserve = vi.fn();
		await render(ReserveButton, {
			gift: makeGift({ myReservationId: 'reservation-1' }),
			isArchived: true,
			onunreserve,
		});

		await page
			.getByRole('button', { name: m.reserve_button_cancel_aria({ name: 'Kolo' }) })
			.click();
		expect(onunreserve).toHaveBeenCalledOnce();
	});

	it('preserves reserving an available gift on an active wishlist', async () => {
		const onreserve = vi.fn();
		const gift = makeGift({ reservedCount: 0, isFullyReserved: false });
		await render(ReserveButton, { gift, onreserve });

		await page
			.getByRole('button', { name: m.reserve_button_reserve_aria({ name: 'Kolo' }) })
			.click();
		expect(onreserve).toHaveBeenCalledWith(gift);
	});
});
