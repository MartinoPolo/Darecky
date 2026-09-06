import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import * as m from '$lib/paraglide/messages.js';
import WishlistGiftDraggableWrapperTestHost from './WishlistGiftDraggableWrapperTestHost.svelte';
import { createGiftPointerReorderController } from './gift_pointer_reorder.svelte.js';

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

describe('WishlistGiftDraggableWrapper — grip follows the card hover lift', () => {
	it('scopes hover to the shared wrapper so the grip tracks the card lift', async () => {
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: true,
		});

		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;
		expect(wrapper.className).toContain('group/gift-card');
		const grip = wrapper.querySelector('button') as HTMLElement;
		const gripSurface = grip.querySelector(':scope > .elevation-surface') as HTMLElement;
		expect(grip.className).not.toContain('group-hover/gift-card:-translate-y-1');
		expect(grip.className).not.toContain('group-focus-within/gift-card:-translate-y-1');
		expect(gripSurface.className).toContain('group-hover/gift-card:-translate-y-0.5');
		expect(gripSurface.className).toContain('group-focus-within/gift-card:-translate-y-0.5');
		await unmount();
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

		expect(imageRect.width).toBeCloseTo(128, 0);
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

	it('anchors the list reorder grip inside the mobile image reserved corner', async () => {
		await page.viewport(390, 720);
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: true,
			selectionLayout: 'list',
			overlayModel: { kind: 'received', supportKind: 'unavailable' },
		});
		const image = container.querySelector('[data-testid="image-placeholder"]') as HTMLElement;
		const grip = container.querySelector(
			`[aria-label="${m.gift_reorder_grip_label()}"]`,
		) as HTMLElement;
		const imageRect = image.getBoundingClientRect();
		const gripRect = grip.getBoundingClientRect();
		const imageHorizontalMidpoint = imageRect.left + imageRect.width / 2;
		const imageVerticalMidpoint = imageRect.top + imageRect.height / 2;

		expect(imageRect.width).toBeCloseTo(128, 0);
		expect(gripRect.width).toBeCloseTo(40, 0);
		expect(gripRect.height).toBeCloseTo(40, 0);
		expect(gripRect.top).toBeGreaterThanOrEqual(imageRect.top);
		expect(gripRect.right).toBeLessThanOrEqual(imageRect.right - 4 + 0.5);
		expect(gripRect.bottom).toBeLessThanOrEqual(imageRect.bottom);
		expect(gripRect.left).toBeGreaterThanOrEqual(imageHorizontalMidpoint);
		expect(gripRect.top).toBeLessThan(imageVerticalMidpoint);
		for (const pill of container.querySelectorAll<HTMLElement>(
			'[data-testid="gift-state-overlay"] > span',
		)) {
			const pillRect = pill.getBoundingClientRect();
			expect(
				gripRect.left < pillRect.right &&
					gripRect.right > pillRect.left &&
					gripRect.top < pillRect.bottom &&
					gripRect.bottom > pillRect.top,
			).toBe(false);
		}
		await unmount();
	});

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

afterEach(() => {
	vi.useRealTimers();
});

