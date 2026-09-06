import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';

const { default: GiftReceivedToggle } = await import('./GiftReceivedToggle.svelte');

describe('GiftReceivedToggle', () => {
	it.each([WISHLIST_ROLES.recipient, WISHLIST_ROLES.moderator])(
		'renders the received action for the %s role',
		async (role) => {
			const screen = await render(GiftReceivedToggle, {
				giftId: 'gift-1',
				received: false,
				role,
				onreceived: vi.fn(),
			});

			await expect
				.element(screen.getByRole('button', { name: m.gift_mark_received() }))
				.toBeVisible();
		},
	);

	it.each([
		{ locale: 'cs' as const, received: false, visible: 'Přijato' },
		{ locale: 'cs' as const, received: true, visible: 'Vrátit zpět' },
		{ locale: 'en' as const, received: false, visible: 'Received' },
		{ locale: 'en' as const, received: true, visible: 'Undo' },
	])(
		'uses the compact $locale $visible label with the full accessible name',
		async ({ locale, received, visible }) => {
			overwriteGetLocale(() => locale);
			try {
				const screen = await render(GiftReceivedToggle, {
					giftId: 'gift-compact',
					received,
					role: WISHLIST_ROLES.recipient,
					compactLabel: true,
					onreceived: vi.fn(),
				});
				const accessible = received ? m.gift_mark_unreceived() : m.gift_mark_received();
				await expect
					.element(screen.getByRole('button', { name: accessible }))
					.toBeVisible();
				await expect.element(screen.getByText(visible, { exact: true })).toBeVisible();
			} finally {
				overwriteGetLocale(() => 'cs');
			}
		},
	);

	it('does not render for a visitor', async () => {
		await render(GiftReceivedToggle, {
			giftId: 'gift-1',
			received: false,
			role: WISHLIST_ROLES.visitor,
			onreceived: vi.fn(),
		});

		expect(document.querySelector('[data-testid="gift-received-toggle"]')).toBeNull();
	});

	it('does not render for a manager without an onreceived callback', async () => {
		await render(GiftReceivedToggle, {
			giftId: 'gift-1',
			received: false,
			role: WISHLIST_ROLES.recipient,
		});

		expect(document.querySelector('[data-testid="gift-received-toggle"]')).toBeNull();
	});

	it('does not render on an archived wishlist', async () => {
		await render(GiftReceivedToggle, {
			giftId: 'gift-1',
			received: false,
			role: WISHLIST_ROLES.recipient,
			isArchived: true,
			onreceived: vi.fn(),
		});

		expect(document.querySelector('[data-testid="gift-received-toggle"]')).toBeNull();
	});

	it('keeps a local disabled acknowledgement while the received mutation is pending', async () => {
		let settle!: () => void;
		const onreceived = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					settle = resolve;
				}),
		);
		await render(GiftReceivedToggle, {
			giftId: 'gift-1',
			received: false,
			role: WISHLIST_ROLES.recipient,
			onreceived,
		});
		const action = page.getByRole('button', { name: m.gift_mark_received() });

		await action.click();

		await expect.element(action).toBeDisabled();
		expect(onreceived).toHaveBeenCalledOnce();
		settle();
		await expect.element(action).toBeEnabled();
	});

	it('restores focus after a failed update reenables its still-connected action', async () => {
		let rejectMutation!: (reason: Error) => void;
		const mutation = new Promise<void>((_resolve, reject) => {
			rejectMutation = reject;
		});
		const onreceived = vi.fn(async () => {
			try {
				await mutation;
			} catch {
				// Simulate route-side recovery without helping the component restore focus.
			}
		});
		await render(GiftReceivedToggle, {
			giftId: 'gift-1',
			received: false,
			role: WISHLIST_ROLES.recipient,
			onreceived,
		});
		const action = page.getByRole('button', { name: m.gift_mark_received() });
		const unrelated = document.createElement('button');
		document.body.append(unrelated);

		await action.click();
		await expect.element(action).toBeDisabled();
		unrelated.focus();
		rejectMutation(new Error('mutation failed'));

		await expect.element(action).toBeEnabled();
		await expect.element(action).toHaveFocus();
	});

	it('does not reclaim focus when relocation disconnected its source action', async () => {
		let settle!: () => void;
		const onreceived = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					settle = resolve;
				}),
		);
		await render(GiftReceivedToggle, {
			giftId: 'gift-1',
			received: false,
			role: WISHLIST_ROLES.recipient,
			onreceived,
		});
		const source = document.querySelector<HTMLButtonElement>(
			'[data-gift-received-action="gift-1"]',
		)!;

		await page.getByRole('button', { name: m.gift_mark_received() }).click();
		await vi.waitFor(() => expect(source.disabled).toBe(true));
		const sourceFocus = vi.spyOn(source, 'focus');
		source.remove();
		const destination = document.createElement('button');
		document.body.append(destination);
		destination.focus();
		settle();

		await vi.waitFor(() => expect(source.disabled).toBe(false));
		expect(sourceFocus).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(destination);
	});

	it('stops the surface click and sends the inverse received state', async () => {
		const onreceived = vi.fn();
		const surfaceClick = vi.fn();
		const host = document.createElement('div');
		host.addEventListener('click', surfaceClick);
		document.body.appendChild(host);
		await render(
			GiftReceivedToggle,
			{
				giftId: 'gift-1',
				received: true,
				role: WISHLIST_ROLES.moderator,
				onreceived,
			},
			{ baseElement: host },
		);

		await page.getByRole('button', { name: m.gift_mark_unreceived() }).click();

		expect(onreceived).toHaveBeenCalledWith('gift-1', false);
		expect(surfaceClick).not.toHaveBeenCalled();
	});
});
