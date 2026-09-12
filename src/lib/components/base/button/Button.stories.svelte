<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, userEvent, within } from 'storybook/test';
	import { BUTTON_INTENTS, BUTTON_SIZES, Button } from './index.js';

	const { Story } = defineMeta({
		title: 'Base/Button',
		component: Button,
		tags: ['autodocs'],
		args: {
			onclick: fn(),
		},
		argTypes: {
			onclick: { action: 'clicked' },
			intent: {
				control: 'select',
				options: [...BUTTON_INTENTS],
			},
			size: {
				control: 'select',
				options: [...BUTTON_SIZES],
			},
			disabled: { control: 'boolean' },
		},
	});

	const playClickCallsHandler = async ({
		canvasElement,
		args,
	}: {
		canvasElement: HTMLElement;
		args: { onclick?: unknown };
	}) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole('button', { name: 'Primary' });
		await userEvent.click(button);
		await expect(args.onclick).toHaveBeenCalledOnce();
	};

	const playDisabledIgnoresClick = async ({
		canvasElement,
		args,
	}: {
		canvasElement: HTMLElement;
		args: { onclick?: unknown };
	}) => {
		// Only check buttons with data-slot="button", not ThemeDecorator buttons
		const buttons = canvasElement.querySelectorAll<HTMLButtonElement>('[data-slot="button"]');
		await expect(buttons.length).toBeGreaterThan(0);
		for (const button of buttons) {
			await expect(button).toBeDisabled();
			await userEvent.click(button, { pointerEventsCheck: 0 });
		}
		await expect(args.onclick).not.toHaveBeenCalled();
	};
</script>

<script lang="ts">
	import { BUTTON_TEXT_SIZES, BUTTON_ICON_SIZES, type ButtonProps } from './button_variants.js';
	import { Kbd, KbdGroup } from '$lib/components/base/kbd/index.js';
	import MailIcon from '@lucide/svelte/icons/mail';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CornerDownLeftIcon from '@lucide/svelte/icons/corner-down-left';
	import DeleteIcon from '@lucide/svelte/icons/delete';
	import CommandIcon from '@lucide/svelte/icons/command';
</script>

