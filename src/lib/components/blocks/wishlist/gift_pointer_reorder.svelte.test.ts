import '../../../../app.css';
import { describe, expect, it } from 'vitest';
import { createGiftPointerReorderController } from './gift_pointer_reorder.svelte.js';

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
