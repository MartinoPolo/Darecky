<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
	import { SearchField } from './index.js';

	const { Story } = defineMeta({
		title: 'Base/SearchField',
		component: SearchField,
		tags: ['autodocs'],
	});

	const playTypingUpdatesValue = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole('searchbox');
		await userEvent.click(input);
		await userEvent.type(input, 'hello');
		await waitFor(() => expect((input as HTMLInputElement).value).toBe('hello'));
	};

	const playOninputCallbackFires = async ({
		canvasElement,
		args,
	}: {
		canvasElement: HTMLElement;
		args: { oninput?: unknown };
	}) => {
		const spy = args.oninput as ReturnType<typeof fn>;
		const canvas = within(canvasElement);
		const input = canvas.getByRole('searchbox');
		await userEvent.click(input);
		await userEvent.type(input, 'abc');
		await waitFor(() => expect(spy).toHaveBeenCalled());
	};
</script>

<script lang="ts">
	import type { SearchFieldProps } from './search_field_types.js';
	import TreesIcon from '@lucide/svelte/icons/trees';
	import GitBranchIcon from '@lucide/svelte/icons/git-branch';
	import CornerDownLeftIcon from '@lucide/svelte/icons/corner-down-left';
	import { Kbd } from '$lib/components/base/kbd/index.js';
</script>

<Story name="All States">
	{#snippet template(args: SearchFieldProps)}
		<div class="grid max-w-2xl grid-cols-3 items-start gap-4">
			<div>
				<span class="mb-2 block text-xs text-muted-foreground">Rest</span>
				<SearchField
					placeholder="Search issues, branches…"
					aria-label="Search rest"
					{...args}
				/>
			</div>
			<div>
				<span class="mb-2 block text-xs text-muted-foreground">Typing + results</span>
				<SearchField value="forest" aria-label="Search typing">
					<div
						class="mt-1.5 max-h-80 overflow-auto rounded-md border border-border bg-surface p-1.5 shadow-lg"
					>
						<div
							class="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
						>
							Issues
						</div>
						<div
							class="flex cursor-pointer items-center gap-2 rounded-md bg-primary-soft px-2 py-1.5 text-[12.5px] text-foreground"
						>
							<TreesIcon class="size-3" />
							#118 · Forest view overlays
						</div>
						<div
							class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-foreground hover:bg-secondary"
						>
							<TreesIcon class="size-3" />
							#128 · Forest tag centering
						</div>
					</div>
				</SearchField>
			</div>
			<div>
				<span class="mb-2 block text-xs text-muted-foreground">No results</span>
				<SearchField value="qqzzqz" aria-label="Search no results">
					<div
						class="mt-1.5 rounded-md border border-border bg-surface p-4.5 text-center shadow-lg"
					>
						<span class="text-[11px] text-muted-foreground"
							>No matches for "qqzzqz".</span
						>
					</div>
				</SearchField>
			</div>
		</div>
	{/snippet}
</Story>

<Story name="Rest">
	{#snippet template(args: SearchFieldProps)}
		<div class="max-w-xs">
			<SearchField placeholder="Search issues, branches…" aria-label="Search" {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Typing With Results">
	{#snippet template(args: SearchFieldProps)}
		<div class="max-w-xs">
			<SearchField value="forest" aria-label="Search" {...args}>
				<div
					class="mt-1.5 max-h-80 overflow-auto rounded-md border border-border bg-surface p-1.5 shadow-lg"
				>
					<div
						class="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
					>
						Issues
					</div>
					<div
						class="flex cursor-pointer items-center gap-2 rounded-md bg-primary-soft px-2 py-1.5 text-[12.5px] text-foreground"
					>
						<TreesIcon class="size-3" />
						#118 · Forest view overlays
						<span class="ml-auto">
							<Kbd format="lucide"><CornerDownLeftIcon /></Kbd>
						</span>
					</div>
					<div
						class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-foreground hover:bg-secondary"
					>
						<TreesIcon class="size-3" />
						#128 · Forest tag centering
					</div>
					<div
						class="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
					>
						Branches
					</div>
					<div
						class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-foreground hover:bg-secondary"
					>
						<GitBranchIcon class="size-3" />
						feat/forest-overlays
					</div>
				</div>
			</SearchField>
		</div>
	{/snippet}
</Story>

<Story name="No Results">
	{#snippet template(args: SearchFieldProps)}
		<div class="max-w-xs">
			<SearchField value="qqzzqz" aria-label="Search" {...args}>
				<div
					class="mt-1.5 rounded-md border border-border bg-surface p-4.5 text-center shadow-lg"
				>
					<span class="text-[11px] text-muted-foreground">No matches for "qqzzqz".</span>
				</div>
			</SearchField>
		</div>
	{/snippet}
</Story>

<Story name="Typing Updates Value [play: typing updates value]" play={playTypingUpdatesValue}>
	{#snippet template(args: SearchFieldProps)}
		<div class="max-w-xs">
			<SearchField placeholder="Search…" aria-label="Search" {...args} />
		</div>
	{/snippet}
</Story>

<Story
	name="Oninput Callback Fires [play: oninput callback fires]"
	args={{ oninput: fn() }}
	play={playOninputCallbackFires}
>
	{#snippet template(args: SearchFieldProps)}
		<div class="max-w-xs">
			<SearchField placeholder="Search…" aria-label="Search" {...args} />
		</div>
	{/snippet}
</Story>
