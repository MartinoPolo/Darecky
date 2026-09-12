import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import * as m from '$lib/paraglide/messages.js';
import WishlistGiftDraggableWrapperTestHost from './WishlistGiftDraggableWrapperTestHost.svelte';

const baseProps = {
	index: 0,
	totalCount: 2,
	giftId: 'gift-alpha',
	draggedGiftId: null,
	dragOverGiftId: null,
	dragOverStyle: 'ring' as const,
	giftName: 'Alpha Gift',
	primaryLink: null,
	onopendetail: () => {},
	onreorderpointerdown: () => {},
	onreordermove: () => {},
};

describe('WishlistGiftDraggableWrapper — gift card opening (#284)', () => {
	it('opens the primary link in a new tab on middle-click', async () => {
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);
		const openDetail = vi.fn();
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			primaryLink: 'https://example.com/gift',
			onopendetail: openDetail,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;

		wrapper.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));

		expect(openDetail).not.toHaveBeenCalled();
		expect(open).toHaveBeenCalledWith(
			'https://example.com/gift',
			'_blank',
			'noopener,noreferrer',
		);
		open.mockRestore();
		await unmount();
	});

	it('normalizes a scheme-less primary link before opening it on middle-click', async () => {
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			primaryLink: 'example.com/gift',
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;

		wrapper.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));

		expect(open).toHaveBeenCalledWith(
			'https://example.com/gift',
			'_blank',
			'noopener,noreferrer',
		);
		open.mockRestore();
		await unmount();
	});

	it('does nothing on middle-click when the gift has no link', async () => {
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;

		wrapper.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));

		expect(open).not.toHaveBeenCalled();
		open.mockRestore();
		await unmount();
	});

	it('does not use the card primary link when middle-click starts on an inner control', async () => {
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			primaryLink: 'https://example.com/gift',
		});
		const innerButton = container.querySelector('button') as HTMLButtonElement;

		innerButton.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));

		expect(open).not.toHaveBeenCalled();
		open.mockRestore();
		await unmount();
	});

	it('preserves left-click detail opening', async () => {
		const openDetail = vi.fn();
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			primaryLink: 'https://example.com/gift',
			onopendetail: openDetail,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;

		wrapper.click();

		expect(openDetail).toHaveBeenCalledOnce();
		await unmount();
	});
});

describe('WishlistGiftDraggableWrapper — explicit reorder mode (#239)', () => {
	it('renders 40px directional controls in a single-column card and makes card actions inert', async () => {
		await page.viewport(320, 720);
		const onreordermove = vi.fn();
		const screen = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: true,
			onreordermove,
		});

		const grip = screen.getByRole('button', { name: m.gift_reorder_grip_label() });
		const moveUp = screen.getByRole('button', {
			name: m.gift_reorder_move_up({ name: baseProps.giftName }),
		});
		const moveDown = screen.getByRole('button', {
			name: m.gift_reorder_move_down({ name: baseProps.giftName }),
		});
		for (const control of [grip, moveUp, moveDown]) {
			await expect.element(control).toBeInTheDocument();
			const rect = control.element().getBoundingClientRect();
			expect(rect.width).toBeGreaterThanOrEqual(40);
			expect(rect.height).toBeGreaterThanOrEqual(40);
		}
		await expect.element(moveUp).toBeDisabled();
		const wrapper = document.querySelector('[data-gift-item]') as HTMLElement;
		expect(wrapper).not.toHaveAttribute('role');
		expect(wrapper).not.toHaveAttribute('tabindex');
		expect(wrapper).not.toHaveAttribute('aria-label');
		await userEvent.click(moveDown);
		expect(onreordermove).toHaveBeenCalledWith(0, 1);
		expect(document.querySelector('[data-selection-inert]')).toHaveAttribute('inert');
		await screen.unmount();
	});

	it('hides directional card controls at two-column widths while preserving grip keyboard reorder', async () => {
		await page.viewport(390, 720);
		const onreordermove = vi.fn();
		const screen = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: true,
			onreordermove,
		});
		const grip = screen.getByRole('button', { name: m.gift_reorder_grip_label() });
		const directionalActions = document.querySelector(
			'[data-testid="gift-reorder-directional-actions"]',
		) as HTMLElement;

		expect(getComputedStyle(directionalActions).display).toBe('none');
		grip.element().focus();
		await userEvent.keyboard('{ArrowRight}');
		expect(onreordermove).toHaveBeenCalledWith(0, 1);
		await screen.unmount();
	});

	it('does not render the reorder grip outside reorder mode', async () => {
		const screen = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
		});

		await expect
			.element(screen.getByRole('button', { name: m.gift_reorder_grip_label() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});
});

