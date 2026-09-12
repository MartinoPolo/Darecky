<script lang="ts">
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import * as Select from '$lib/components/base/select/index.js';
	import WishlistBottomSheet from './WishlistBottomSheet.svelte';
	import WishlistSheetBody from './WishlistSheetBody.svelte';
	import WishlistSheetHeader from './WishlistSheetHeader.svelte';
	import * as m from '$lib/paraglide/messages.js';

	export interface BulkCopyDestination {
		id: string;
		title: string;
		status: 'draft' | 'active' | 'archived';
		recipientDisplayName: string;
	}

	interface Props {
		open: boolean;
		destinations: readonly BulkCopyDestination[];
		selectedDestinationId: string;
		selectedCount: number;
		loading?: boolean;
		submitting?: boolean;
		onopenchange: (open: boolean) => void;
		onback?: () => void;
		ondestinationchange: (id: string) => void;
		onconfirm: () => void;
	}

	let {
		open,
		destinations,
		selectedDestinationId,
		selectedCount,
		loading = false,
		submitting = false,
		onopenchange,
		onback,
		ondestinationchange,
		onconfirm,
	}: Props = $props();
	let viewportWidth = $state(1024);
	let confirmButton = $state<HTMLButtonElement | null>(null);
	let submittingCycleObserved = $state(false);
	const mobile = $derived(viewportWidth < 640);
	const unavailable = $derived(
		loading || submitting || selectedDestinationId === '' || destinations.length === 0,
	);
	const selectedDestinationLabel = $derived(
		destinations.find((destination) => destination.id === selectedDestinationId)
			? `${destinations.find((destination) => destination.id === selectedDestinationId)?.title} · ${destinations.find((destination) => destination.id === selectedDestinationId)?.recipientDisplayName}`
			: m.gift_bulk_copy_choose(),
	);

	$effect(() => {
		if (submitting) {
			submittingCycleObserved = true;
		} else if (submittingCycleObserved) {
			submittingCycleObserved = false;
			if (open) {
				requestAnimationFrame(() => {
					if (
						confirmButton !== null &&
						confirmButton.isConnected &&
						!confirmButton.disabled
					) {
						confirmButton.focus({ preventScroll: true });
					}
				});
			}
		}
	});
</script>

<svelte:window bind:innerWidth={viewportWidth} />

{#snippet destinationPicker()}
	<div class="space-y-4 px-4 py-3 sm:px-0 sm:py-4">
		{#if loading}
			<p class="text-sm text-muted-foreground">{m.moderator_loading()}</p>
		{:else if destinations.length === 0}
			<p class="text-sm text-muted-foreground">{m.gift_bulk_copy_empty()}</p>
		{:else}
			<div class="grid gap-2">
				<Label id="bulk-copy-destination-label" for="bulk-copy-destination">
					{m.gift_bulk_copy_destination()}
				</Label>
				<Select.Root
					type="single"
					value={selectedDestinationId}
					disabled={submitting}
					onValueChange={(value) => ondestinationchange(value ?? '')}
				>
					<Select.Trigger
						id="bulk-copy-destination"
						data-testid="bulk-copy-destination"
						aria-labelledby="bulk-copy-destination-label"
						class="w-full"
						size="lg"
					>
						{selectedDestinationLabel}
					</Select.Trigger>
					<Select.Content portalProps={{ disabled: true }}>
						{#each destinations as destination (destination.id)}
							<Select.Item
								value={destination.id}
								label={`${destination.title} · ${destination.recipientDisplayName}`}
							/>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet actions()}
	<div
		class="flex shrink-0 flex-col-reverse gap-2 px-6 pb-3 sm:flex-row sm:justify-end sm:px-0 sm:pb-0"
	>
		<Button
			intent="outline"
			class="w-full sm:w-auto"
			disabled={submitting}
			onclick={() => (mobile && onback !== undefined ? onback() : onopenchange(false))}
		>
			{mobile && onback !== undefined ? m.gift_context_back() : m.cancel()}
		</Button>
		<Button
			bind:ref={confirmButton}
			intent="primary"
			class="w-full sm:w-auto"
			disabled={unavailable}
			onclick={onconfirm}
		>
			{submitting
				? m.gift_bulk_pending({ count: selectedCount })
				: m.gift_bulk_copy_confirm()}
		</Button>
	</div>
{/snippet}

{#if mobile}
	<Sheet.Root {open} onOpenChange={onopenchange}>
		{#if open}
			<WishlistBottomSheet>
				<WishlistSheetHeader>
					<Sheet.Title>{m.gift_bulk_copy_title()}</Sheet.Title>
					<Sheet.Description>{m.gift_bulk_copy_description()}</Sheet.Description>
				</WishlistSheetHeader>
				<WishlistSheetBody>{@render destinationPicker()}</WishlistSheetBody>
				{@render actions()}
			</WishlistBottomSheet>
		{/if}
	</Sheet.Root>
{:else}
	<Dialog.Root {open} onOpenChange={onopenchange}>
		<Dialog.Content size="sm">
			<Dialog.Header>
				<Dialog.Title>{m.gift_bulk_copy_title()}</Dialog.Title>
				<Dialog.Description>{m.gift_bulk_copy_description()}</Dialog.Description>
			</Dialog.Header>
			{@render destinationPicker()}
			{@render actions()}
		</Dialog.Content>
	</Dialog.Root>
{/if}
