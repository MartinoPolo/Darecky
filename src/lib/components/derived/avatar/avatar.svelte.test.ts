import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import Avatar from './Avatar.svelte';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const IMAGE =
	'data:image/svg+xml,' +
	encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>');

describe('Avatar variants', () => {
	it('preserves the sm rounded-square defaults', async () => {
		const screen = await render(Avatar, { src: null, alt: '', initials: 'AB' });
		const root = screen.container.querySelector('[data-slot="avatar"]') as HTMLElement;
		const fallback = root.firstElementChild as HTMLElement;

		expect(root.className).toContain('size-8');
		expect(root.className).toContain('rounded-xl');
		expect(root.className).not.toContain('rounded-full');
		expect(fallback.className).toContain('rounded-xl');
		await screen.unmount();
	});

	it.each([
		{ src: IMAGE, child: 'img' },
		{ src: null, child: 'span' },
	])('keeps a bordered circle concentric for the $child path', async ({ src, child }) => {
		const screen = await render(Avatar, {
			src,
			alt: src === null ? '' : 'Avatar',
			initials: 'AB',
			size: 'xs',
			shape: 'circle',
			bordered: true,
		});
		const root = screen.container.querySelector('[data-slot="avatar"]') as HTMLElement;
		const renderedChild = root.querySelector(child) as HTMLElement;

		expect(root.className).toContain('size-6');
		expect(root.className).toContain('rounded-full');
		expect(root.className).toContain('border-[2.5px]');
		expect(getComputedStyle(renderedChild).borderRadius).toBe('9.5px');
		expect(renderedChild.className).not.toContain('rounded-xl');
		await screen.unmount();
	});

	it.each([
		{ src: IMAGE, child: 'img' },
		{ src: null, child: 'span' },
	])(
		'renders the recipient appearance without sticker shadow for $child',
		async ({ src, child }) => {
			const screen = await render(Avatar, {
				src,
				alt: src === null ? '' : 'Avatar',
				initials: 'AB',
				appearance: 'recipient',
			});
			const root = screen.container.querySelector('[data-slot="avatar"]') as HTMLElement;
			const renderedChild = root.querySelector(child) as HTMLElement;
			const rootStyle = getComputedStyle(root);

			expect(root.getBoundingClientRect().width).toBe(24);
			expect(rootStyle.borderTopWidth).toBe('2px');
			expect(Number.parseFloat(rootStyle.borderRadius)).toBeGreaterThanOrEqual(12);
			expect(root.className).not.toContain('shadow-sticker-sm');
			expect(rootStyle.boxShadow).not.toMatch(/rgb\([^)]*\) [1-9]/);
			expect(getComputedStyle(renderedChild).borderRadius).toBe('10px');
			if (src === null) {
				expect(getComputedStyle(renderedChild).fontSize).toBe('10px');
				expect(getComputedStyle(renderedChild).fontWeight).toBe('800');
			}
			await screen.unmount();
		},
	);
});
