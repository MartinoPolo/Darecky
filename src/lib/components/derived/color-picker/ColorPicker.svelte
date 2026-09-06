<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Popover from '$lib/components/base/popover/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import {
		CUSTOM_GIFT_CATEGORY_COLORS,
		GIFT_CATEGORY_COLOR_PATTERN,
	} from '$lib/modules/gift-categories/gift_category_colors.js';
	import { colorPickerVariants } from './color_picker_variants.js';

	interface Props {
		value: string;
		label: string;
		disabled?: boolean;
		onValueChange?: (value: string) => void;
	}

	let { value = $bindable(), label, disabled = false, onValueChange }: Props = $props();
	let open = $state(false);
	let openingValue = $state(value);
	let hexDraft = $state(value);
	let nativeInput: HTMLInputElement;
	let wasOpen = false;
	const pickerId = $props.id();
	const validationId = `${pickerId}-validation`;
	const styles = colorPickerVariants();
	const validDraft = $derived(GIFT_CATEGORY_COLOR_PATTERN.test(hexDraft));
	const changedDraft = $derived(
		validDraft && hexDraft.toUpperCase() !== openingValue.toUpperCase(),
	);
	const nativeValue = $derived(validDraft ? hexDraft : openingValue);

	function stage(candidate: string) {
		if (!open || disabled) {
			return;
		}
		hexDraft = candidate;
	}

	function cancel() {
		if (!open) {
			return;
		}
		hexDraft = openingValue;
		open = false;
	}

	function save() {
		if (!open || disabled || !changedDraft) {
			return;
		}
		const acceptedValue = hexDraft;
		value = acceptedValue;
		onValueChange?.(acceptedValue);
		open = false;
	}

	$effect(() => {
		if (disabled && open) {
			open = false;
		}
		if (open && !wasOpen) {
			openingValue = value;
			hexDraft = value;
		} else if (!open) {
			hexDraft = value;
		}
		wasOpen = open;
	});
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				type="button"
				class={styles.trigger()}
				style:background-color={value}
				aria-label={label}
				{disabled}
			></button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-64 space-y-3 p-3" aria-label={label} role="dialog">
		<div class="grid grid-cols-5 gap-2" role="group" aria-label={m.color_picker_presets()}>
			{#each CUSTOM_GIFT_CATEGORY_COLORS as preset (preset)}
				<button
					type="button"
					class={styles.swatch()}
					style:background-color={preset}
					aria-label={preset}
					aria-pressed={validDraft && hexDraft.toUpperCase() === preset}
					onclick={() => stage(preset)}
					{disabled}
				></button>
			{/each}
		</div>
		<label class="flex flex-col gap-1 text-sm font-semibold text-foreground">
			<span>{m.color_picker_hex_label()}</span>
			<Input
				value={hexDraft}
				oninput={(event) => stage(event.currentTarget.value)}
				spellcheck="false"
				maxlength={7}
				placeholder="#RRGGBB"
				state={validDraft ? 'default' : 'error'}
				aria-describedby={validDraft ? undefined : validationId}
				{disabled}
			/>
		</label>
		{#if !validDraft}
			<HelpText id={validationId} state="error">{m.color_picker_hex_invalid()}</HelpText>
		{/if}
		<Button
			type="button"
			intent="outline"
			size="sm"
			onclick={() => nativeInput.click()}
			{disabled}
		>
			{m.color_picker_native_action()}
		</Button>
		<div class="flex justify-end gap-2">
			<Button type="button" intent="outline" size="md" onclick={cancel} {disabled}>
				{m.cancel()}
			</Button>
			<Button
				type="button"
				intent="primary"
				size="md"
				onclick={save}
				disabled={disabled || !changedDraft}
			>
				{m.save()}
			</Button>
		</div>
	</Popover.Content>
</Popover.Root>

<input
	bind:this={nativeInput}
	type="color"
	class="sr-only"
	value={nativeValue}
	{disabled}
	aria-label={label}
	aria-hidden="true"
	tabindex="-1"
	oninput={(event) => stage(event.currentTarget.value)}
/>
