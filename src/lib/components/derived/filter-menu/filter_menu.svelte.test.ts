import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import ActiveFilterPillsTestHost from './ActiveFilterPillsTestHost.svelte';
import FilterMenu from './FilterMenu.svelte';
import type { FilterDefinition, FilterFacetGroup } from './filter_menu_types.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

function baseProps() {
	return {
		triggerLabel: 'Filtr',
		menuHeading: 'Filtr',
		clearAllLabel: 'Vymazat',
		onclearall: () => {},
		removeFilterLabel: (label: string) => `Odebrat ${label}`,
		activeCountLabel: (count: number) => `${count} aktivních`,
	};
}

describe('FilterMenu facets', () => {
	it('visually distinguishes non-clickable headings from clickable filter options', async () => {
		const definitions: FilterDefinition[] = [
			{ id: 'available', menuLabel: 'Dostupné', checked: false, onchange: () => {} },
		];
		const facets: FilterFacetGroup[] = [
			{
				id: 'category',
				label: 'Kategorie',
				options: [
					{ value: 'books', label: 'Knihy', checked: false, onchange: () => {} },
					{ value: 'toys', label: 'Hračky', checked: true, onchange: () => {} },
				],
			},
		];
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(
			FilterMenu,
			{ ...baseProps(), definitions, facets },
			{ baseElement: host },
		);

		await screen.getByRole('button', { name: 'Filtr' }).click();

		const headings = document.querySelectorAll<HTMLElement>('[data-filter-group-heading]');
		expect(headings).toHaveLength(2);
		expect(getComputedStyle(headings[0]).textTransform).toBe('uppercase');
		expect(getComputedStyle(headings[0]).pointerEvents).toBe('none');
		const options = document.querySelectorAll<HTMLElement>('[data-filter-option]');
		expect(options).toHaveLength(3);
		expect(options[0].getAttribute('role')).toBe('menuitemcheckbox');
		expect(getComputedStyle(options[0]).cursor).toBe('pointer');
		const uncheckedIndicator = options[0].querySelector<HTMLElement>(
			'[data-slot="dropdown-menu-checkbox-item-indicator"]',
		);
		expect(uncheckedIndicator).not.toBeNull();
		expect(getComputedStyle(uncheckedIndicator!).borderStyle).toBe('solid');
	});

	it('inherits viewport-only containment from shared dropdown content', async () => {
		const definitions: FilterDefinition[] = [
			{ id: 'available', menuLabel: 'Dostupné', checked: false, onchange: () => {} },
		];
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(
			FilterMenu,
			{ ...baseProps(), definitions },
			{ baseElement: host },
		);

		await screen.getByRole('button', { name: 'Filtr' }).click();
		const content = document.querySelector<HTMLElement>('[data-slot="dropdown-menu-content"]');
		expect(content).not.toBeNull();
		expect(getComputedStyle(content!).maxHeight).toBe(`${window.innerHeight - 16}px`);
		expect(getComputedStyle(content!).overflowY).toBe('auto');
	});

	it('keeps a full-height constrained menu inside the viewport', async () => {
		const definitions: FilterDefinition[] = Array.from({ length: 12 }, (_, index) => ({
			id: `option-${index}`,
			menuLabel: `Možnost ${index}`,
			checked: false,
			onchange: () => {},
		}));
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(
			FilterMenu,
			{ ...baseProps(), definitions },
			{ baseElement: host },
		);
		const trigger = screen.getByRole('button', { name: 'Filtr' }).element();
		trigger.style.position = 'fixed';
		trigger.style.top = '50vh';
		trigger.style.left = '50vw';
		trigger.style.width = 'max-content';

		await screen.getByRole('button', { name: 'Filtr' }).click();
		const content = document.querySelector<HTMLElement>('[data-slot="dropdown-menu-content"]');
		expect(content).not.toBeNull();
		const rect = content!.getBoundingClientRect();
		expect(rect.top).toBeGreaterThanOrEqual(7);
		expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight - 7);
		expect(content!.clientHeight).toBe(content!.scrollHeight);
	});

	it('counts each selected facet value as one active filter and renders a pill', async () => {
		const definitions: FilterDefinition[] = [
			{ id: 'available', menuLabel: 'Dostupné', checked: true, onchange: () => {} },
		];
		const facets: FilterFacetGroup[] = [
			{
				id: 'category',
				label: 'Kategorie',
				options: [
					{ value: 'books', label: 'Knihy', checked: true, onchange: () => {} },
					{ value: 'toys', label: 'Hračky', checked: false, onchange: () => {} },
				],
			},
		];

		const host = document.createElement('div');
		document.body.appendChild(host);
		await render(FilterMenu, { ...baseProps(), definitions, facets }, { baseElement: host });
		await tick();

		const trigger = document.querySelector('button') as HTMLElement;
		expect(trigger.textContent).toContain('2');

		const pills = document.querySelector('[data-filter-pills]') as HTMLElement;
		expect(pills.textContent).toContain('Dostupné');
		expect(pills.textContent).toContain('Knihy');
		expect(pills.textContent).not.toContain('Hračky');
	});

	it('removes a filter reactively, hides its pill, and moves focus to the next pill', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(ActiveFilterPillsTestHost, {}, { baseElement: host });

		await screen.getByRole('button', { name: 'Odebrat První' }).click();

		await expect
			.element(screen.getByRole('button', { name: 'Odebrat První' }))
			.not.toBeInTheDocument();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Odebrat Druhý' }).element(),
		);
	});

	it('moves focus to the previous pill when removing the final active pill', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(ActiveFilterPillsTestHost, {}, { baseElement: host });

		await screen.getByRole('button', { name: 'Odebrat Druhý' }).click();

		await expect
			.element(screen.getByRole('button', { name: 'Odebrat Druhý' }))
			.not.toBeInTheDocument();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Odebrat První' }).element(),
		);
	});

	it('restores trigger focus when removing the sole active pill', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(
			ActiveFilterPillsTestHost,
			{ initialActiveIds: ['first'] },
			{ baseElement: host },
		);

		await screen.getByRole('button', { name: 'Odebrat První' }).click();

		await expect
			.element(screen.getByRole('button', { name: 'Odebrat První' }))
			.not.toBeInTheDocument();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Filtr' }).element(),
		);
	});

	it('clears filters reactively, hides all pills, and restores trigger focus', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const screen = await render(ActiveFilterPillsTestHost, {}, { baseElement: host });

		await screen.getByRole('button', { name: 'Vymazat' }).click();

		await expect
			.element(screen.getByRole('button', { name: 'Odebrat První' }))
			.not.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: 'Odebrat Druhý' }))
			.not.toBeInTheDocument();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Filtr' }).element(),
		);
	});

	it('renders no facet group when the prop is omitted', async () => {
		const definitions: FilterDefinition[] = [
			{ id: 'available', menuLabel: 'Dostupné', checked: false, onchange: () => {} },
		];
		const host = document.createElement('div');
		document.body.appendChild(host);
		await render(FilterMenu, { ...baseProps(), definitions }, { baseElement: host });
		await tick();

		expect(document.body.textContent).not.toContain('Kategorie');
	});
});
