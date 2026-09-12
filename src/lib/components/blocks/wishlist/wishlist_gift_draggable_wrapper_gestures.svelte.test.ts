import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
