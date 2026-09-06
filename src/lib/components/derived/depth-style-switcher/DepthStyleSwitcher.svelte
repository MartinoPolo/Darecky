<script module lang="ts">
	// Persistence order must span every mounted appearance surface, not just one component instance.
	let persistenceQueue: Promise<void> = Promise.resolve();
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { setUserDepthStyle } from '$lib/modules/settings/settings.remote.js';
	import {
		DEFAULT_DEPTH_STYLE,
		DEPTH_STYLES,
		isDepthStyle,
		type DepthStyle,
	} from '$lib/theme/depth_styles.js';
	import { depthStyleSwitcherVariants } from './depth_style_switcher_variants.js';

	const DEPTH_CHANGE_EVENT = 'app-depth-change';
	let selected = $state<DepthStyle>(DEFAULT_DEPTH_STYLE);
	let synchronized = $state(false);

	const labels: Record<DepthStyle, () => string> = {
		soft: m.depth_style_soft,
		ink: m.depth_style_ink,
		black: m.depth_style_black,
	};

	const styles = depthStyleSwitcherVariants();

	onMount(() => {
		const initial = document.documentElement.dataset.depth;
		if (isDepthStyle(initial)) {
			selected = initial;
		}
		synchronized = true;

		const synchronize = (event: Event) => {
			const value = (event as CustomEvent<DepthStyle>).detail;
			if (isDepthStyle(value)) {
				selected = value;
			}
		};
		window.addEventListener(DEPTH_CHANGE_EVENT, synchronize);
		return () => window.removeEventListener(DEPTH_CHANGE_EVENT, synchronize);
	});

	function persistDepth(value: DepthStyle) {
		persistenceQueue = persistenceQueue
			.then(() => setUserDepthStyle(value))
			.catch((error) => {
				console.error('[DepthStyleSwitcher] failed to persist depth style', error);
			});
	}

	function selectDepth(value: string) {
		if (value === '') {
			selected =
				(document.documentElement.dataset.depth as DepthStyle) ?? DEFAULT_DEPTH_STYLE;
			return;
		}
		if (!isDepthStyle(value) || value === document.documentElement.dataset.depth) {
			return;
		}

		selected = value;
		document.documentElement.dataset.depth = value;
		window.dispatchEvent(new CustomEvent<DepthStyle>(DEPTH_CHANGE_EVENT, { detail: value }));
		persistDepth(value);
	}
</script>

<div class={styles.root()}>
	<span class={styles.label()}>
		{m.depth_style_label()}
	</span>
	<ToggleGroup.Root
		type="single"
		aria-label={m.depth_style_label()}
		intent="default"
		bind:value={selected}
		onValueChange={selectDepth}
		class={styles.choices({ synchronized })}
		aria-hidden={!synchronized}
	>
		{#each DEPTH_STYLES as depth (depth)}
			<ToggleGroup.Item
				value={depth}
				aria-label={labels[depth]()}
				style={`--hard-shadow: var(--${depth}-shadow); --hard-shadow-strong: var(--${depth}-shadow-strong)`}
				class={styles.choice()}
				surfaceClass={styles.choiceSurface()}
			>
				{labels[depth]()}
				<span
					class={styles.indicator()}
					data-selected={selected === depth}
					aria-hidden="true"
				></span>
			</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>
</div>
