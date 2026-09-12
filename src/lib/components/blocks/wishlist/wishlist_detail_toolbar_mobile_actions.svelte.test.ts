import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'svelte';
import * as m from '$lib/paraglide/messages.js';
import {
	GIFT_GROUPING_OPTIONS,
	GIFT_SORT_OPTIONS,
	GIFT_VIEW_MODES,
} from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import WishlistDetailToolbar from './WishlistDetailToolbar.svelte';

const defaultFilters = {
	availableOnly: false,
	withLinkOnly: false,
	likedOnly: false,
	showReceived: false,
	categoryValues: [],
	priorityValues: [],
};

const defaultProps: ComponentProps<typeof WishlistDetailToolbar> = {
	canManage: false,
	role: WISHLIST_ROLES.visitor,
	isArchived: false,
	isAuthenticated: false,
	viewMode: GIFT_VIEW_MODES.card,
	sortOption: GIFT_SORT_OPTIONS.ownerOrder,
	filters: defaultFilters,
	grouping: GIFT_GROUPING_OPTIONS.none,
	groupingAvailability: { priority: false, category: false },
	categoryFilterOptions: [],
	priorityFilterOptions: [],
	reorderMode: false,
	recipientViewPreview: false,
	onrecipientviewpreviewchange: () => {},
	onreordermodechange: () => {},
	onviewmodechange: () => {},
	onsortchange: () => {},
	onfilterchange: () => {},
	ongroupingchange: () => {},
	onunfollow: () => {},
	onaddgift: () => {},
	onbatchadd: () => {},
	onselectionstart: () => {},
};

const hosts = new Set<HTMLDivElement>();

function hostFor(width: number) {
	const host = document.createElement('div');
	host.style.width = `${width - 24}px`;
	document.body.appendChild(host);
	hosts.add(host);
	return host;
}

async function renderToolbar(
	overrides: Partial<ComponentProps<typeof WishlistDetailToolbar>> = {},
	width = 390,
) {
	await page.viewport(width, 760);
	return render(
		WishlistDetailToolbar,
		{ ...defaultProps, ...overrides },
		{ baseElement: hostFor(width) },
	);
}

async function frames(count = 2) {
	for (let index = 0; index < count; index += 1) {
		await new Promise(requestAnimationFrame);
	}
}

function expectBottomSheet(dialog: Element) {
	expect(dialog).toHaveAttribute('data-side', 'bottom');
	const rect = dialog.getBoundingClientRect();
	const style = getComputedStyle(dialog);
	expect(style.bottom).toBe('0px');
	expect(rect.left).toBeCloseTo(window.innerWidth - rect.right, 1);
	expect(rect.left).toBeGreaterThan(0);
	expect(style.borderLeftWidth).toBe(style.borderRightWidth);
	expect(style.borderLeftWidth).toBe(style.borderTopWidth);
	expect(style.borderTopLeftRadius).toBe(style.borderTopRightRadius);
	expect(parseFloat(style.borderTopLeftRadius)).toBeGreaterThan(0);
	const header = dialog.querySelector<HTMLElement>('[data-slot="sheet-header"]')!;
	const headerStyle = getComputedStyle(header);
	expect(header.getBoundingClientRect().width).toBeCloseTo(
		rect.width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth),
		1,
	);
	expect(headerStyle.paddingLeft).toBe('16px');
	expect(headerStyle.paddingRight).toBe('56px');
	expect(headerStyle.paddingTop).toBe('12px');
	expect(headerStyle.paddingBottom).toBe('12px');
	expect(parseFloat(headerStyle.borderBottomWidth)).toBeCloseTo(1, 1);
	const body = header.nextElementSibling as HTMLElement;
	const bodyStyle = getComputedStyle(body);
	expect(bodyStyle.paddingLeft).toBe('8px');
	expect(bodyStyle.paddingRight).toBe('8px');
	expect(bodyStyle.paddingTop).toBe('8px');
	expect(bodyStyle.paddingBottom).toBe('8px');
}

