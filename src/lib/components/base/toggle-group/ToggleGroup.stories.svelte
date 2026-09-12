<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, waitFor, within } from 'storybook/test';
	import * as ToggleGroup from './index.js';
	import { TOGGLE_INTENTS, TOGGLE_SIZES } from '../toggle/index.js';

	const { Story } = defineMeta({
		title: 'Base/ToggleGroup',
		component: ToggleGroup.Root,
		tags: ['autodocs'],
		argTypes: {
			intent: { control: 'select', options: TOGGLE_INTENTS },
			size: { control: 'select', options: TOGGLE_SIZES },
		},
	});

	const playSingleSelect = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const items = canvas.getAllByRole('radio');

		await expect(items[0]).toHaveAttribute('aria-checked', 'true');
		await expect(items[1]).toHaveAttribute('aria-checked', 'false');
		await expect(items[2]).toHaveAttribute('aria-checked', 'false');

		await userEvent.click(items[1]);
		await waitFor(() => {
			expect(items[0]).toHaveAttribute('aria-checked', 'false');
			expect(items[1]).toHaveAttribute('aria-checked', 'true');
		});
	};

	const playMultipleSelect = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const group = canvas.getByRole('group');
		const groupCanvas = within(group);
		const items = groupCanvas.getAllByRole('button');

		await userEvent.click(items[0]);
		await waitFor(() => {
			expect(items[0]).toHaveAttribute('aria-pressed', 'true');
		});

		await userEvent.click(items[1]);
		await waitFor(() => {
			expect(items[0]).toHaveAttribute('aria-pressed', 'true');
			expect(items[1]).toHaveAttribute('aria-pressed', 'true');
		});

		await userEvent.click(items[0]);
		await waitFor(() => {
			expect(items[0]).toHaveAttribute('aria-pressed', 'false');
			expect(items[1]).toHaveAttribute('aria-pressed', 'true');
		});
	};

	const playDisabledItemIgnored = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const items = canvas.getAllByRole('radio');

		const disabledItem = items[2];
		await expect(disabledItem).toBeDisabled();
		await userEvent.click(disabledItem);
		await expect(disabledItem).toHaveAttribute('aria-checked', 'false');
	};

	const playKeyboardNavigation = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const items = canvas.getAllByRole('radio');

		items[0].focus();
		await expect(items[0]).toHaveFocus();

		await userEvent.keyboard('{ArrowRight}');
		await waitFor(() => {
			expect(items[1]).toHaveFocus();
		});

		await userEvent.keyboard('{ArrowRight}');
		await waitFor(() => {
			expect(items[2]).toHaveFocus();
		});

		// Loop back to first
		await userEvent.keyboard('{ArrowRight}');
		await waitFor(() => {
			expect(items[0]).toHaveFocus();
		});
	};
</script>

<script lang="ts">
	import BoldIcon from '@lucide/svelte/icons/bold';
	import ItalicIcon from '@lucide/svelte/icons/italic';
	import UnderlineIcon from '@lucide/svelte/icons/underline';
	import AlignLeftIcon from '@lucide/svelte/icons/align-left';
	import AlignCenterIcon from '@lucide/svelte/icons/align-center';
	import AlignRightIcon from '@lucide/svelte/icons/align-right';
</script>

