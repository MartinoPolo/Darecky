<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ChoiceRow from './ChoiceRow.svelte';

	const { Story } = defineMeta({
		title: 'Derived/ChoiceRow',
		component: ChoiceRow,
		tags: ['autodocs'],
	});
</script>

<Story name="Compact choices">
	{#snippet template()}
		<div class="grid w-44 gap-1">
			<ChoiceRow selected={true} onSelect={() => {}}>
				{#snippet leading()}<span class="size-4 rounded-full border-2 border-ink bg-primary"
					></span>{/snippet}
				Selected choice
			</ChoiceRow>
			<ChoiceRow selected={false} onSelect={() => {}}>Available choice</ChoiceRow>
		</div>
	{/snippet}
</Story>

<Story name="Wrapping label">
	{#snippet template()}
		<div class="w-36">
			<ChoiceRow selected={false} onSelect={() => {}}
				>A compact choice with a long wrapping label</ChoiceRow
			>
		</div>
	{/snippet}
</Story>
