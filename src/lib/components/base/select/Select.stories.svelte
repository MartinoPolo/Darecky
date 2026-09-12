<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, waitFor, within } from 'storybook/test';
	import * as Select from './index.js';
	import SelectRoot from './select.svelte';
	import { Label } from '$lib/components/base/label/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import StoryKeyboardHints from '$lib/storybook/StoryKeyboardHints.svelte';
	import KeyboardHint from '$lib/storybook/KeyboardHint.svelte';

	const { Story } = defineMeta({
		title: 'Base/Select',
		component: SelectRoot,
		tags: ['autodocs'],
	});

	function getSelectTrigger(canvasElement: HTMLElement): HTMLElement {
		return canvasElement.querySelector('[data-slot="select-trigger"]') as HTMLElement;
	}

	function querySelectListbox(canvasElement: HTMLElement): HTMLElement | null {
		return canvasElement.querySelector('[role="listbox"]');
	}

	function getSelectListbox(canvasElement: HTMLElement): HTMLElement {
		const listbox = querySelectListbox(canvasElement);
		if (listbox == null) {
			throw new Error('Select listbox not found');
		}
		return listbox;
	}

	async function openSelect(trigger: HTMLElement, canvasElement: HTMLElement) {
		trigger.focus();
		await expect(trigger).toHaveFocus();
		await userEvent.keyboard('{ArrowDown}');
		await waitFor(() => {
			expect(trigger).toHaveAttribute('aria-expanded', 'true');
			expect(getSelectListbox(canvasElement)).toBeInTheDocument();
		});
	}

	const playOpenDropdown = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const trigger = getSelectTrigger(canvasElement);
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
		await openSelect(trigger, canvasElement);
		const listbox = getSelectListbox(canvasElement);
		await expect(listbox).toBeInTheDocument();
	};

	const playSelectOption = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const trigger = getSelectTrigger(canvasElement);
		await openSelect(trigger, canvasElement);
		const listbox = getSelectListbox(canvasElement);
		const options = within(listbox).getAllByRole('option');
		await waitFor(() => {
			expect(getComputedStyle(options[1]).pointerEvents).not.toBe('none');
		});
		await userEvent.click(options[1]);
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
		await expect(trigger).toHaveTextContent('Banana');
	};

	const playEscapeClosesDropdown = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const trigger = getSelectTrigger(canvasElement);
		await openSelect(trigger, canvasElement);
		await userEvent.keyboard('{Escape}');
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
		await expect(trigger).toHaveTextContent('Select produce');
	};

	const playDisabledIgnoresClick = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const trigger = getSelectTrigger(canvasElement);
		await expect(trigger).toBeDisabled();
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
		trigger.click();
		await waitFor(() => {
			expect(trigger).toHaveAttribute('aria-expanded', 'false');
		});
		await expect(querySelectListbox(canvasElement)).not.toBeInTheDocument();
	};

	const playKeyboardArrowDown = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const trigger = getSelectTrigger(canvasElement);
		await openSelect(trigger, canvasElement);
		const listbox = getSelectListbox(canvasElement);
		await expect(listbox).toBeInTheDocument();
		await userEvent.keyboard('{ArrowDown}');
		await waitFor(() => {
			const options = within(listbox).getAllByRole('option');
			const highlighted = options.find(
				(opt) =>
					opt.getAttribute('data-highlighted') !== null ||
					opt.getAttribute('aria-selected') === 'true' ||
					document.activeElement === opt,
			);
			expect(highlighted).toBeDefined();
		});
	};
</script>

<script lang="ts">
	const fruits = [
		{ value: 'apple', label: 'Apple' },
		{ value: 'banana', label: 'Banana' },
		{ value: 'orange', label: 'Orange' },
		{ value: 'mango', label: 'Mango' },
	];
	const vegetables = [
		{ value: 'carrot', label: 'Carrot' },
		{ value: 'broccoli', label: 'Broccoli' },
		{ value: 'spinach', label: 'Spinach' },
	];
	const fruitsWithDisabled = [
		{ value: 'apple', label: 'Apple', disabled: false },
		{ value: 'banana', label: 'Banana', disabled: false },
		{ value: 'orange', label: 'Orange (unavailable)', disabled: true },
		{ value: 'mango', label: 'Mango', disabled: false },
	];

	let selectedDefault = $state<string | undefined>(undefined);
	const selectedDefaultLabel = $derived(
		fruits.find((i) => i.value === selectedDefault)?.label ?? 'Select a fruit',
	);

	let selectedWithValue = $state('banana');
	const selectedWithValueLabel = $derived(
		fruits.find((i) => i.value === selectedWithValue)?.label ?? 'Select a fruit',
	);

	let selectedError = $state<string | undefined>(undefined);

	let selectedGroups = $state<string | undefined>(undefined);
	const allGroupItems = [...fruits, ...vegetables];
	const selectedGroupsLabel = $derived(
		allGroupItems.find((i) => i.value === selectedGroups)?.label ?? 'Select produce',
	);

	let selectedWithDisabled = $state<string | undefined>(undefined);
	const selectedWithDisabledLabel = $derived(
		fruitsWithDisabled.find((i) => i.value === selectedWithDisabled)?.label ?? 'Select a fruit',
	);

	let selectedSm = $state('apple');
	const selectedSmLabel = $derived(
		fruits.find((i) => i.value === selectedSm)?.label ?? 'Select a fruit',
	);