describe('WishlistGiftDraggableWrapper — touch gestures', () => {
	it('leaves touch scrolling unblocked outside the reorder handle', async () => {
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: true,
		});
		const content = container.querySelector('[data-testid="card-placeholder"]') as HTMLElement;
		const down = new PointerEvent('pointerdown', {
			bubbles: true,
			cancelable: true,
			pointerId: 1,
			pointerType: 'touch',
			clientX: 80,
			clientY: 80,
		});

		content.dispatchEvent(down);

		expect(down.defaultPrevented).toBe(false);
		expect(getComputedStyle(content).touchAction).not.toBe('none');
		await unmount();
	});

	it('opens detail after a short touch tap without preventing the synthesized click', async () => {
		const openDetail = vi.fn();
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			onopendetail: openDetail,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;
		const down = new PointerEvent('pointerdown', {
			bubbles: true,
			cancelable: true,
			pointerId: 1,
			pointerType: 'touch',
			clientX: 12,
			clientY: 18,
		});

		wrapper.dispatchEvent(down);
		wrapper.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				cancelable: true,
				pointerId: 1,
				pointerType: 'touch',
			}),
		);
		wrapper.click();

		expect(down.defaultPrevented).toBe(false);
		expect(openDetail).toHaveBeenCalledOnce();
		await unmount();
	});

	it('opens context on a completed long press without opening detail behind it', async () => {
		vi.useFakeTimers();
		const openDetail = vi.fn();
		const openContext = vi.fn(() => true);
		const { container, unmount } = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			onopendetail: openDetail,
			onlongpress: openContext,
		});
		const wrapper = container.querySelector('[data-gift-item]') as HTMLElement;

		wrapper.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				cancelable: true,
				pointerId: 1,
				pointerType: 'touch',
				clientX: 12,
				clientY: 18,
			}),
		);
		vi.advanceTimersByTime(600);
		wrapper.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				cancelable: true,
				pointerId: 1,
				pointerType: 'touch',
			}),
		);
		wrapper.click();
		wrapper.click();

		expect(openContext).toHaveBeenCalledOnce();
		expect(openDetail).toHaveBeenCalledTimes(1);
		await unmount();
	});

	it('cancels only the pending long press when touch scrolling starts', async () => {
		vi.useFakeTimers();
		const openContext = vi.fn(() => true);
		const screen = await render(WishlistGiftDraggableWrapperTestHost, {
			...baseProps,
			reorderEnabled: false,
			onlongpress: openContext,
		});
		const wrapper = document.querySelector('[data-gift-item]') as HTMLElement;

		wrapper.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				cancelable: true,
				pointerId: 1,
				pointerType: 'touch',
				clientX: 12,
				clientY: 18,
			}),
		);
		document.dispatchEvent(new Event('scroll'));
		vi.advanceTimersByTime(600);

		expect(openContext).not.toHaveBeenCalled();
		await screen.unmount();
	});
});

