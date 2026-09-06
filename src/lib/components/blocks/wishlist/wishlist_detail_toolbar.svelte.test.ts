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
	onsettings: () => {},
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
	const style = getComputedStyle(dialog);
	expect(style.bottom).toBe('0px');
	expect(parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
	expect(parseFloat(style.borderLeftWidth)).toBeGreaterThan(0);
	expect(parseFloat(style.borderRightWidth)).toBeGreaterThan(0);
	expect(parseFloat(style.borderTopLeftRadius)).toBeGreaterThan(0);
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
			{ adminSettingsAvailable: true },
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
					expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
				}
				await screen.unmount();
			}
		}
	});

	it('renders exactly one Display trigger below sm and keeps View, Settings, and Add gift direct', async () => {
		const screen = await renderToolbar({
			canManage: true,
			role: WISHLIST_ROLES.moderator,
		});
		const toolbar = screen.getByTestId('wishlist-toolbar').element();
		expect(toolbar.querySelectorAll('[data-testid="mobile-display-trigger"]')).toHaveLength(1);
		expect(toolbar.querySelector('[data-testid="mobile-sort-trigger"]')).toBeNull();
		expect(toolbar.querySelector('[data-testid="mobile-grouping-trigger"]')).toBeNull();
		expect(toolbar.querySelector('[data-testid="mobile-filter-trigger"]')).toBeNull();
		expect(toolbar.querySelectorAll('[data-testid="gift-view-switcher"]')).toHaveLength(1);
		const settings = screen
			.getByRole('button', { name: m.wishlist_settings_title() })
			.element();
		const add = screen
			.getByRole('button', { name: m.wishlist_detail_add_gift_label() })
			.element();
		await expect.element(settings).toBeVisible();
		await expect.element(add).toBeVisible();
		expect(visibleButtons(toolbar).at(-1)).toBe(add);
		expect(
			getComputedStyle(add.querySelector(':scope > .elevation-surface') as HTMLElement)
				.backgroundColor,
		).not.toBe('rgba(0, 0, 0, 0)');
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
		await expect
			.element(screen.getByRole('radio', { name: m.gift_sort_owner_order() }))
			.toBeChecked();

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
		await expect
			.element(more.getByRole('button', { name: m.batch_add_toolbar_label() }))
			.toBeVisible();
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

	it('shows an explicit reorder label and right-grouped 40px Done action', async () => {
		const onreordermodechange = vi.fn();
		const screen = await renderToolbar({
			canManage: true,
			role: WISHLIST_ROLES.moderator,
			reorderMode: true,
			onreordermodechange,
		});
		const row = screen
			.getByTestId('wishlist-toolbar-mobile')
			.element()
			.querySelector('[data-mobile-toolbar-row]')!;
		expect(row).toHaveTextContent(m.gift_reorder_mode_label());
		const done = screen
			.getByRole('button', { name: m.gift_reorder_done() })
			.element() as HTMLButtonElement;
		expect(done.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
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

describe('WishlistDetailToolbar desktop preservation (#340)', () => {
	afterEach(async () => {
		for (const host of hosts) {
			host.remove();
		}
		hosts.clear();
		await page.viewport(1280, 760);
	});

	it('keeps separate labeled display controls, persistence callbacks, and 32px sizing', async () => {
		const callbacks = {
			onviewmodechange: vi.fn(),
			onsortchange: vi.fn(),
			ongroupingchange: vi.fn(),
		};
		const screen = await renderToolbar(
			{
				...callbacks,
				canManage: true,
				role: WISHLIST_ROLES.moderator,
				groupingAvailability: { priority: true, category: true },
			},
			1280,
		);
		await frames(1);
		await expect.element(screen.getByTestId('mobile-display-trigger')).not.toBeInTheDocument();
		const sort = screen.getByRole('button', {
			name: `${m.gift_sort_by()}: ${m.gift_sort_owner_order()}`,
		});
		const grouping = screen.getByRole('button', {
			name: `${m.gift_grouping_label()}: ${m.gift_grouping_none()}`,
		});
		const filter = screen.getByRole('button', { name: m.gift_filter() });
		for (const control of [sort, grouping, filter]) {
			await expect.element(control).toBeVisible();
			expect(control.element().getBoundingClientRect().height).toBeCloseTo(32, 0);
		}
		await sort.click();
		await page.getByRole('option', { name: m.gift_sort_name() }).click();
		expect(callbacks.onsortchange).toHaveBeenCalledWith(GIFT_SORT_OPTIONS.name);
		await grouping.click();
		await page.getByRole('option', { name: m.gift_grouping_priority() }).click();
		expect(callbacks.ongroupingchange).toHaveBeenCalledWith(GIFT_GROUPING_OPTIONS.priority);
		await screen.getByTestId(`gift-view-${GIFT_VIEW_MODES.list}`).click();
		expect(callbacks.onviewmodechange).toHaveBeenCalledWith(GIFT_VIEW_MODES.list);
		await screen.unmount();
	});

	it('keeps the desktop management hierarchy and capability gates unchanged', async () => {
		const screen = await renderToolbar(
			{ canManage: true, role: WISHLIST_ROLES.recipient },
			1280,
		);
		const actions = screen.getByTestId('wishlist-toolbar-actions').element();
		const names = visibleButtons(actions).map(
			(button) => button.getAttribute('aria-label') ?? button.textContent?.trim(),
		);
		expect(names).toEqual([
			m.wishlist_settings_title(),
			m.batch_add_toolbar_label(),
			m.wishlist_detail_add_gift_label(),
		]);
		await screen.unmount();
	});
});
