<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, within } from 'storybook/test';
	import { RadioGroup, RadioGroupItem } from './index.js';
	import { Label } from '$lib/components/base/label/index.js';

	const { Story } = defineMeta({
		title: 'Base/RadioGroup',
		component: RadioGroup,
		tags: ['autodocs'],
	});

	const playClickMovesSelection = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const radios = canvas.getAllByRole('radio');

		// Click second option
		await userEvent.click(radios[1]);
		await expect(radios[1]).toHaveAttribute('aria-checked', 'true');
		await expect(radios[0]).toHaveAttribute('aria-checked', 'false');

		// Click third option → selection moves, previous deselected
		await userEvent.click(radios[2]);
		await expect(radios[2]).toHaveAttribute('aria-checked', 'true');
		await expect(radios[1]).toHaveAttribute('aria-checked', 'false');
		await expect(radios[0]).toHaveAttribute('aria-checked', 'false');
	};

	const playArrowDownNavigation = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const radios = canvas.getAllByRole('radio');

		// Focus first radio
		radios[0].focus();
		await expect(radios[0]).toHaveFocus();

		// ArrowDown → next option focused and selected
		await userEvent.keyboard('{ArrowDown}');
		await expect(radios[1]).toHaveFocus();
		await expect(radios[1]).toHaveAttribute('aria-checked', 'true');
		await expect(radios[0]).toHaveAttribute('aria-checked', 'false');

		// ArrowDown again → third option
		await userEvent.keyboard('{ArrowDown}');
		await expect(radios[2]).toHaveFocus();
		await expect(radios[2]).toHaveAttribute('aria-checked', 'true');
		await expect(radios[1]).toHaveAttribute('aria-checked', 'false');
	};

	const playArrowUpNavigation = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const radios = canvas.getAllByRole('radio');

		// Click last radio to select and focus it
		await userEvent.click(radios[2]);
		await expect(radios[2]).toHaveAttribute('aria-checked', 'true');

		// ArrowUp → previous option focused and selected
		await userEvent.keyboard('{ArrowUp}');
		await expect(radios[1]).toHaveFocus();
		await expect(radios[1]).toHaveAttribute('aria-checked', 'true');
		await expect(radios[2]).toHaveAttribute('aria-checked', 'false');

		// ArrowUp again → first option
		await userEvent.keyboard('{ArrowUp}');
		await expect(radios[0]).toHaveFocus();
		await expect(radios[0]).toHaveAttribute('aria-checked', 'true');
		await expect(radios[1]).toHaveAttribute('aria-checked', 'false');
	};

	const playDisabledIgnoresInteraction = async ({
		canvasElement,
	}: {
		canvasElement: HTMLElement;
	}) => {
		const canvas = within(canvasElement);
		const radios = canvas.getAllByRole('radio');

		// All radios should be disabled
		await expect(radios[0]).toBeDisabled();
		await expect(radios[1]).toBeDisabled();

		// Initially "claude" is selected
		await expect(radios[0]).toHaveAttribute('aria-checked', 'true');
		await expect(radios[1]).toHaveAttribute('aria-checked', 'false');

		// Click disabled radio → no change
		await userEvent.click(radios[1]);
		await expect(radios[0]).toHaveAttribute('aria-checked', 'true');
		await expect(radios[1]).toHaveAttribute('aria-checked', 'false');
	};
</script>

<script lang="ts">
	import type { RadioGroupProps } from './radio_group_types.js';
	import StoryKeyboardHints from '$lib/storybook/StoryKeyboardHints.svelte';
	import KeyboardHint from '$lib/storybook/KeyboardHint.svelte';
</script>