describe('gift pointer reorder controller (#239)', () => {
	function createItems() {
		return ['a', 'b', 'c'].map((id, index) => {
			const element = document.createElement('div');
			element.dataset.giftId = id;
			element.textContent = id;
			Object.defineProperty(element, 'getBoundingClientRect', {
				value: () => ({
					x: index * 100,
					y: 20,
					left: index * 100,
					top: 20,
					right: index * 100 + 80,
					bottom: 80,
					width: 80,
					height: 60,
					toJSON: () => {},
				}),
			});
			document.body.append(element);
			return element;
		});
	}

	function pointer(type: string, pointerId: number, clientX: number, clientY: number) {
		return new PointerEvent(type, {
			pointerId,
			pointerType: 'pen',
			button: 0,
			clientX,
			clientY,
			bubbles: true,
			cancelable: true,
		});
	}

	it('keeps an exact-size overlay and commits every live previewed id', () => {
		const items = createItems();
		const previews: string[][] = [];
		const commits: string[][] = [];
		const controller = createGiftPointerReorderController({
			getItemElements: () => items,
			getItemIds: () => ['a', 'b', 'c'],
			onPreviewOrder: (ids) => previews.push(ids),
			onCommitOrder: (ids) => commits.push(ids),
			onCancelOrder: () => {},
		});

		controller.start(pointer('pointerdown', 7, 20, 40), 0);
		const overlay = document.querySelector<HTMLElement>('[data-gift-reorder-overlay]');
		expect(overlay?.style.width).toBe('80px');
		expect(overlay?.style.height).toBe('60px');
		expect(overlay?.textContent).toBe('a');
		expect(items[0]!.style.visibility).toBe('hidden');

		window.dispatchEvent(pointer('pointermove', 7, 240, 40));
		expect(previews).toEqual([['b', 'c', 'a']]);
		window.dispatchEvent(pointer('pointerup', 7, 240, 40));
		expect(commits).toEqual([['b', 'c', 'a']]);
		expect(document.querySelector('[data-gift-reorder-overlay]')).toBeNull();
		expect(items[0]!.style.visibility).toBe('');
		items.forEach((item) => item.remove());
	});

	it('retains inherited wishlist theme properties and card layout in the body overlay', () => {
		const theme = document.createElement('div');
		theme.style.setProperty('--wishlist-surface', 'rgb(96, 24, 48)');
		theme.style.setProperty('--frame-fill', 'rgb(244, 220, 228)');
		const item = document.createElement('div');
		item.dataset.giftId = 'themed';
		item.style.display = 'grid';
		item.style.gridTemplateRows = '40px 80px';
		item.innerHTML =
			'<div data-image style="background: var(--frame-fill)">Image</div><div data-body style="background: var(--wishlist-surface)"><span>Badge</span><button>Action</button></div>';
		Object.defineProperty(item, 'getBoundingClientRect', {
			value: () => ({
				x: 12,
				y: 20,
				left: 12,
				top: 20,
				right: 212,
				bottom: 140,
				width: 200,
				height: 120,
				toJSON: () => {},
			}),
		});
		theme.append(item);
		document.body.append(theme);
		const controller = createGiftPointerReorderController({
			getItemElements: () => [item],
			getItemIds: () => ['themed'],
			onPreviewOrder: () => {},
			onCommitOrder: () => {},
			onCancelOrder: () => {},
		});

		controller.start(pointer('pointerdown', 13, 30, 40), 0);
		const overlay = document.querySelector<HTMLElement>('[data-gift-reorder-overlay]')!;
		const image = overlay.querySelector<HTMLElement>('[data-image]')!;
		const body = overlay.querySelector<HTMLElement>('[data-body]')!;

		expect(overlay.parentElement).toBe(document.body);
		expect(overlay.style.width).toBe('200px');
		expect(overlay.style.height).toBe('120px');
		expect(overlay.style.getPropertyValue('--wishlist-surface')).toBe('rgb(96, 24, 48)');
		expect(overlay.style.getPropertyValue('--frame-fill')).toBe('rgb(244, 220, 228)');
		expect(getComputedStyle(body).backgroundColor).toBe('rgb(96, 24, 48)');
		expect(getComputedStyle(image).backgroundColor).toBe('rgb(244, 220, 228)');
		expect(Array.from(overlay.children).map((child) => child.textContent)).toEqual([
			'Image',
			'BadgeAction',
		]);
		expect(body.querySelector('span')?.textContent).toBe('Badge');
		expect(body.querySelector('button')?.textContent).toBe('Action');

		controller.destroy();
		theme.remove();
	});

	it('preserves every subgrid row when the card overlay leaves its grid parent', () => {
		const grid = document.createElement('div');
		grid.style.display = 'grid';
		grid.style.gridTemplateRows = '80px 24px 20px 18px 16px 14px 42px';
		grid.style.rowGap = '20px';
		const item = document.createElement('div');
		item.dataset.giftId = 'subgrid-card';
		item.style.display = 'grid';
		item.style.gridRow = 'span 7';
		item.style.gridTemplateRows = 'subgrid';
		item.style.rowGap = '0';
		item.innerHTML = `
			<div style="display: grid; grid-row: span 7; grid-template-rows: subgrid">
				<div data-layout-part style="grid-row: 1">Image</div>
				<div data-layout-part style="display: grid; grid-row: 2 / span 5; grid-template-rows: subgrid">
					<span data-layout-part style="grid-row: 1">Name</span>
					<a data-layout-part style="grid-row: 4">Link</a>
				</div>
				<button data-layout-part style="grid-row: 7">Action</button>
			</div>`;
		grid.append(item);
		document.body.append(grid);
		const controller = createGiftPointerReorderController({
			getItemElements: () => [item],
			getItemIds: () => ['subgrid-card'],
			onPreviewOrder: () => {},
			onCommitOrder: () => {},
			onCancelOrder: () => {},
		});
		const sourceRect = item.getBoundingClientRect();
		const relativeLayout = (root: HTMLElement) => {
			const rootRect = root.getBoundingClientRect();
			return Array.from(root.querySelectorAll<HTMLElement>('[data-layout-part]')).map(
				(element) => {
					const rect = element.getBoundingClientRect();
					return { top: rect.top - rootRect.top, height: rect.height };
				},
			);
		};
		const sourceLayout = relativeLayout(item);

		controller.start(pointer('pointerdown', 13, sourceRect.left + 10, sourceRect.top + 10), 0);
		const overlay = document.querySelector<HTMLElement>('[data-gift-reorder-overlay]')!;

		try {
			expect(relativeLayout(overlay)).toEqual(sourceLayout);
			expect(getComputedStyle(overlay).gridTemplateRows).not.toContain('subgrid');
		} finally {
			controller.destroy();
			grid.remove();
		}
	});

	it('keeps stationary boundary hit testing anchored when preview layout shifts under it', () => {
		let renderedIds = ['a', 'b', 'c'];
		let shiftedByPreview = false;
		const elementsById = new Map(
			renderedIds.map((id) => {
				const element = document.createElement('div');
				element.dataset.giftId = id;
				element.textContent = id;
				Object.defineProperty(element, 'getBoundingClientRect', {
					value: () => {
						const leftById = shiftedByPreview
							? { a: 300, b: 0, c: 200 }
							: { a: 0, b: 100, c: 200 };
						const left = leftById[id as keyof typeof leftById];

						return {
							x: left,
							y: 20,
							left,
							top: 20,
							right: left + 80,
							bottom: 80,
							width: 80,
							height: 60,
							toJSON: () => {},
						};
					},
				});
				document.body.append(element);
				return [id, element] as const;
			}),
		);
		const previews: string[][] = [];
		const controller = createGiftPointerReorderController({
			getItemElements: () => renderedIds.map((id) => elementsById.get(id)!),
			getItemIds: () => [...renderedIds],
			onPreviewOrder: (ids) => {
				previews.push(ids);
				renderedIds = [...ids];
				shiftedByPreview = true;
			},
			onCommitOrder: () => {},
			onCancelOrder: () => {},
		});

		controller.start(pointer('pointerdown', 11, 20, 40), 0);
		window.dispatchEvent(pointer('pointermove', 11, 240, 40));
		window.dispatchEvent(pointer('pointermove', 11, 240, 40));

		expect(previews).toEqual([['b', 'c', 'a']]);
		controller.destroy();
		elementsById.forEach((element) => element.remove());
	});

	it.each([
		['pointercancel', () => window.dispatchEvent(pointer('pointercancel', 9, 240, 40))],
		['Escape', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))],
	])('restores the pre-drag order on %s without committing', (_name, cancelDrag) => {
		const items = createItems();
		const cancellations: string[][] = [];
		const commits: string[][] = [];
		const controller = createGiftPointerReorderController({
			getItemElements: () => items,
			getItemIds: () => ['a', 'b', 'c'],
			onPreviewOrder: () => {},
			onCommitOrder: (ids) => commits.push(ids),
			onCancelOrder: (ids) => cancellations.push(ids),
		});

		controller.start(pointer('pointerdown', 9, 120, 40), 1);
		window.dispatchEvent(pointer('pointermove', 9, 240, 40));
		cancelDrag();
		expect(cancellations).toEqual([['a', 'b', 'c']]);
		expect(commits).toEqual([]);
		expect(document.querySelector('[data-gift-reorder-overlay]')).toBeNull();
		controller.destroy();
		items.forEach((item) => item.remove());
	});
});
