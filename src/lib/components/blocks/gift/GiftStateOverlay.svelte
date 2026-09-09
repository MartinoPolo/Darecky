<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		GiftOverlayKind,
		GiftStateOverlayModel,
	} from '$lib/modules/gifts/gift_display_state.js';
	import { cn } from '$lib/utils.js';

	interface GiftStateOverlayProps {
		model: GiftStateOverlayModel | null;
		class?: string;
	}

	let { model, class: className }: GiftStateOverlayProps = $props();

	function label(kind: GiftOverlayKind, state: GiftStateOverlayModel): string {
		switch (kind) {
			case 'received':
				return m.gift_received_badge();
			case 'own-reservation':
				return m.gift_reserved_by_me_overlay();
			case 'unavailable':
				return m.gift_reserved_by_other_overlay();
			case 'partial':
				return m.gift_remaining_capacity({
					remaining: state.remaining ?? 0,
					total: state.total ?? 0,
				});
		}
	}

	const primaryLabel = $derived(model === null ? null : label(model.kind, model));
	const supportLabel = $derived(
		model?.supportKind === undefined ? null : label(model.supportKind, model),
	);

	function pillClasses(kind: GiftOverlayKind): string {
		return cn(
			'max-w-[calc(100%_-_0.5rem)] -rotate-1 rounded-panel border-2 border-ink px-2 py-1 text-center text-xs leading-4 font-bold shadow-sticker [overflow-wrap:anywhere]',
			kind === 'own-reservation' && 'bg-[var(--gift-overlay-own-reservation)] text-white',
			kind === 'unavailable' && 'bg-[var(--gift-overlay-unavailable)] text-white',
			kind === 'partial' && 'bg-card text-foreground',
			kind === 'received' &&
				'bg-primary text-primary-foreground [text-shadow:0_1px_1px_var(--ink)]',
		);
	}
</script>

{#if model !== null}
	<div
		class={cn(
			'pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5',
			className,
		)}
		data-testid="gift-state-overlay"
	>
		<span class={pillClasses(model.kind)} data-state-primary data-state-kind={model.kind}
			>{primaryLabel}</span
		>
		{#if model.supportKind !== undefined && supportLabel !== null}
			<span
				class={pillClasses(model.supportKind)}
				data-reservation-support
				data-state-kind={model.supportKind}>{supportLabel}</span
			>
		{/if}
	</div>
{/if}
