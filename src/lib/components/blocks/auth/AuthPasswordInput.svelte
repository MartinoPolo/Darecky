<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { Input } from '$lib/components/base/input/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import * as m from '$lib/paraglide/messages.js';

	interface AuthPasswordInputProps {
		fieldId: string;
		value: string;
		autocomplete?: HTMLInputAttributes['autocomplete'];
		placeholder?: string;
		hasError?: boolean;
		errorDescribedById?: string;
		disabled?: boolean;
		onblur?: () => void;
	}

	let {
		fieldId,
		value = $bindable(),
		autocomplete = 'current-password',
		placeholder,
		hasError = false,
		errorDescribedById,
		disabled = false,
		onblur,
	}: AuthPasswordInputProps = $props();

	let showPassword = $state(false);
</script>

<div class="relative">
	<Input
		id={fieldId}
		size="lg"
		type={showPassword ? 'text' : 'password'}
		{autocomplete}
		{placeholder}
		bind:value
		{onblur}
		aria-invalid={hasError ? true : undefined}
		aria-describedby={errorDescribedById}
		{disabled}
		state={hasError ? 'error' : 'default'}
		class="pr-12!"
	/>
	<Button
		intent="ghost"
		size="icon-sm"
		class="absolute top-1/2 right-0 size-10 -translate-y-1/2"
		surfaceClass="m-auto size-(--size-control-sm)"
		type="button"
		aria-label={showPassword ? m.hide_password() : m.show_password()}
		aria-pressed={showPassword}
		onclick={() => (showPassword = !showPassword)}
		{disabled}
	>
		{#if showPassword}
			<EyeOffIcon data-icon />
		{:else}
			<EyeIcon data-icon />
		{/if}
	</Button>
</div>
