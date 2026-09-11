import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { ComponentProps } from 'svelte';
import NotificationItem from './NotificationItem.svelte';
import type { Notification } from '$lib/modules/notifications/types.js';
import {
	getNewGiftDigestDisplay,
	type NewGiftDigestPayload,
} from '$lib/modules/notifications/new_gift_digest.js';

const navigation = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: navigation.goto }));

function notification(
	overrides: Partial<Notification> & Pick<Notification, 'message'>,
): Notification {
	return {
		id: 'notification-1',
		type: 'new_gift_added',
		wishlistId: 'wishlist-1',
		wishlistShortId: 'family',
		giftId: null,
		actorName: null,
		digest: null,
		href: null,
		read: false,
		createdAt: new Date(),
		...overrides,
	};
}

async function renderItem(value: Notification) {
	const props: ComponentProps<typeof NotificationItem> = {
		notification: value,
		onMarkAsRead: vi.fn(),
	};
	return render(NotificationItem, props);
}

const oneListPayload: NewGiftDigestPayload = {
	version: 1,
	totalCount: 2,
	wishlistCount: 1,
	wishlists: [
		{
			wishlistId: 'wishlist-1',
			shortId: 'family',
			title: 'Rodina',
			count: 2,
			namePreviews: ['Fotoaparát', 'Kniha'],
		},
	],
};

describe('NotificationItem new-gift digests', () => {
	it('renders a one-list Czech digest count and opens that wishlist', async () => {
		navigation.goto.mockClear();
		const display = getNewGiftDigestDisplay(oneListPayload, 'cs');
		const screen = await renderItem(
			notification({ message: display.message, digest: oneListPayload, href: display.href }),
		);

		await expect.element(screen.getByText(display.message)).toBeVisible();
		await expect.element(screen.getByText(/Rodina: 2/)).toBeVisible();
		await screen.getByRole('button').click();
		expect(navigation.goto).toHaveBeenCalledWith('/w/family');
	});

	it('renders an English multi-list breakdown and opens Followed', async () => {
		navigation.goto.mockClear();
		const payload: NewGiftDigestPayload = {
			version: 1,
			totalCount: 3,
			wishlistCount: 2,
			wishlists: [
				oneListPayload.wishlists[0]!,
				{
					wishlistId: 'wishlist-2',
					shortId: 'birthday',
					title: 'Birthday',
					count: 1,
					namePreviews: ['Shoes'],
				},
			],
		};
		const display = getNewGiftDigestDisplay(payload, 'en');
		const screen = await renderItem(
			notification({ message: display.message, digest: payload, href: display.href }),
		);

		await expect.element(screen.getByText(display.message)).toBeVisible();
		await expect.element(screen.getByText(/Rodina: 2/)).toBeVisible();
		await expect.element(screen.getByText(/Birthday: 1/)).toBeVisible();
		await screen.getByRole('button').click();
		expect(navigation.goto).toHaveBeenCalledWith('/followed');
	});

	it('keeps a long message readable and supports click and keyboard activation', async () => {
		navigation.goto.mockClear();
		const onMarkAsRead = vi.fn();
		const longMessage =
			'A very long notification message that needs to wrap across several lines without being clipped or forcing the notification row to a fixed height.';
		const screen = render(NotificationItem, {
			notification: notification({ message: longMessage, href: '/followed' }),
			onMarkAsRead,
		});
		const button = screen.getByRole('button');

		await expect.element(screen.getByText(longMessage)).toBeVisible();
		await expect.element(button).toHaveClass(/h-auto/);
		await button.click();
		expect(onMarkAsRead).toHaveBeenCalledWith('notification-1');

		button.element().focus();
		await userEvent.keyboard('{Enter}');
		expect(navigation.goto).toHaveBeenCalledTimes(2);
	});

	it('keeps owner geometry unchanged between read states', async () => {
		const unread = await renderItem(notification({ message: 'Unread row' }));
		const read = await renderItem(notification({ message: 'Read row', read: true }));
		const unreadButton = unread.container.querySelector('button')!;
		const readButton = read.container.querySelector('button')!;

		expect(unreadButton.className).toBe(readButton.className);
		expect(unreadButton.className).not.toContain('rounded-[10px]');
	});

	it('falls back for malformed or legacy rows and keeps the legacy wishlist destination', async () => {
		navigation.goto.mockClear();
		const screen = await renderItem(
			notification({
				message: 'Byly přidány nové dárky',
				digest: null,
				href: null,
				wishlistShortId: 'legacy-list',
				actorName: 'Legacy actor',
			}),
		);

		await expect.element(screen.getByText('Byly přidány nové dárky')).toBeVisible();
		await expect.element(screen.getByText('Legacy actor')).toBeVisible();
		await screen.getByRole('button').click();
		expect(navigation.goto).toHaveBeenCalledWith('/w/legacy-list');
	});
});
