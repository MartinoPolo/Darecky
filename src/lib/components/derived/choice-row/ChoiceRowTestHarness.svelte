<script lang="ts">
	import ChoiceRow from './ChoiceRow.svelte';

	let {
		selected,
		disabled = false,
		label,
		width,
		withLeading = false,
		onSelect,
	}: {
		selected: boolean;
		disabled?: boolean;
		label: string;
		width?: string;
		withLeading?: boolean;
		onSelect: () => void;
	} = $props();
</script>

<div style:width>
	{#if withLeading}
		<ChoiceRow {selected} {disabled} {onSelect}>
			{#snippet leading()}<span data-testid="leading" class="size-4 shrink-0"
				></span>{/snippet}
			{label}
		</ChoiceRow>
	{:else}
		<ChoiceRow {selected} {disabled} {onSelect}>{label}</ChoiceRow>
	{/if}
</div>

{#if withLeading}
	<div style:width>
		<button
			type="button"
			class="flex cursor-pointer items-center gap-2 rounded-btn border-2 border-transparent px-2 py-1.5 text-left text-(length:--text-sm) font-semibold text-foreground transition-colors"
		>
			<span class="size-4 shrink-0"></span>
			Original
		</button>
	</div>
{/if}
