<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, waitFor, within } from 'storybook/test';
	import FilterMenu from './FilterMenu.svelte';

	const { Story } = defineMeta({
		title: 'Derived/FilterMenu',
		component: FilterMenu,
		tags: ['autodocs'],
	});

	const playFiltersAndClears = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);
		const trigger = canvas.getByRole('button', { name: 'Filtrovat: 3 aktivní' });
		const received = await body.findByRole('menuitemcheckbox', {
			name: 'Zobrazit obdržené',
		});

		await expect(received).not.toBeChecked();
		await userEvent.click(received);
		await expect(received).toBeChecked();
		await expect(trigger).toHaveAccessibleName('Filtrovat: 4 aktivní');

		await userEvent.click(body.getByRole('menuitem', { name: 'Zrušit filtry' }));
		await waitFor(() => expect(trigger).toHaveAccessibleName('Filtrovat'));
		await expect(trigger).toHaveFocus();
	};
</script>

<script lang="ts">
	import type { FilterDefinition, FilterFacetGroup } from './filter_menu_types.js';

	let open = $state(true);
	let linked = $state(true);
	let received = $state(false);
	let selectedCategories = $state(['electronics']);
	let selectedPriorities = $state(['high', 'medium']);

	const definitions = $derived<FilterDefinition[]>([
		{
			id: 'linked',
			menuLabel: 'S odkazem',
			checked: linked,
			onchange: (checked) => (linked = checked),
		},
		{
			id: 'received',
			menuLabel: 'Zobrazit obdržené',
			checked: received,
			onchange: (checked) => (received = checked),
		},
	]);
	const facets = $derived<FilterFacetGroup[]>([
		{
			id: 'category',
			label: 'Kategorie',
			options: ['Hry', 'Elektronika', 'Bez kategorie'].map((label) => {
				const value = label.toLocaleLowerCase('cs');
				return {
					value,
					label,
					checked: selectedCategories.includes(value),
					onchange: (checked: boolean) => {
						selectedCategories = checked
							? [...selectedCategories, value]
							: selectedCategories.filter((category) => category !== value);
					},
				};
			}),
		},
		{
			id: 'priority',
			label: 'Priorita',
			options: [
				{ value: 'high', label: 'Vysoká' },
				{ value: 'medium', label: 'Střední' },
				{ value: 'low', label: 'Nízká' },
				{ value: 'none', label: 'Bez priority' },
			].map(({ value, label }) => ({
				value,
				label,
				checked: selectedPriorities.includes(value),
				onchange: (checked: boolean) => {
					selectedPriorities = checked
						? [...selectedPriorities, value]
						: selectedPriorities.filter((priority) => priority !== value);
				},
			})),
		},
	]);

	function clearAll() {
		linked = false;
		received = false;
		selectedCategories = [];
		selectedPriorities = [];
	}
</script>

<Story name="Grouped options [play: filter and clear]" play={playFiltersAndClears}>
	{#snippet template()}
		<div class="min-h-130 p-6">
			<FilterMenu
				{definitions}
				{facets}
				{open}
				onopenchange={(nextOpen) => (open = nextOpen)}
				showActivePills={false}
				alwaysShowClearAllInMenu
				triggerLabel="Filtrovat"
				menuHeading="Filtrovat"
				clearAllLabel="Zrušit filtry"
				onclearall={clearAll}
				removeFilterLabel={(label) => `Odebrat filtr ${label}`}
				activeCountLabel={(count) => `${count} aktivní`}
			/>
		</div>
	{/snippet}
</Story>
