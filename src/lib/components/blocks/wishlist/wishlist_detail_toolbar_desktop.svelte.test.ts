import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('WishlistDetailToolbar consolidated desktop display (#359)', () => {
	afterEach(async () => {
		for (const host of hosts) {
			host.remove();
		}
		hosts.clear();
		await page.viewport(1280, 760);
	});

	it('places one Display trigger after View and opens persistent cascading categories', async () => {
		const onsortchange = vi.fn();
		const ongroupingchange = vi.fn();
		const onfilterchange = vi.fn();
		const screen = await renderToolbar(
			{
				onsortchange,
				ongroupingchange,
				onfilterchange,
				groupingAvailability: { priority: true, category: true },
				categoryFilterOptions: [{ value: 'books', label: 'Knihy' }],
				priorityFilterOptions: [{ value: 'high', label: 'Vysoká' }],
			},
			1280,
		);
		await frames(1);
		const controls = screen.getByTestId('wishlist-toolbar-controls').element();
		const view = controls.querySelector('[data-testid="gift-view-switcher"]')!;
		const viewWrapper = view.closest('.toolbar-responsive-view-switcher')!;
		const display = controls.querySelector('[data-testid="desktop-display-trigger"]')!;
		expect(viewWrapper.nextElementSibling).toBe(display);
		expect(controls.querySelectorAll('[data-testid="desktop-display-trigger"]')).toHaveLength(
			1,
		);
		await expect
			.element(
				screen.getByRole('button', {
					name: `${m.gift_sort_by()}: ${m.gift_sort_owner_order()}`,
				}),
			)
			.not.toBeInTheDocument();
		await (display as HTMLButtonElement).click();
		const root = page.getByRole('menu', { name: m.gift_display_options() });
		await expect.element(root).toBeVisible();
		const sort = root.getByRole('menuitem', { name: new RegExp(m.gift_sort_by()) });
		const grouping = root.getByRole('menuitem', {
			name: new RegExp(m.gift_grouping_label()),
		});
		const filter = root.getByRole('menuitem', { name: new RegExp(m.gift_filter()) });
		await expect.element(sort).toBeVisible();
		await expect.element(grouping).toBeVisible();
		await expect.element(filter).toBeVisible();
		await sort.click();
		await expect.element(root).toBeVisible();
		await page.getByRole('menuitemradio', { name: m.gift_sort_name() }).click();
		expect(onsortchange).toHaveBeenCalledWith(GIFT_SORT_OPTIONS.name);
		await expect.element(root).toBeVisible();

		await root.getByRole('menuitem', { name: new RegExp(m.gift_grouping_label()) }).click();
		await page.getByRole('menuitemradio', { name: m.gift_grouping_priority() }).click();
		expect(ongroupingchange).toHaveBeenCalledWith(GIFT_GROUPING_OPTIONS.priority);
		await expect.element(root).toBeVisible();
		await root.getByRole('menuitem', { name: new RegExp(m.gift_filter()) }).click();
		await page.getByRole('menuitemcheckbox', { name: 'Knihy' }).click();
		expect(onfilterchange).toHaveBeenCalledWith({
			...defaultFilters,
			categoryValues: ['books'],
		});
		await expect.element(root).toBeVisible();
		await screen.unmount();
	});

	it('reuses shared filter option and group heading semantics in the nested desktop menu', async () => {
		const screen = await renderToolbar(
			{
				categoryFilterOptions: [{ value: 'books', label: 'Knihy' }],
				priorityFilterOptions: [{ value: 'high', label: 'Vysoká' }],
			},
			1280,
		);
		await frames(1);
		await screen.getByTestId('desktop-display-trigger').click();
		const root = page.getByRole('menu', { name: m.gift_display_options() });
		await root.getByRole('menuitem', { name: new RegExp(m.gift_filter()) }).click();
		const submenu = document.querySelector<HTMLElement>(
			'[data-slot="dropdown-menu-sub-content"]',
		)!;
		const options = submenu.querySelectorAll<HTMLElement>('[data-filter-option]');
		const headings = submenu.querySelectorAll<HTMLElement>('[data-filter-group-heading]');

		expect(options).toHaveLength(5);
		for (const option of options) {
			expect(option).toHaveAttribute('role', 'menuitemcheckbox');
		}
		expect(headings).toHaveLength(2);
		expect(Array.from(headings, (heading) => heading.textContent)).toEqual([
			m.gift_filter_category_heading(),
			m.gift_filter_priority_heading(),
		]);
		await screen.unmount();
	});

	it('enters and exits desktop reorder with a dedicated visible Done action', async () => {
		const onreordermodechange = vi.fn();
		const onviewmodechange = vi.fn();
		let screen = await renderToolbar(
			{
				canManage: true,
				role: WISHLIST_ROLES.moderator,
				onreordermodechange,
				onviewmodechange,
			},
			1280,
		);
		await screen.getByTestId('desktop-more-trigger').click();
		await page.getByRole('menuitem', { name: m.gift_reorder_action(), exact: true }).click();
		expect(onreordermodechange).toHaveBeenCalledWith(true);
		await screen.unmount();

		screen = await renderToolbar(
			{
				canManage: true,
				role: WISHLIST_ROLES.moderator,
				reorderMode: true,
				onreordermodechange,
				onviewmodechange,
			},
			1280,
		);
		const listMode = screen.getByRole('radio', { name: m.gift_view_list() });
		expect(listMode.element()).not.toBeDisabled();
		await listMode.click();
		expect(onviewmodechange).toHaveBeenCalledWith(GIFT_VIEW_MODES.list);
		await expect.element(screen.getByTestId('desktop-display-trigger')).toBeDisabled();
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_detail_add_gift_label() }))
			.toBeDisabled();
		await expect.element(screen.getByTestId('desktop-more-trigger')).not.toBeInTheDocument();
		const done = screen.getByRole('button', { name: m.gift_reorder_done(), exact: true });
		await expect.element(done).toBeVisible();
		expect(done.element()).toHaveTextContent(m.gift_reorder_done());
		expect((done.element() as HTMLElement).scrollWidth).toBeLessThanOrEqual(
			(done.element() as HTMLElement).clientWidth,
		);
		await done.click();
		expect(onreordermodechange).toHaveBeenLastCalledWith(false);
		await screen.unmount();
	});

	it('hands focus between desktop More and Done while preserving scroll', async () => {
		const props = {
			canManage: true,
			role: WISHLIST_ROLES.moderator,
		};
		const onreordermodechange = vi.fn((reorderMode: boolean) => {
			void screen.rerender({
				...defaultProps,
				...props,
				reorderMode,
				onreordermodechange,
			});
		});
		const screen = await renderToolbar({ ...props, onreordermodechange }, 1280);
		await frames(1);
		const initialScroll = { x: window.scrollX, y: window.scrollY };

		await screen.getByTestId('desktop-more-trigger').click();
		await page.getByRole('menuitem', { name: m.gift_reorder_action(), exact: true }).click();
		const done = screen.getByRole('button', { name: m.gift_reorder_done(), exact: true });
		await expect.element(done).toHaveFocus();
		expect({ x: window.scrollX, y: window.scrollY }).toEqual(initialScroll);

		await done.click();
		await expect.element(screen.getByTestId('desktop-more-trigger')).toHaveFocus();
		expect({ x: window.scrollX, y: window.scrollY }).toEqual(initialScroll);
		expect(onreordermodechange.mock.calls).toEqual([[true], [false]]);
		await screen.unmount();
	});

	it('keeps eligible actions in toolbar More without Settings or a separator before full reorder text', async () => {
		const screen = await renderToolbar(
			{ canManage: true, role: WISHLIST_ROLES.moderator },
			1280,
		);
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_settings_title() }))
			.not.toBeInTheDocument();
		await screen.getByTestId('desktop-more-trigger').click();
		const menu = page.getByRole('menu', { name: m.wishlist_more_actions() });
		await expect
			.element(menu.getByRole('menuitem', { name: m.gift_reorder_action(), exact: true }))
			.toBeVisible();
		await expect
			.element(menu.getByRole('menuitem', { name: m.batch_add_toolbar_label(), exact: true }))
			.toBeVisible();
		expect(menu.element().querySelector('[data-slot="dropdown-menu-separator"]')).toBeNull();
		expect(
			menu.getByRole('menuitem', { name: m.gift_reorder_action(), exact: true }).element(),
		).toHaveTextContent(m.gift_reorder_action());
		await screen.unmount();
	});
});