describe('WishlistGiftDraggableWrapper — context actions and selection', () => {
	it('dispatches keyboard context invocation outside selection mode', async () => {
		const openContext = vi.fn(() => true);
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			oncontextmenu: openContext,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;

		wrapper.dispatchEvent(
			new KeyboardEvent('keydown', {
				key: 'F10',
				shiftKey: true,
				bubbles: true,
				cancelable: true,
			}),
		);

		expect(openContext).toHaveBeenCalledOnce();
		await unmount();
	});

	it('suppresses context actions and makes descendants inert in selection mode', async () => {
		const openContext = vi.fn(() => true);
		const toggle = vi.fn();
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			selectionMode: true,
			selected: true,
			oncontextmenu: openContext,
			onselectiontoggle: toggle,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;

		wrapper.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

		expect(openContext).not.toHaveBeenCalled();
		expect(wrapper.getAttribute('role')).toBe('checkbox');
		expect(wrapper.getAttribute('aria-checked')).toBe('true');
		expect(wrapper.getAttribute('aria-selected')).toBe('true');
		expect(wrapper.getAttribute('aria-label')).toBe(
			m.gift_selection_item_aria({ name: 'Alpha Gift' }),
		);
		expect(container.querySelector('[data-selection-inert]')).toHaveAttribute('inert');
		await userEvent.click(wrapper);
		expect(toggle).toHaveBeenCalledWith('gift-alpha');
		await unmount();
	});

	it('anchors list selection checkbox inside the mobile image reserved corner', async () => {
		await page.viewport(390, 720);
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			selectionMode: true,
			selectionLayout: 'list',
			overlayModel: { kind: 'received', supportKind: 'unavailable' },
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;
		const image = container.querySelector('[data-testid="image-placeholder"]') as HTMLElement;
		const checkboxControl = wrapper.querySelector(
			'[data-testid="gift-selection-control"]',
		) as HTMLElement;
		const imageRect = image.getBoundingClientRect();
		const controlRect = checkboxControl.getBoundingClientRect();
		const imageHorizontalMidpoint = imageRect.left + imageRect.width / 2;
		const imageVerticalMidpoint = imageRect.top + imageRect.height / 2;

		expect(imageRect.width).toBeCloseTo(imageRect.height, 0);
		expect(controlRect.width).toBeCloseTo(40, 0);
		expect(controlRect.height).toBeCloseTo(40, 0);
		expect(controlRect.top).toBeGreaterThanOrEqual(imageRect.top);
		expect(controlRect.right).toBeLessThanOrEqual(imageRect.right - 4 + 0.5);
		expect(controlRect.bottom).toBeLessThanOrEqual(imageRect.bottom);
		expect(controlRect.left).toBeGreaterThanOrEqual(imageHorizontalMidpoint);
		expect(controlRect.top).toBeLessThan(imageVerticalMidpoint);
		for (const pill of container.querySelectorAll<HTMLElement>(
			'[data-testid="gift-state-overlay"] > span',
		)) {
			const pillRect = pill.getBoundingClientRect();
			expect(
				controlRect.left < pillRect.right &&
					controlRect.right > pillRect.left &&
					controlRect.top < pillRect.bottom &&
					controlRect.bottom > pillRect.top,
			).toBe(false);
		}
		expect(checkboxControl.querySelector('[data-slot="checkbox"]')).toBeNull();
		await userEvent.click(wrapper);
		await unmount();
	});

	it.each([
		{
			name: 'mobile Grid',
			width: 390,
			layout: 'overlay' as const,
			target: 60,
			visual: 40,
			targetInset: 0,
			visualInset: 4,
			visualRadius: '12px',
		},
		{
			name: 'mobile List',
			width: 390,
			layout: 'list' as const,
			target: 60,
			visual: 40,
			targetInset: 0,
			visualInset: 4,
			visualRadius: '12px',
		},
		{
			name: 'desktop Grid',
			width: 768,
			layout: 'overlay' as const,
			target: 32,
			visual: 24,
			targetInset: 4,
			visualInset: 8,
			visualRadius: '8px',
		},
		{
			name: 'desktop List',
			width: 768,
			layout: 'list' as const,
			target: 32,
			visual: 24,
			targetInset: 4,
			visualInset: 8,
			visualRadius: '8px',
		},
	])(
		'enlarges the $name target from the 40px/20px baseline and keeps it at top-left',
		async ({ width, layout, target, visual, targetInset, visualInset, visualRadius }) => {
			await page.viewport(width, 720);
			const onreorderpointerdown = vi.fn();
			const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
				...baseProps,
				reorderEnabled: true,
				selectionLayout: layout,
				overlayModel: { kind: 'received', supportKind: 'unavailable' },
				onreorderpointerdown,
			});
			const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;
			const grip = container.querySelector(
				`[aria-label="${m.gift_reorder_grip_label()}"]`,
			) as HTMLElement;
			const surface = grip.querySelector(
				':scope > [data-slot="elevation-surface"]',
			) as HTMLElement;
			const wrapperRect = wrapper.getBoundingClientRect();
			const gripRect = grip.getBoundingClientRect();
			const surfaceRect = surface.getBoundingClientRect();

			expect(gripRect.width).toBeCloseTo(target, 0);
			expect(gripRect.height).toBeCloseTo(target, 0);
			expect(surfaceRect.width).toBeCloseTo(visual, 0);
			expect(surfaceRect.height).toBeCloseTo(visual, 0);
			expect(gripRect.left - wrapperRect.left).toBeCloseTo(targetInset, 0);
			expect(gripRect.top - wrapperRect.top).toBeCloseTo(targetInset, 0);
			expect(surfaceRect.left - wrapperRect.left).toBeCloseTo(visualInset, 0);
			expect(surfaceRect.top - wrapperRect.top).toBeCloseTo(visualInset, 0);
			expect(getComputedStyle(surface).borderRadius).toBe(visualRadius);
			expect(getComputedStyle(grip).touchAction).toBe('none');

			grip.dispatchEvent(
				new PointerEvent('pointerdown', {
					bubbles: true,
					cancelable: true,
					pointerId: 1,
					pointerType: 'touch',
				}),
			);
			expect(onreorderpointerdown).toHaveBeenCalledWith(expect.any(PointerEvent), 0);

			for (const pill of container.querySelectorAll<HTMLElement>(
				'[data-testid="gift-state-overlay"] > span',
			)) {
				const pillRect = pill.getBoundingClientRect();
				const overlapsVisibleGrip =
					surfaceRect.left < pillRect.right &&
					surfaceRect.right > pillRect.left &&
					surfaceRect.top < pillRect.bottom &&
					surfaceRect.bottom > pillRect.top;
				expect(
					overlapsVisibleGrip,
					`grip ${JSON.stringify(surfaceRect.toJSON())}, badge ${JSON.stringify(pillRect.toJSON())}`,
				).toBe(false);
			}

			grip.focus();
			expect(getComputedStyle(grip).outlineStyle).toBe('solid');
			await unmount();
		},
	);

	it('leaves native interactive descendant context menus untouched outside selection mode', async () => {
		const openContext = vi.fn(() => false);
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			oncontextmenu: openContext,
		});
		const innerButton = container.querySelector(
			'[data-testid="inner-button"]',
		) as HTMLButtonElement;
		const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

		innerButton.dispatchEvent(event);

		expect(openContext).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
		await unmount();
	});

	it('suppresses the native menu on the noninteractive gift surface when the app declines', async () => {
		const openContext = vi.fn(() => false);
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			oncontextmenu: openContext,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;
		const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

		wrapper.dispatchEvent(event);

		expect(openContext).toHaveBeenCalledOnce();
		expect(event.defaultPrevented).toBe(true);
		await unmount();
	});
});
