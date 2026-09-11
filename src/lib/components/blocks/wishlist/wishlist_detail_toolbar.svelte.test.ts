import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'svelte';
import * as m from '$lib/paraglide/messages.js';
import { GIFT_SORT_KEYS } from '$lib/components/blocks/gift/gift_sort_options.js';
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

function visibleButtons(root: Element) {
	return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).filter(
		(button) => button.getClientRects().length > 0,
	);
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

describe('WishlistDetailToolbar mobile command surfaces (#340)', () => {
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

	it('uses one non-clipping browse row at 320, 360, and 390px for representative capabilities', async () => {
		const capabilitySets: Partial<ComponentProps<typeof WishlistDetailToolbar>>[] = [
			{},
			{ isAuthenticated: true },
			{ canManage: true, role: WISHLIST_ROLES.recipient },
			{ canManage: true, role: WISHLIST_ROLES.moderator },
		];
		for (const width of [320, 360, 390]) {
			for (const capabilities of capabilitySets) {
				const screen = await renderToolbar(capabilities, width);
				await frames(1);
				const toolbar = screen.getByTestId('wishlist-toolbar').element() as HTMLElement;
				const rows = toolbar.querySelectorAll('[data-mobile-toolbar-row]');
				expect(rows).toHaveLength(1);
				expect(toolbar.scrollWidth).toBeLessThanOrEqual(toolbar.clientWidth);
				expect((rows[0] as HTMLElement).scrollWidth).toBeLessThanOrEqual(
					(rows[0] as HTMLElement).clientWidth,
				);
				for (const button of visibleButtons(toolbar)) {
					if (!button.closest('[data-testid="gift-view-switcher"]')) {
						expect(button.getBoundingClientRect().height).toBeCloseTo(32, 0);
					}
				}
				await screen.unmount();
			}
		}
	});

	it('keeps the integrated view tray and both items 40px on mobile and 32px from sm', async () => {
		const screen = await renderToolbar({}, 320);

		for (const [viewportWidth, expectedSize] of [
			[320, 40],
			[800, 32],
		] as const) {
			await page.viewport(viewportWidth, 760);
			await frames(1);
			const tray = screen.getByTestId('gift-view-switcher').element() as HTMLElement;
			const items = Array.from(
				tray.querySelectorAll<HTMLElement>('[data-slot="toggle-group-item"]'),
			);

			expect(tray.getBoundingClientRect().height).toBe(expectedSize);
			expect(items).toHaveLength(2);
			for (const item of items) {
				expect(item.getBoundingClientRect().width).toBe(expectedSize);
				expect(item.getBoundingClientRect().height).toBe(expectedSize);
			}
		}
		await screen.unmount();
	});

	it('renders exactly one Display trigger immediately after View with no toolbar Settings', async () => {
		const screen = await renderToolbar({
			canManage: true,
			role: WISHLIST_ROLES.moderator,
		});
		const toolbar = screen.getByTestId('wishlist-toolbar').element();
		const row = toolbar.querySelector('[data-mobile-toolbar-row]')!;
		const view = row.querySelector('[data-testid="gift-view-switcher"]')!;
		const display = row.querySelector('[data-testid="mobile-display-trigger"]')!;
		expect(toolbar.querySelectorAll('[data-testid="mobile-display-trigger"]')).toHaveLength(1);
		expect(view.nextElementSibling?.contains(display)).toBe(true);
		expect(toolbar.querySelector('[data-testid="mobile-sort-trigger"]')).toBeNull();
		expect(toolbar.querySelector('[data-testid="mobile-grouping-trigger"]')).toBeNull();
		expect(toolbar.querySelector('[data-testid="mobile-filter-trigger"]')).toBeNull();
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_settings_title() }))
			.not.toBeInTheDocument();
		const add = screen
			.getByRole('button', { name: m.wishlist_detail_add_gift_label() })
			.element();
		await expect.element(add).toBeVisible();
		expect(visibleButtons(toolbar).at(-1)).toBe(add);
		await screen.unmount();
	});

	it('opens one stable labeled Display sheet with exactly one selected section', async () => {
		const onsortchange = vi.fn();
		const ongroupingchange = vi.fn();
		const screen = await renderToolbar({
			onsortchange,
			ongroupingchange,
			groupingAvailability: { priority: true, category: false },
			categoryFilterOptions: [{ value: 'books', label: 'Knihy' }],
			priorityFilterOptions: [{ value: 'high', label: 'Vysoká' }],
		});
		await screen.getByTestId('mobile-display-trigger').click();
		const dialog = screen.getByRole('dialog', { name: m.gift_display_options() });
		await expect.element(dialog).toBeVisible();
		expectBottomSheet(dialog.element());
		const selectors = [
			screen.getByTestId('mobile-sheet-sort-switch'),
			screen.getByTestId('mobile-sheet-grouping-switch'),
			screen.getByTestId('mobile-sheet-filter-switch'),
		];
		for (const selector of selectors) {
			await expect.element(selector).toBeVisible();
		}
		expect(
			selectors.filter(
				(selector) => selector.element().getAttribute('aria-pressed') === 'true',
			),
		).toHaveLength(1);
		const selectedSort = screen
			.getByRole('radio', { name: m.gift_sort_owner_order() })
			.element();
		await expect.element(selectedSort).toBeChecked();
		expect(getComputedStyle(selectedSort.parentElement!).minHeight).toBe('48px');

		await selectors[1].click();
		expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
		expect(
			selectors.filter(
				(selector) => selector.element().getAttribute('aria-pressed') === 'true',
			),
		).toHaveLength(1);
		await expect
			.element(screen.getByRole('radio', { name: m.gift_grouping_category() }))
			.toBeDisabled();
		await screen.getByRole('radio', { name: m.gift_grouping_priority() }).click();
		expect(ongroupingchange).toHaveBeenCalledExactlyOnceWith(GIFT_GROUPING_OPTIONS.priority);
		await expect.element(dialog).not.toBeInTheDocument();
		await frames();
		await screen.unmount();
	});

	it('exposes a named radio group with arrow-key selection', async () => {
		const onsortchange = vi.fn();
		const screen = await renderToolbar({ onsortchange });
		await screen.getByTestId('mobile-display-trigger').click();
		const group = screen.getByRole('radiogroup', { name: m.gift_sort_by() });
		await expect.element(group).toBeVisible();
		const selected = group.getByRole('radio', { name: m.gift_sort_owner_order() });
		selected.element().focus();
		await userEvent.keyboard('{ArrowDown}');
		expect(onsortchange).toHaveBeenCalledWith(GIFT_SORT_KEYS[1]);
		await screen.unmount();
	});

	it('keeps every Display section at the dynamic height of the tallest available section', async () => {
		const initialOverrides: Partial<ComponentProps<typeof WishlistDetailToolbar>> = {
			groupingAvailability: { priority: true, category: true },
			categoryFilterOptions: [{ value: 'books', label: 'Knihy' }],
			priorityFilterOptions: [{ value: 'high', label: 'Vysoká' }],
		};
		const screen = await renderToolbar(initialOverrides);
		await screen.getByTestId('mobile-display-trigger').click();
		await frames();
		const dialog = screen.getByRole('dialog', { name: m.gift_display_options() }).element();
		await Promise.all(
			dialog.getAnimations({ subtree: true }).map((animation) => animation.finished),
		);
		const sectionButtons = [
			screen.getByTestId('mobile-sheet-sort-switch'),
			screen.getByTestId('mobile-sheet-grouping-switch'),
			screen.getByTestId('mobile-sheet-filter-switch'),
		];
		const initialHeight = dialog.getBoundingClientRect().height;
		expect(initialHeight).toBeLessThan(window.innerHeight * 0.8);

		for (const sectionButton of sectionButtons.slice(1)) {
			await sectionButton.click();
			await frames(1);
			expect(dialog.getBoundingClientRect().height).toBeCloseTo(initialHeight, 1);
		}

		const expandedCategories = Array.from({ length: 8 }, (_, index) => ({
			value: `category-${index}`,
			label: `Kategorie ${index}`,
		}));
		await screen.rerender({
			...defaultProps,
			...initialOverrides,
			categoryFilterOptions: expandedCategories,
		});
		await frames();
		const expandedHeight = dialog.getBoundingClientRect().height;
		expect(expandedHeight).toBeGreaterThan(initialHeight);
		expect(expandedHeight).toBeLessThanOrEqual(window.innerHeight * 0.8 + 1);

		for (const sectionButton of sectionButtons.slice(0, 2)) {
			await sectionButton.click();
			await frames(1);
			expect(dialog.getBoundingClientRect().height).toBeCloseTo(expandedHeight, 1);
		}
		await screen.unmount();
	});

	it('pins the section switcher after the independently scrolling options at narrow widths', async () => {
		const categoryFilterOptions = Array.from({ length: 8 }, (_, index) => ({
			value: `category-${index}`,
			label: `Kategorie ${index}`,
		}));
		const priorityFilterOptions = Array.from({ length: 5 }, (_, index) => ({
			value: `priority-${index}`,
			label: `Priorita ${index}`,
		}));

		for (const width of [320, 360, 390]) {
			const screen = await renderToolbar(
				{
					isAuthenticated: true,
					sortOption: GIFT_SORT_OPTIONS.name,
					filters: {
						...defaultFilters,
						withLinkOnly: true,
						categoryValues: ['category-0'],
					},
					groupingAvailability: { priority: true, category: true },
					categoryFilterOptions,
					priorityFilterOptions,
				},
				width,
			);
			await page.viewport(width, 500);
			await screen.getByTestId('mobile-display-trigger').click();
			await frames();
			const dialog = screen.getByRole('dialog', { name: m.gift_display_options() }).element();
			await Promise.all(
				dialog.getAnimations({ subtree: true }).map((animation) => animation.finished),
			);
			const scroll = screen.getByTestId('mobile-sheet-scroll').element() as HTMLElement;
			const switcher = screen.getByTestId('mobile-sheet-switcher').element() as HTMLElement;
			const sectionButtons = [
				screen.getByTestId('mobile-sheet-sort-switch'),
				screen.getByTestId('mobile-sheet-grouping-switch'),
				screen.getByTestId('mobile-sheet-filter-switch'),
			];
			const switcherBounds = switcher.getBoundingClientRect();
			const dialogBounds = dialog.getBoundingClientRect();
			const bottomSafeArea = parseFloat(getComputedStyle(dialog).paddingBottom);

			expect(dialogBounds.height).toBeCloseTo(400, 0);
			expect(
				scroll.compareDocumentPosition(switcher) & Node.DOCUMENT_POSITION_FOLLOWING,
			).toBeTruthy();
			expect(getComputedStyle(scroll).overflowY).toBe('auto');
			expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
			expect(scroll.getBoundingClientRect().bottom).toBeLessThanOrEqual(
				switcherBounds.top + 1,
			);
			expect(switcherBounds.bottom).toBeLessThanOrEqual(
				dialogBounds.bottom - bottomSafeArea + 1,
			);

			scroll.scrollTop = scroll.scrollHeight;
			await frames(1);
			const scrolledSwitcherBounds = switcher.getBoundingClientRect();
			expect(scrolledSwitcherBounds.x).toBeCloseTo(switcherBounds.x, 1);
			expect(scrolledSwitcherBounds.y).toBeCloseTo(switcherBounds.y, 1);
			expect(scrolledSwitcherBounds.width).toBeCloseTo(switcherBounds.width, 1);
			expect(scrolledSwitcherBounds.height).toBeCloseTo(switcherBounds.height, 1);

			for (const sectionButton of sectionButtons.slice(1)) {
				await sectionButton.click();
				await frames(1);
				const currentBounds = switcher.getBoundingClientRect();
				expect(currentBounds.x).toBeCloseTo(switcherBounds.x, 1);
				expect(currentBounds.y).toBeCloseTo(switcherBounds.y, 1);
				expect(currentBounds.width).toBeCloseTo(switcherBounds.width, 1);
				expect(currentBounds.height).toBeCloseTo(switcherBounds.height, 1);
				expect(
					sectionButtons.filter(
						(button) => button.element().getAttribute('aria-pressed') === 'true',
					),
				).toHaveLength(1);
				expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
			}

			await sectionButtons[0].click();
			await expect
				.element(screen.getByRole('radio', { name: m.gift_sort_name() }))
				.toBeChecked();
			expect(screen.getByTestId('mobile-display-trigger').element()).toHaveTextContent('2');
			await sectionButtons[2].click();
			await expect
				.element(screen.getByRole('checkbox', { name: m.gift_filter_with_link() }))
				.toBeChecked();
			await expect
				.element(screen.getByRole('checkbox', { name: 'Kategorie 0' }))
				.toBeChecked();
			(
				screen.getByTestId('mobile-sheet-grouping-switch').element() as HTMLButtonElement
			).focus();
			await expect.element(screen.getByTestId('mobile-sheet-grouping-switch')).toHaveFocus();
			expect(switcher.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
			await screen.unmount();
		}
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
			expect(option.className).toContain('cursor-pointer');
			expect(option.className).toContain('whitespace-normal');
			expect(option.className).toContain('data-[highlighted]:bg-accent');
		}
		expect(headings).toHaveLength(2);
		for (const heading of headings) {
			expect(heading.className).toContain('pointer-events-none');
			expect(heading.className).toContain('uppercase');
		}
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