describe('WishlistDetailToolbar mobile actions (#340)', () => {
	beforeEach(async () => page.viewport(390, 760));
	afterEach(async () => {
		for (const host of hosts) {
			host.remove();
		}
		hosts.clear();
		document.body.style.minHeight = '';
		window.scrollTo(0, 0);
		await page.viewport(1280, 760);
	});
	it('preserves all filter gates, facet choices, row activation, and reset semantics', async () => {
		const onfilterchange = vi.fn();
		const onsortchange = vi.fn();
		const ongroupingchange = vi.fn();
		const screen = await renderToolbar({
			isAuthenticated: true,
			onfilterchange,
			onsortchange,
			ongroupingchange,
			sortOption: GIFT_SORT_OPTIONS.name,
			grouping: GIFT_GROUPING_OPTIONS.priority,
			filters: { ...defaultFilters, withLinkOnly: true, categoryValues: ['books'] },
			categoryFilterOptions: [{ value: 'books', label: 'Knihy' }],
			priorityFilterOptions: [{ value: 'high', label: 'Vysoká' }],
		});
		const trigger = screen.getByTestId('mobile-display-trigger').element();
		expect(trigger.querySelector('[data-filter-count]')).toHaveTextContent('2');
		const badge = trigger.querySelector('[data-filter-count]')!;
		expect(getComputedStyle(badge).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
		await screen.getByTestId('mobile-display-trigger').click();
		await screen.getByTestId('mobile-sheet-filter-switch').click();
		await expect
			.element(screen.getByRole('checkbox', { name: m.gift_filter_available_only() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('checkbox', { name: m.gift_filter_liked() }))
			.toBeVisible();
		await expect.element(screen.getByRole('checkbox', { name: 'Knihy' })).toBeChecked();
		await expect.element(screen.getByRole('checkbox', { name: 'Vysoká' })).toBeVisible();
		const withLink = screen
			.getByRole('checkbox', { name: m.gift_filter_with_link() })
			.element();
		await (withLink.parentElement!.querySelector('span') as HTMLElement).click();
		expect(onfilterchange).toHaveBeenCalledExactlyOnceWith({
			...defaultFilters,
			categoryValues: ['books'],
		});
		await userEvent.keyboard('{Escape}');
		await frames();
		await screen.getByTestId('mobile-more-trigger').click();
		await screen.getByRole('button', { name: m.gift_display_reset_tooltip() }).click();
		expect(onfilterchange).toHaveBeenLastCalledWith(defaultFilters);
		expect(onsortchange).toHaveBeenCalledWith(GIFT_SORT_OPTIONS.ownerOrder);
		expect(ongroupingchange).toHaveBeenCalledWith(GIFT_GROUPING_OPTIONS.none);
		await screen.unmount();
	});

	it('keeps recipient privacy gates in the combined filter sheet', async () => {
		const screen = await renderToolbar({
			canManage: true,
			role: WISHLIST_ROLES.recipient,
			isAuthenticated: true,
		});
		await screen.getByTestId('mobile-display-trigger').click();
		await screen.getByTestId('mobile-sheet-filter-switch').click();
		await expect
			.element(screen.getByRole('checkbox', { name: m.gift_filter_available_only() }))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('checkbox', { name: m.gift_filter_liked() }))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('checkbox', { name: m.gift_filter_with_link() }))
			.toBeVisible();
		await screen.unmount();
	});

	it('puts only eligible lower-priority actions in More and dispatches them', async () => {
		const callbacks = {
			onrecipientviewpreviewchange: vi.fn(),
			onselectionstart: vi.fn(),
			onreordermodechange: vi.fn(),
			onbatchadd: vi.fn(),
		};
		const screen = await renderToolbar({
			...callbacks,
			canManage: true,
			role: WISHLIST_ROLES.moderator,
		});
		await screen.getByTestId('mobile-more-trigger').click();
		const more = screen.getByRole('dialog', { name: m.wishlist_more_actions() });
		await expect.element(more).toBeVisible();
		expectBottomSheet(more.element());
		await expect
			.element(more.getByRole('button', { name: m.recipient_view_preview_turn_on() }))
			.toBeVisible();
		await expect
			.element(more.getByRole('button', { name: m.gift_selection_toolbar() }))
			.toBeVisible();
		await expect
			.element(more.getByRole('button', { name: m.gift_reorder_action() }))
			.toBeVisible();
		const batchAdd = more.getByRole('button', { name: m.batch_add_toolbar_label() });
		await expect.element(batchAdd).toBeVisible();
		for (const action of [
			more.getByRole('button', { name: m.recipient_view_preview_turn_on() }).element(),
			batchAdd.element(),
		]) {
			expect(action.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
			const surface = action.querySelector<HTMLElement>(':scope > .elevation-surface')!;
			expect(surface).toBeTruthy();
			expect(getComputedStyle(surface).justifyContent).toBe('flex-start');
		}
		await expect
			.element(more.getByRole('button', { name: m.wishlist_detail_unfollow() }))
			.not.toBeInTheDocument();
		await userEvent.keyboard('{Escape}');
		await frames();
		await expect.element(screen.getByTestId('mobile-more-trigger')).toHaveFocus();
		await screen.getByTestId('mobile-more-trigger').click();
		await screen
			.getByRole('dialog', { name: m.wishlist_more_actions() })
			.getByRole('button', { name: m.gift_selection_toolbar() })
			.click();
		expect(callbacks.onselectionstart).toHaveBeenCalledOnce();
		await screen.unmount();
	});

	it('exposes visitor-only preview and unfollow in More without management actions', async () => {
		const onunfollow = vi.fn();
		const screen = await renderToolbar({ isAuthenticated: true, onunfollow });
		await screen.getByTestId('mobile-more-trigger').click();
		const more = screen.getByRole('dialog', { name: m.wishlist_more_actions() });
		await expect
			.element(more.getByRole('button', { name: m.wishlist_detail_unfollow() }))
			.toBeVisible();
		await expect
			.element(more.getByRole('button', { name: m.gift_selection_toolbar() }))
			.not.toBeInTheDocument();
		await more.getByRole('button', { name: m.wishlist_detail_unfollow() }).click();
		expect(onunfollow).toHaveBeenCalledOnce();
		await screen.unmount();
	});

	it('restores Display focus, scroll, width, and toolbar geometry after Escape', async () => {
		const screen = await renderToolbar({}, 390);
		const trigger = screen.getByTestId('mobile-display-trigger').element() as HTMLButtonElement;
		const toolbar = screen.getByTestId('wishlist-toolbar').element() as HTMLElement;
		document.body.style.minHeight = '200vh';
		window.scrollTo(0, 17);
		await frames(1);
		const before = toolbar.getBoundingClientRect();
		const scrollBefore = window.scrollY;
		await trigger.click();
		const dialog = screen.getByRole('dialog', { name: m.gift_display_options() });
		await userEvent.keyboard('{Tab}');
		expect(dialog.element().contains(document.activeElement)).toBe(true);
		await userEvent.keyboard('{Escape}');
		await frames(5);
		expect(document.activeElement).toBe(trigger);
		expect(window.scrollY).toBe(scrollBefore);
		const after = toolbar.getBoundingClientRect();
		expect(after.width).toBeCloseTo(before.width, 1);
		expect(after.height).toBeCloseTo(before.height, 1);
		expect(document.documentElement.scrollWidth).toBe(document.documentElement.clientWidth);
		await screen.unmount();
	});

	it('keeps the mobile layout switcher enabled in reorder without overflowing at 320px', async () => {
		const onreordermodechange = vi.fn();
		const onviewmodechange = vi.fn();
		const screen = await renderToolbar(
			{
				canManage: true,
				role: WISHLIST_ROLES.moderator,
				reorderMode: true,
				onreordermodechange,
				onviewmodechange,
			},
			320,
		);
		const row = screen
			.getByTestId('wishlist-toolbar-mobile')
			.element()
			.querySelector('[data-mobile-toolbar-row]')!;
		expect(row).toHaveTextContent(m.gift_reorder_mode_label());
		const listMode = screen.getByRole('radio', { name: m.gift_view_list() });
		expect(listMode.element()).not.toBeDisabled();
		await listMode.click();
		expect(onviewmodechange).toHaveBeenCalledWith(GIFT_VIEW_MODES.list);
		expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
		const done = screen
			.getByRole('button', { name: m.gift_reorder_done() })
			.element() as HTMLButtonElement;
		expect(done.getBoundingClientRect().height).toBeCloseTo(32, 0);
		expect(done.getBoundingClientRect().right).toBeCloseTo(
			row.getBoundingClientRect().right,
			1,
		);
		await done.click();
		expect(onreordermodechange).toHaveBeenCalledWith(false);
		await screen.unmount();
	});

	it('clears open mobile sheets when crossing the sm breakpoint', async () => {
		const screen = await renderToolbar();
		await screen.getByTestId('mobile-display-trigger').click();
		await expect
			.element(screen.getByRole('dialog', { name: m.gift_display_options() }))
			.toBeVisible();
		await page.viewport(640, 760);
		await frames();
		await expect
			.element(screen.getByRole('dialog', { name: m.gift_display_options() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});
});