</script>

<Story name="All Variants">
	{#snippet template()}
		<div class="grid max-w-2xl grid-cols-3 gap-4">
			<div>
				<Label>Default</Label>
				<Select.Root type="single" bind:value={selectedDefault}>
					<Select.Trigger class="w-48">{selectedDefaultLabel}</Select.Trigger>
					<Select.Content portalProps={{ disabled: true }}>
						<Select.Group>
							{#each fruits as item (item.value)}
								<Select.Item value={item.value} label={item.label} />
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
			</div>
			<div>
				<Label>With Value</Label>
				<Select.Root type="single" bind:value={selectedWithValue}>
					<Select.Trigger class="w-48">{selectedWithValueLabel}</Select.Trigger>
					<Select.Content portalProps={{ disabled: true }}>
						<Select.Group>
							{#each fruits as item (item.value)}
								<Select.Item value={item.value} label={item.label} />
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
			</div>
			<div>
				<Label>Focus (interact)</Label>
				<Select.Root type="single">
					<Select.Trigger class="w-48">Select a fruit</Select.Trigger>
					<Select.Content portalProps={{ disabled: true }}>
						<Select.Group>
							{#each fruits as item (item.value)}
								<Select.Item value={item.value} label={item.label} />
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
			</div>
			<div>
				<Label>Disabled</Label>
				<Select.Root type="single" value="apple" disabled>
					<Select.Trigger class="w-48">Apple</Select.Trigger>
					<Select.Content portalProps={{ disabled: true }}>
						<Select.Group>
							<Select.Item value="apple" label="Apple" />
						</Select.Group>
					</Select.Content>
				</Select.Root>
			</div>
			<div>
				<Label>Error</Label>
				<Select.Root type="single" bind:value={selectedError}>
					<Select.Trigger class="w-48" state="error">
						{selectedError ?? 'No item selected'}
					</Select.Trigger>
					<Select.Content portalProps={{ disabled: true }}>
						<Select.Group>
							{#each fruits as item (item.value)}
								<Select.Item value={item.value} label={item.label} />
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
				<HelpText state="error">Please select a fruit.</HelpText>
			</div>
			<div>
				<Label>Small</Label>
				<Select.Root type="single" bind:value={selectedSm}>
					<Select.Trigger class="w-48" size="sm">{selectedSmLabel}</Select.Trigger>
					<Select.Content portalProps={{ disabled: true }}>
						<Select.Group>
							{#each fruits as item (item.value)}
								<Select.Item value={item.value} label={item.label} />
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
			</div>
		</div>
	{/snippet}
</Story>

<Story name="Default [play: open dropdown]" play={playOpenDropdown}>
	{#snippet template()}
		<div class="max-w-xs">
			<Label>Fruit</Label>
			<Select.Root type="single" bind:value={selectedDefault}>
				<Select.Trigger class="w-48">{selectedDefaultLabel}</Select.Trigger>
				<Select.Content portalProps={{ disabled: true }}>
					<Select.Group>
						{#each fruits as item (item.value)}
							<Select.Item value={item.value} label={item.label} />
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</div>
	{/snippet}
</Story>

<Story name="With Value [play: select option]" play={playSelectOption}>
	{#snippet template()}
		<div class="max-w-xs">
			<Label>Fruit</Label>
			<Select.Root type="single" bind:value={selectedDefault}>
				<Select.Trigger class="w-48">{selectedDefaultLabel}</Select.Trigger>
				<Select.Content portalProps={{ disabled: true }}>
					<Select.Group>
						{#each fruits as item (item.value)}
							<Select.Item value={item.value} label={item.label} />
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</div>
	{/snippet}
</Story>

<Story name="Error">
	{#snippet template()}
		<div class="max-w-xs">
			<Label>Fruit</Label>
			<Select.Root type="single" bind:value={selectedError}>
				<Select.Trigger class="w-48" state="error">
					{selectedError ?? 'No item selected'}
				</Select.Trigger>
				<Select.Content portalProps={{ disabled: true }}>
					<Select.Group>
						{#each fruits as item (item.value)}
							<Select.Item value={item.value} label={item.label} />
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
			<HelpText state="error">Please select a fruit.</HelpText>
		</div>
	{/snippet}
</Story>

<Story name="Disabled [play: disabled ignores click]" play={playDisabledIgnoresClick}>
	{#snippet template()}
		<div class="max-w-xs">
			<Label>Fruit</Label>
			<Select.Root type="single" value="apple" disabled>
				<Select.Trigger class="w-48">Apple</Select.Trigger>
				<Select.Content portalProps={{ disabled: true }}>
					<Select.Group>
						<Select.Item value="apple" label="Apple" />
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</div>
	{/snippet}
</Story>

<Story name="Click Outside Closes">
	{#snippet template()}
		<div class="max-w-xs">
			<Label>Fruit</Label>
			<Select.Root type="single" bind:value={selectedDefault}>
				<Select.Trigger class="w-48">{selectedDefaultLabel}</Select.Trigger>
				<Select.Content portalProps={{ disabled: true }}>
					<Select.Group>
						{#each fruits as item (item.value)}
							<Select.Item value={item.value} label={item.label} />
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</div>
	{/snippet}
</Story>

<Story name="Keyboard Navigation [play: arrow down]" play={playKeyboardArrowDown}>
	{#snippet template()}
		<div class="max-w-xs">
			<StoryKeyboardHints>
				<KeyboardHint keys="↓ / ↑" action="Navigate options" />
				<KeyboardHint keys="Enter" action="Select option" />
				<KeyboardHint keys="Esc" action="Close dropdown" />
			</StoryKeyboardHints>
			<Label>Fruit</Label>
			<Select.Root type="single" bind:value={selectedDefault}>
				<Select.Trigger class="w-48">{selectedDefaultLabel}</Select.Trigger>
				<Select.Content portalProps={{ disabled: true }}>
					<Select.Group>
						{#each fruits as item (item.value)}
							<Select.Item value={item.value} label={item.label} />
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</div>
	{/snippet}
</Story>

<Story name="With Groups [play: escape closes]" play={playEscapeClosesDropdown}>
	{#snippet template()}
		<div class="max-w-xs">
			<Label>Produce</Label>
			<Select.Root type="single" bind:value={selectedGroups}>
				<Select.Trigger class="w-48">{selectedGroupsLabel}</Select.Trigger>
				<Select.Content portalProps={{ disabled: true }}>
					<Select.Group>
						<Select.GroupHeading>Fruits</Select.GroupHeading>
						{#each fruits as item (item.value)}
							<Select.Item value={item.value} label={item.label} />
						{/each}
					</Select.Group>
					<Select.Separator />
					<Select.Group>
						<Select.GroupHeading>Vegetables</Select.GroupHeading>
						{#each vegetables as item (item.value)}
							<Select.Item value={item.value} label={item.label} />
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</div>
	{/snippet}
</Story>

<Story name="Disabled Item">
	{#snippet template()}
		<div class="max-w-xs">
			<Label>Fruit</Label>
			<Select.Root type="single" bind:value={selectedWithDisabled}>
				<Select.Trigger class="w-48">{selectedWithDisabledLabel}</Select.Trigger>
				<Select.Content portalProps={{ disabled: true }}>
					<Select.Group>
						{#each fruitsWithDisabled as item (item.value)}
							<Select.Item
								value={item.value}
								label={item.label}
								disabled={item.disabled}
							/>
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</div>
	{/snippet}
</Story>

<Story name="Small Size">
	{#snippet template()}
		<div class="max-w-xs">
			<Label>Fruit</Label>
			<Select.Root type="single" bind:value={selectedSm}>
				<Select.Trigger class="w-48" size="sm">{selectedSmLabel}</Select.Trigger>
				<Select.Content portalProps={{ disabled: true }}>
					<Select.Group>
						{#each fruits as item (item.value)}
							<Select.Item value={item.value} label={item.label} />
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</div>
	{/snippet}
</Story>

<Story name="With Label and HelpText">
	{#snippet template()}
		<div class="flex max-w-xs flex-col gap-1.5">
			<Label>Favorite fruit</Label>
			<Select.Root type="single" bind:value={selectedDefault}>
				<Select.Trigger class="w-full">{selectedDefaultLabel}</Select.Trigger>
				<Select.Content portalProps={{ disabled: true }}>
					<Select.Group>
						{#each fruits as item (item.value)}
							<Select.Item value={item.value} label={item.label} />
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
			<HelpText>Used for personalized recommendations.</HelpText>
		</div>
	{/snippet}
</Story>