<Story name="All Variants">
	{#snippet template(args: ButtonProps)}
		<div class="flex flex-col gap-10 w-130">
			<div class="flex flex-col gap-3">
				<p class="text-sm font-medium text-muted-foreground">Text buttons</p>
				<div class="grid grid-cols-[9rem_repeat(3,minmax(0,1fr))] items-center gap-3">
					<div></div>
					{#each BUTTON_TEXT_SIZES as size (size)}
						<div class="text-center text-xs text-muted-foreground">{size}</div>
					{/each}
					{#each BUTTON_INTENTS as intent (intent)}
						<div class="text-xs text-muted-foreground">{intent}</div>
						{#each BUTTON_TEXT_SIZES as size (size)}
							<div class="flex justify-center">
								<Button {...args} {intent} {size}>Label</Button>
							</div>
						{/each}
					{/each}
				</div>
			</div>

			<div class="flex flex-col gap-3">
				<p class="text-sm font-medium text-muted-foreground">Icon-only buttons</p>
				<div class="grid grid-cols-[9rem_repeat(2,minmax(0,1fr))] items-center gap-3">
					<div></div>
					{#each BUTTON_ICON_SIZES as size (size)}
						<div class="text-center text-xs text-muted-foreground">{size}</div>
					{/each}
					{#each BUTTON_INTENTS as intent (intent)}
						<div class="text-xs text-muted-foreground">{intent}</div>
						{#each BUTTON_ICON_SIZES as size (size)}
							<div class="flex justify-center">
								<Button {...args} {intent} {size}
									><PlusIcon data-icon="inline-start" /></Button
								>
							</div>
						{/each}
					{/each}
				</div>
			</div>

			<div class="flex flex-col gap-3">
				<p class="text-sm font-medium text-muted-foreground">Icon + text</p>
				<div class="grid grid-cols-[9rem_repeat(3,minmax(0,1fr))] items-center gap-3">
					<div></div>
					{#each BUTTON_TEXT_SIZES as size (size)}
						<div class="text-center text-xs text-muted-foreground">{size}</div>
					{/each}
					{#each BUTTON_INTENTS as intent (intent)}
						<div class="text-xs text-muted-foreground">{intent}</div>
						{#each BUTTON_TEXT_SIZES as size (size)}
							<div class="flex justify-center">
								<Button {...args} {intent} {size}>
									<PlusIcon data-icon="inline-start" /> Label
								</Button>
							</div>
						{/each}
					{/each}
				</div>
			</div>

			<div class="flex flex-col gap-3">
				<p class="text-sm font-medium text-muted-foreground">With keyboard shortcuts</p>
				<div class="grid grid-cols-[9rem_repeat(3,minmax(0,1fr))] items-center gap-3">
					<div></div>
					{#each BUTTON_TEXT_SIZES as size (size)}
						<div class="text-center text-xs text-muted-foreground">{size}</div>
					{/each}
					{#each BUTTON_INTENTS as intent (intent)}
						<div class="text-xs text-muted-foreground">{intent}</div>
						{#each BUTTON_TEXT_SIZES as size (size)}
							<div class="flex justify-center">
								<Button {...args} {intent} {size}>
									Action
									<Kbd format="lucide"><CornerDownLeftIcon /></Kbd>
								</Button>
							</div>
						{/each}
					{/each}
				</div>
			</div>
		</div>
	{/snippet}
</Story>

<Story
	name="Primary [play: click calls handler]"
	args={{ intent: 'primary' }}
	play={playClickCallsHandler}
>
	{#snippet template(args: ButtonProps)}
		<Button {...args}>Primary</Button>
	{/snippet}
</Story>

<Story name="Secondary">
	{#snippet template(args: ButtonProps)}
		<Button intent="secondary" {...args}>Secondary</Button>
	{/snippet}
</Story>

<Story name="Ghost">
	{#snippet template(args: ButtonProps)}
		<Button intent="ghost" {...args}>Ghost</Button>
	{/snippet}
</Story>

<Story name="Ghost on Backgrounds">
	{#snippet template(args: ButtonProps)}
		<div class="flex flex-wrap gap-4">
			<div class="rounded-lg bg-background p-4">
				<p class="mb-2 text-xs opacity-70">bg-background</p>
				<div class="flex items-center gap-2">
					<Button intent="ghost" size="icon-sm" aria-label="Mail" {...args}
						><MailIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost" size="icon-sm" aria-label="Settings" {...args}
						><SettingsIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost" {...args}>Action</Button>
				</div>
			</div>
			<div class="rounded-lg bg-sidebar p-4">
				<p class="mb-2 text-xs opacity-70">bg-sidebar</p>
				<div class="flex items-center gap-2">
					<Button intent="ghost" size="icon-sm" aria-label="Mail" {...args}
						><MailIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost" size="icon-sm" aria-label="Settings" {...args}
						><SettingsIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost" {...args}>Action</Button>
				</div>
			</div>
			<div class="rounded-lg bg-surface p-4">
				<p class="mb-2 text-xs opacity-70">bg-surface</p>
				<div class="flex items-center gap-2">
					<Button intent="ghost" size="icon-sm" aria-label="Mail" {...args}
						><MailIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost" size="icon-sm" aria-label="Settings" {...args}
						><SettingsIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost" {...args}>Action</Button>
				</div>
			</div>
			<div class="rounded-lg bg-secondary p-4">
				<p class="mb-2 text-xs opacity-70">bg-secondary</p>
				<div class="flex items-center gap-2">
					<Button intent="ghost" size="icon-sm" aria-label="Mail" {...args}
						><MailIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost" size="icon-sm" aria-label="Settings" {...args}
						><SettingsIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost" {...args}>Action</Button>
				</div>
			</div>
			<div class="rounded-lg p-4" style="background: oklch(75% 0.12 300deg)">
				<p class="mb-2 text-xs opacity-70">oklch(75% 0.12 300deg) – vivid lavender</p>
				<div class="flex items-center gap-2">
					<Button intent="ghost" size="icon-sm" aria-label="Mail" {...args}
						><MailIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost" size="icon-sm" aria-label="Settings" {...args}
						><SettingsIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost" {...args}>Action</Button>
				</div>
			</div>
			<div class="rounded-lg p-4 text-white" style="background: oklch(50% 0.05 200deg)">
				<p class="mb-2 text-xs opacity-70">oklch(50% 0.05 200deg) – mid-tone gray-blue</p>
				<div class="flex items-center gap-2">
					<Button intent="ghost" size="icon-sm" aria-label="Mail" {...args}
						><MailIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost" size="icon-sm" aria-label="Settings" {...args}
						><SettingsIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost" {...args}>Action</Button>
				</div>
			</div>
		</div>
	{/snippet}
</Story>

<Story name="Ghost Overlay">
	{#snippet template(args: ButtonProps)}
		<div class="flex flex-wrap gap-4">
			<div class="rounded-lg bg-primary p-4 text-primary-foreground">
				<p class="mb-2 text-xs opacity-70">bg-primary</p>
				<div class="flex items-center gap-2">
					<Button intent="ghost-overlay" size="icon-sm" aria-label="Demo" {...args}
						><MailIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost-overlay" size="icon-sm" aria-label="Demo" {...args}
						><SettingsIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost-overlay" {...args}>Action</Button>
				</div>
			</div>
			<div class="rounded-lg bg-accent p-4 text-accent-foreground">
				<p class="mb-2 text-xs opacity-70">bg-accent</p>
				<div class="flex items-center gap-2">
					<Button intent="ghost-overlay" size="icon-sm" {...args}
						><MailIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost-overlay" size="icon-sm" {...args}
						><SettingsIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost-overlay" {...args}>Action</Button>
				</div>
			</div>
			<div class="rounded-lg bg-secondary p-4 text-foreground">
				<p class="mb-2 text-xs opacity-70">bg-secondary</p>
				<div class="flex items-center gap-2">
					<Button intent="ghost-overlay" size="icon-sm" {...args}
						><MailIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost-overlay" size="icon-sm" {...args}
						><SettingsIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost-overlay" {...args}>Action</Button>
				</div>
			</div>
			<div class="rounded-lg bg-foreground p-4 text-background">
				<p class="mb-2 text-xs opacity-70">bg-foreground (inverted)</p>
				<div class="flex items-center gap-2">
					<Button intent="ghost-overlay" size="icon-sm" aria-label="Demo" {...args}
						><MailIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost-overlay" size="icon-sm" aria-label="Demo" {...args}
						><SettingsIcon data-icon="inline-start" /></Button
					>
					<Button intent="ghost-overlay" {...args}>Action</Button>
				</div>
			</div>
		</div>
	{/snippet}
</Story>

<Story name="Danger">
	{#snippet template(args: ButtonProps)}
		<Button intent="danger" {...args}>Danger</Button>
	{/snippet}
</Story>

<Story name="Primary Destructive">
	{#snippet template(args: ButtonProps)}
		<Button intent="primary-destructive" {...args}>Delete</Button>
	{/snippet}
</Story>

<Story name="Disabled [play: disabled ignores click]" play={playDisabledIgnoresClick}>
	{#snippet template(args: ButtonProps)}
		<div class="flex flex-wrap items-center gap-4">
			<Button intent="primary" disabled {...args}>Primary</Button>
			<Button intent="secondary" disabled {...args}>Secondary</Button>
			<Button intent="ghost" disabled {...args}>Ghost</Button>
			<Button intent="ghost-overlay" disabled {...args}>Ghost Overlay</Button>
			<Button intent="danger" disabled {...args}>Danger</Button>
		</div>
	{/snippet}
</Story>

<Story name="Icon Only">
	{#snippet template(args: ButtonProps)}
		<div class="flex flex-wrap items-center gap-4">
			<Button intent="primary" size="icon" aria-label="Demo" {...args}
				><PlusIcon data-icon="inline-start" /></Button
			>
			<Button intent="secondary" size="icon" aria-label="Demo" {...args}
				><SettingsIcon data-icon="inline-start" /></Button
			>
			<Button intent="ghost" size="icon" aria-label="Demo" {...args}
				><MailIcon data-icon="inline-start" /></Button
			>
			<Button intent="danger" size="icon" aria-label="Demo" {...args}
				><TrashIcon data-icon="inline-start" /></Button
			>
			<Button intent="primary" size="icon-sm" aria-label="Demo" {...args}
				><PlusIcon data-icon="inline-start" /></Button
			>
			<Button intent="ghost" size="icon-sm" aria-label="Demo" {...args}
				><SettingsIcon data-icon="inline-start" /></Button
			>
		</div>
	{/snippet}
</Story>

<Story name="With Icons">
	{#snippet template(args: ButtonProps)}
		<div class="flex flex-wrap items-center gap-4">
			<Button intent="primary" {...args}><PlusIcon data-icon="inline-start" /> Create</Button>
			<Button intent="secondary" {...args}
				><SettingsIcon data-icon="inline-start" /> Settings</Button
			>
			<Button intent="ghost" {...args}><MailIcon data-icon="inline-start" /> Mail</Button>
			<Button intent="danger" {...args}><TrashIcon data-icon="inline-start" /> Delete</Button>
		</div>
	{/snippet}
</Story>

<Story name="Data Icon Sizing">
	{#snippet template(args: ButtonProps)}
		<div class="flex max-w-xl flex-col gap-5">
			<div class="flex flex-wrap items-center gap-3">
				<Button intent="primary" {...args}>
					<PlusIcon data-icon="inline-start" />
					Start icon
				</Button>
				<Button intent="secondary" {...args}>
					End icon
					<ArrowRightIcon data-icon="inline-end" />
				</Button>
				<Button intent="ghost" {...args}>
					<SettingsIcon data-icon="inline-start" />
					Both
					<ArrowRightIcon data-icon="inline-end" />
				</Button>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				{#each BUTTON_TEXT_SIZES as size (size)}
					<Button intent="secondary" {size} {...args}>
						<MailIcon data-icon="inline-start" />
						{size}
					</Button>
				{/each}
			</div>
		</div>
	{/snippet}
</Story>

<Story name="With Keyboard Shortcuts">
	{#snippet template(args: ButtonProps)}
		<div class="flex flex-col gap-6">
			<div class="flex flex-wrap items-end gap-4">
				<div>
					<p class="mb-2 text-sm text-muted-foreground">Primary with Enter shortcut</p>
					<Button intent="primary" {...args}>
						Create
						<Kbd format="lucide" tone="inverted"><CornerDownLeftIcon /></Kbd>
					</Button>
				</div>
				<div>
					<p class="mb-2 text-sm text-muted-foreground">Primary with mono shortcut</p>
					<Button intent="primary" {...args}>
						Inspect
						<Kbd format="mono" tone="inverted">I</Kbd>
					</Button>
				</div>
			</div>
			<div>
				<p class="mb-2 text-sm text-muted-foreground">Ghost with Esc shortcut</p>
				<Button intent="ghost" {...args}>
					Cancel
					<Kbd format="lucide">Esc</Kbd>
				</Button>
			</div>
			<div>
				<p class="mb-2 text-sm text-muted-foreground">Ghost with Backspace shortcut</p>
				<Button intent="ghost" {...args}>
					Back
					<Kbd format="lucide"><DeleteIcon /></Kbd>
				</Button>
			</div>
			<div>
				<p class="mb-2 text-sm text-muted-foreground">Secondary with Enter shortcut</p>
				<Button intent="secondary" {...args}>
					Confirm
					<Kbd format="lucide"><CornerDownLeftIcon /></Kbd>
				</Button>
			</div>
			<div>
				<p class="mb-2 text-sm text-muted-foreground">Secondary with command shortcut</p>
				<Button intent="secondary" {...args}>
					Search
					<KbdGroup>
						<Kbd format="lucide"><CommandIcon /></Kbd>
						<Kbd>K</Kbd>
					</KbdGroup>
				</Button>
			</div>
			<div>
				<p class="mb-2 text-sm text-muted-foreground">Wizard footer example</p>
				<div class="flex items-center gap-2">
					<Button intent="ghost" size="sm" {...args}>
						Back
						<Kbd format="lucide"><DeleteIcon /></Kbd>
					</Button>
					<div class="flex-1"></div>
					<Button intent="ghost" size="sm" {...args}>
						Cancel
						<Kbd format="lucide">Esc</Kbd>
					</Button>
					<Button intent="primary" size="sm" {...args}>
						Create
						<Kbd format="lucide" tone="inverted"><CornerDownLeftIcon /></Kbd>
					</Button>
				</div>
			</div>
		</div>
	{/snippet}
</Story>
