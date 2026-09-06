<script lang="ts">
	import { ElevationSurface } from '$lib/components/base/elevation-surface/index.js';
	import { cn } from '$lib/utils.js';
	import { buttonVariants, type ButtonProps } from './button_variants.js';

	let {
		/** Owner geometry and external layout classes. */
		class: className,
		/** Paint and internal layout classes for the moving surface. */
		surfaceClass,
		intent = 'primary',
		size = 'md',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();

	const styles = $derived(buttonVariants({ intent, size }));
</script>

{#snippet surface()}
	<ElevationSurface class={cn(styles.surface(), surfaceClass)}>
		{@render children?.()}
	</ElevationSurface>
{/snippet}

{#if href != null}
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(styles.owner(), className)}
		href={disabled === true ? undefined : href}
		aria-disabled={disabled}
		role={disabled === true ? 'link' : undefined}
		tabindex={disabled === true ? -1 : undefined}
		{...restProps}
	>
		{@render surface()}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(styles.owner(), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render surface()}
	</button>
{/if}