<Story name="All States">
	{#snippet template(args: RadioGroupProps)}
		<div class="grid grid-cols-4 gap-6">
			<div class="flex flex-col items-center gap-2">
				<span class="text-xs text-muted-foreground">Rest</span>
				<RadioGroup {...args}>
					<RadioGroupItem value="x" />
				</RadioGroup>
			</div>
			<div class="flex flex-col items-center gap-2">
				<span class="text-xs text-muted-foreground">Selected</span>
				<RadioGroup value="x">
					<RadioGroupItem value="x" />
				</RadioGroup>
			</div>
			<div class="flex flex-col items-center gap-2">
				<span class="text-xs text-muted-foreground">Disabled</span>
				<RadioGroup disabled>
					<RadioGroupItem value="x" />
				</RadioGroup>
			</div>
			<div class="flex flex-col items-center gap-2">
				<span class="text-xs text-muted-foreground">Disabled + Selected</span>
				<RadioGroup value="x" disabled>
					<RadioGroupItem value="x" />
				</RadioGroup>
			</div>
			<div class="col-span-4 flex flex-col gap-2">
				<span class="text-xs text-muted-foreground">Group</span>
				<RadioGroup value="claude" class="flex flex-row gap-4">
					<div class="flex items-center gap-1.5">
						<RadioGroupItem value="claude" id="rs-claude" />
						<Label for="rs-claude" class="mb-0 cursor-pointer text-(length:--text-md)"
							>Claude</Label
						>
					</div>
					<div class="flex items-center gap-1.5">
						<RadioGroupItem value="codex" id="rs-codex" />
						<Label for="rs-codex" class="mb-0 cursor-pointer text-(length:--text-md)"
							>Codex</Label
						>
					</div>
					<div class="flex items-center gap-1.5">
						<RadioGroupItem value="cursor" id="rs-cursor" />
						<Label for="rs-cursor" class="mb-0 cursor-pointer text-(length:--text-md)"
							>Cursor</Label
						>
					</div>
				</RadioGroup>
			</div>
		</div>
	{/snippet}
</Story>

<Story name="Default">
	{#snippet template(args: RadioGroupProps)}
		<RadioGroup {...args} value="claude">
			<div class="flex items-center gap-2">
				<RadioGroupItem value="claude" id="r-claude" />
				<Label for="r-claude" class="mb-0 cursor-pointer text-(length:--text-md)"
					>Claude</Label
				>
			</div>
			<div class="flex items-center gap-2">
				<RadioGroupItem value="codex" id="r-codex" />
				<Label for="r-codex" class="mb-0 cursor-pointer text-(length:--text-md)"
					>Codex</Label
				>
			</div>
			<div class="flex items-center gap-2">
				<RadioGroupItem value="cursor" id="r-cursor" />
				<Label for="r-cursor" class="mb-0 cursor-pointer text-(length:--text-md)"
					>Cursor</Label
				>
			</div>
		</RadioGroup>
	{/snippet}
</Story>

<Story name="Click Moves Selection [play: click moves selection]" play={playClickMovesSelection}>
	{#snippet template(args: RadioGroupProps)}
		<RadioGroup {...args} value="claude">
			<div class="flex items-center gap-2">
				<RadioGroupItem value="claude" id="rcm-claude" />
				<Label for="rcm-claude" class="mb-0 cursor-pointer text-(length:--text-md)"
					>Claude</Label
				>
			</div>
			<div class="flex items-center gap-2">
				<RadioGroupItem value="codex" id="rcm-codex" />
				<Label for="rcm-codex" class="mb-0 cursor-pointer text-(length:--text-md)"
					>Codex</Label
				>
			</div>
			<div class="flex items-center gap-2">
				<RadioGroupItem value="cursor" id="rcm-cursor" />
				<Label for="rcm-cursor" class="mb-0 cursor-pointer text-(length:--text-md)"
					>Cursor</Label
				>
			</div>
		</RadioGroup>
	{/snippet}
</Story>

<Story name="Arrow Down Navigation [play: arrow down navigation]" play={playArrowDownNavigation}>
	{#snippet template(args: RadioGroupProps)}
		<div>
			<StoryKeyboardHints>
				<KeyboardHint keys="↓ / ↑" action="Move focus and select option" />
			</StoryKeyboardHints>
			<RadioGroup {...args} value="claude">
				<div class="flex items-center gap-2">
					<RadioGroupItem value="claude" id="rad-claude" />
					<Label for="rad-claude" class="mb-0 cursor-pointer text-(length:--text-md)"
						>Claude</Label
					>
				</div>
				<div class="flex items-center gap-2">
					<RadioGroupItem value="codex" id="rad-codex" />
					<Label for="rad-codex" class="mb-0 cursor-pointer text-(length:--text-md)"
						>Codex</Label
					>
				</div>
				<div class="flex items-center gap-2">
					<RadioGroupItem value="cursor" id="rad-cursor" />
					<Label for="rad-cursor" class="mb-0 cursor-pointer text-(length:--text-md)"
						>Cursor</Label
					>
				</div>
			</RadioGroup>
		</div>
	{/snippet}
</Story>

<Story name="Arrow Up Navigation [play: arrow up navigation]" play={playArrowUpNavigation}>
	{#snippet template(args: RadioGroupProps)}
		<div>
			<StoryKeyboardHints>
				<KeyboardHint keys="↓ / ↑" action="Move focus and select option" />
			</StoryKeyboardHints>
			<RadioGroup {...args} value="claude">
				<div class="flex items-center gap-2">
					<RadioGroupItem value="claude" id="rau-claude" />
					<Label for="rau-claude" class="mb-0 cursor-pointer text-(length:--text-md)"
						>Claude</Label
					>
				</div>
				<div class="flex items-center gap-2">
					<RadioGroupItem value="codex" id="rau-codex" />
					<Label for="rau-codex" class="mb-0 cursor-pointer text-(length:--text-md)"
						>Codex</Label
					>
				</div>
				<div class="flex items-center gap-2">
					<RadioGroupItem value="cursor" id="rau-cursor" />
					<Label for="rau-cursor" class="mb-0 cursor-pointer text-(length:--text-md)"
						>Cursor</Label
					>
				</div>
			</RadioGroup>
		</div>
	{/snippet}
</Story>

<Story name="Horizontal">
	{#snippet template(args: RadioGroupProps)}
		<RadioGroup {...args} value="claude" class="flex flex-row gap-4">
			<div class="flex items-center gap-1.5">
				<RadioGroupItem value="claude" id="rh-claude" />
				<Label for="rh-claude" class="mb-0 cursor-pointer text-(length:--text-md)"
					>Claude</Label
				>
			</div>
			<div class="flex items-center gap-1.5">
				<RadioGroupItem value="codex" id="rh-codex" />
				<Label for="rh-codex" class="mb-0 cursor-pointer text-(length:--text-md)"
					>Codex</Label
				>
			</div>
			<div class="flex items-center gap-1.5">
				<RadioGroupItem value="cursor" id="rh-cursor" />
				<Label for="rh-cursor" class="mb-0 cursor-pointer text-(length:--text-md)"
					>Cursor</Label
				>
			</div>
		</RadioGroup>
	{/snippet}
</Story>

<Story name="Disabled [play: disabled ignores interaction]" play={playDisabledIgnoresInteraction}>
	{#snippet template(args: RadioGroupProps)}
		<RadioGroup {...args} value="claude" disabled>
			<div class="flex items-center gap-2">
				<RadioGroupItem value="claude" id="rd-claude" />
				<Label for="rd-claude" class="mb-0 text-(length:--text-md) opacity-40">Claude</Label
				>
			</div>
			<div class="flex items-center gap-2">
				<RadioGroupItem value="codex" id="rd-codex" />
				<Label for="rd-codex" class="mb-0 text-(length:--text-md) opacity-40">Codex</Label>
			</div>
		</RadioGroup>
	{/snippet}
</Story>
