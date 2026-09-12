<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, waitFor, within } from 'storybook/test';
	import { Toggle, TOGGLE_INTENTS, TOGGLE_SIZES } from './index.js';

	const { Story } = defineMeta({
		title: 'Base/Toggle',
		component: Toggle,
		tags: ['autodocs'],
		argTypes: {
			intent: { control: 'select', options: TOGGLE_INTENTS },
			size: { control: 'select', options: TOGGLE_SIZES },
			disabled: { control: 'boolean' },
		},
	});

	const playClickTogglesOn = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const toggle = canvas.getByRole('button', { name: /toggle bold/i });
		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
		await userEvent.click(toggle);
		await waitFor(() => {
			expect(toggle).toHaveAttribute('aria-pressed', 'true');
		});
	};

	const playClickTogglesOff = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const toggle = canvas.getByRole('button', { name: /toggle bold/i });
		await expect(toggle).toHaveAttribute('aria-pressed', 'true');
		await userEvent.click(toggle);
		await waitFor(() => {
			expect(toggle).toHaveAttribute('aria-pressed', 'false');
		});
	};

	const playDisabledIgnoresClick = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const toggle = canvas.getByRole('button', { name: /toggle bold/i });
		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
		await expect(toggle).toBeDisabled();
		await userEvent.click(toggle);
		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	};

	const playSpaceKeyToggles = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const toggle = canvas.getByRole('button', { name: /toggle bold/i });
		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
		toggle.focus();
		await userEvent.keyboard(' ');
		await waitFor(() => {
			expect(toggle).toHaveAttribute('aria-pressed', 'true');
		});
		await userEvent.keyboard(' ');
		await waitFor(() => {
			expect(toggle).toHaveAttribute('aria-pressed', 'false');
		});
	};
</script>

<script lang="ts">
	import type { ToggleProps } from './toggle_variants.js';
	import BoldIcon from '@lucide/svelte/icons/bold';
	import ItalicIcon from '@lucide/svelte/icons/italic';
</script>

<Story name="All Variants">
	{#snippet template(args: ToggleProps)}
		<div class="flex flex-col gap-6">
			{#each TOGGLE_INTENTS as intent (intent)}
				<div class="flex flex-col gap-2">
					<span class="text-xs font-medium text-muted-foreground">{intent}</span>
					<div class="flex items-center gap-3">
						{#each TOGGLE_SIZES as size (size)}
							<div class="flex flex-col items-center gap-1">
								<span class="text-[10px] text-muted-foreground">{size}</span>
								<Toggle {...args} {intent} {size} aria-label="Bold">
									{#if size === 'icon' || size === 'icon-sm'}
										<BoldIcon data-icon="inline-start" />
									{:else}
										<BoldIcon data-icon="inline-start" />
										Bold
									{/if}
								</Toggle>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Off [play: click toggles on]" play={playClickTogglesOn}>
	{#snippet template(args: ToggleProps)}
		<Toggle {...args} aria-label="Toggle bold">
			<BoldIcon data-icon="inline-start" />
			Bold
		</Toggle>
	{/snippet}
</Story>

<Story name="On [play: click toggles off]" play={playClickTogglesOff}>
	{#snippet template(args: ToggleProps)}
		<Toggle {...args} pressed aria-label="Toggle bold">
			<BoldIcon data-icon="inline-start" />
			Bold
		</Toggle>
	{/snippet}
</Story>

<Story name="Disabled [play: disabled ignores click]" play={playDisabledIgnoresClick}>
	{#snippet template(args: ToggleProps)}
		<Toggle {...args} disabled aria-label="Toggle bold">
			<BoldIcon data-icon="inline-start" />
			Bold
		</Toggle>
	{/snippet}
</Story>

<Story name="Space Key Toggles [play: space key toggles]" play={playSpaceKeyToggles}>
	{#snippet template(args: ToggleProps)}
		<Toggle {...args} aria-label="Toggle bold">
			<BoldIcon data-icon="inline-start" />
			Bold
		</Toggle>
	{/snippet}
</Story>

<Story name="On Backgrounds">
	{#snippet template(args: ToggleProps)}
		<div class="flex gap-8">
			<div class="rounded-lg bg-background p-4">
				<p class="mb-2 text-xs text-muted-foreground">bg-background</p>
				<div class="flex items-center gap-3">
					<Toggle {...args} aria-label="Bold off">
						<BoldIcon data-icon="inline-start" />
						Off
					</Toggle>
					<Toggle {...args} pressed aria-label="Bold on">
						<BoldIcon data-icon="inline-start" />
						On
					</Toggle>
				</div>
			</div>
			<div class="rounded-lg bg-sidebar p-4">
				<p class="mb-2 text-xs text-muted-foreground">bg-sidebar</p>
				<div class="flex items-center gap-3">
					<Toggle {...args} aria-label="Bold off">
						<BoldIcon data-icon="inline-start" />
						Off
					</Toggle>
					<Toggle {...args} pressed aria-label="Bold on">
						<BoldIcon data-icon="inline-start" />
						On
					</Toggle>
				</div>
			</div>
			<div class="rounded-lg bg-surface-2 p-4">
				<p class="mb-2 text-xs text-muted-foreground">bg-surface-2</p>
				<div class="flex items-center gap-3">
					<Toggle {...args} aria-label="Bold off">
						<BoldIcon data-icon="inline-start" />
						Off
					</Toggle>
					<Toggle {...args} pressed aria-label="Bold on">
						<BoldIcon data-icon="inline-start" />
						On
					</Toggle>
				</div>
			</div>
		</div>
	{/snippet}
</Story>

<Story name="Icon Only">
	{#snippet template(args: ToggleProps)}
		<Toggle {...args} size="icon" aria-label="Toggle italic">
			<ItalicIcon data-icon="inline-start" />
		</Toggle>
	{/snippet}
</Story>