<Story name="All Variants">
	{#snippet template(args: Record<string, unknown>)}
		<div class="flex flex-col gap-6">
			{#each TOGGLE_INTENTS as intent (intent)}
				<div class="flex flex-col gap-2">
					<span class="text-xs font-medium text-muted-foreground">{intent}</span>
					<div class="flex flex-col gap-3">
						{#each TOGGLE_SIZES as size (size)}
							<div class="flex items-center gap-2">
								<span class="w-12 text-[10px] text-muted-foreground">{size}</span>
								<ToggleGroup.Root
									{...args}
									type="single"
									value="center"
									{intent}
									{size}
								>
									<ToggleGroup.Item value="left" aria-label="Align left">
										<AlignLeftIcon data-icon="inline-start" />
										{#if size !== 'icon' && size !== 'icon-sm'}
											Left
										{/if}
									</ToggleGroup.Item>
									<ToggleGroup.Item value="center" aria-label="Align center">
										<AlignCenterIcon data-icon="inline-start" />
										{#if size !== 'icon' && size !== 'icon-sm'}
											Center
										{/if}
									</ToggleGroup.Item>
									<ToggleGroup.Item value="right" aria-label="Align right">
										<AlignRightIcon data-icon="inline-start" />
										{#if size !== 'icon' && size !== 'icon-sm'}
											Right
										{/if}
									</ToggleGroup.Item>
								</ToggleGroup.Root>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Single Select [play: single select]" play={playSingleSelect}>
	{#snippet template(args: Record<string, unknown>)}
		<ToggleGroup.Root type="single" value="left" {...args}>
			<ToggleGroup.Item value="left" aria-label="Align left">
				<AlignLeftIcon data-icon="inline-start" />
				Left
			</ToggleGroup.Item>
			<ToggleGroup.Item value="center" aria-label="Align center">
				<AlignCenterIcon data-icon="inline-start" />
				Center
			</ToggleGroup.Item>
			<ToggleGroup.Item value="right" aria-label="Align right">
				<AlignRightIcon data-icon="inline-start" />
				Right
			</ToggleGroup.Item>
		</ToggleGroup.Root>
	{/snippet}
</Story>

<Story name="Multiple Select [play: multiple select]" play={playMultipleSelect}>
	{#snippet template(args: Record<string, unknown>)}
		<ToggleGroup.Root type="multiple" {...args}>
			<ToggleGroup.Item value="bold" aria-label="Bold">
				<BoldIcon data-icon="inline-start" />
				Bold
			</ToggleGroup.Item>
			<ToggleGroup.Item value="italic" aria-label="Italic">
				<ItalicIcon data-icon="inline-start" />
				Italic
			</ToggleGroup.Item>
			<ToggleGroup.Item value="underline" aria-label="Underline">
				<UnderlineIcon data-icon="inline-start" />
				Underline
			</ToggleGroup.Item>
		</ToggleGroup.Root>
	{/snippet}
</Story>

<Story name="Outline Intent">
	{#snippet template(args: Record<string, unknown>)}
		<ToggleGroup.Root type="single" value="center" intent="outline" {...args}>
			<ToggleGroup.Item value="left" aria-label="Align left">
				<AlignLeftIcon data-icon="inline-start" />
				Left
			</ToggleGroup.Item>
			<ToggleGroup.Item value="center" aria-label="Align center">
				<AlignCenterIcon data-icon="inline-start" />
				Center
			</ToggleGroup.Item>
			<ToggleGroup.Item value="right" aria-label="Align right">
				<AlignRightIcon data-icon="inline-start" />
				Right
			</ToggleGroup.Item>
		</ToggleGroup.Root>
	{/snippet}
</Story>

<Story name="Disabled Item [play: disabled item ignored]" play={playDisabledItemIgnored}>
	{#snippet template(args: Record<string, unknown>)}
		<ToggleGroup.Root type="single" value="left" {...args}>
			<ToggleGroup.Item value="left" aria-label="Align left">
				<AlignLeftIcon data-icon="inline-start" />
				Left
			</ToggleGroup.Item>
			<ToggleGroup.Item value="center" aria-label="Align center">
				<AlignCenterIcon data-icon="inline-start" />
				Center
			</ToggleGroup.Item>
			<ToggleGroup.Item value="right" aria-label="Align right" disabled>
				<AlignRightIcon data-icon="inline-start" />
				Right
			</ToggleGroup.Item>
		</ToggleGroup.Root>
	{/snippet}
</Story>

<Story name="Keyboard Navigation [play: keyboard navigation]" play={playKeyboardNavigation}>
	{#snippet template(args: Record<string, unknown>)}
		<ToggleGroup.Root type="single" value="left" {...args}>
			<ToggleGroup.Item value="left" aria-label="Align left">
				<AlignLeftIcon data-icon="inline-start" />
				Left
			</ToggleGroup.Item>
			<ToggleGroup.Item value="center" aria-label="Align center">
				<AlignCenterIcon data-icon="inline-start" />
				Center
			</ToggleGroup.Item>
			<ToggleGroup.Item value="right" aria-label="Align right">
				<AlignRightIcon data-icon="inline-start" />
				Right
			</ToggleGroup.Item>
		</ToggleGroup.Root>
	{/snippet}
</Story>

<Story name="Icon Only">
	{#snippet template(args: Record<string, unknown>)}
		<ToggleGroup.Root type="single" value="left" size="icon" {...args}>
			<ToggleGroup.Item value="left" aria-label="Align left">
				<AlignLeftIcon data-icon="inline-start" />
			</ToggleGroup.Item>
			<ToggleGroup.Item value="center" aria-label="Align center">
				<AlignCenterIcon data-icon="inline-start" />
			</ToggleGroup.Item>
			<ToggleGroup.Item value="right" aria-label="Align right">
				<AlignRightIcon data-icon="inline-start" />
			</ToggleGroup.Item>
		</ToggleGroup.Root>
	{/snippet}
</Story>
