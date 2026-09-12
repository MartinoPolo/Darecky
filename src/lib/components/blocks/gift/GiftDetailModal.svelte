<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import {
		giftDetailModalVariants,
		type GiftDetailModalMode,
	} from './gift_detail_modal_variants.js';
	import type {
		GiftByRole,
		GiftForVisitor,
		CreateGiftInput,
		UpdateGiftInput,
	} from '$lib/modules/gifts/types.js';
	import type { GiftPriorityLevel } from '$lib/modules/gifts/types.js';
	import type { ManagedGiftCategory } from '$lib/modules/gift-categories/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import GiftDetailForm from './GiftDetailForm.svelte';
	import GiftDetailView from './GiftDetailView.svelte';

	interface Props {
		open: boolean;
		mode: GiftDetailModalMode;
		gift?: GiftByRole | null;
		wishlistId: string;
		priorityLevels: GiftPriorityLevel[];
		categoryOptions?: ManagedGiftCategory[];
		/** Viewer role drives reservation-safe read-only and editable manager actions. */
		role?: WishlistRole;
		/** Visitors/non-managers (issue #125): renders the read-only {@link GiftDetailView} instead of the edit form. */
		readOnly?: boolean;
		/** Archived wishlist (issue #165): the read-only view's reserve action hides
		 *  unless the viewer already holds a reservation (cancel-only), mirroring cards. */
		isArchived?: boolean;
		hideReservationState?: boolean;
		postShareLocked?: boolean;
		canDelete?: boolean;
		graceExpiresAt?: Date | null;
		graceMessage?: (inputs: { time: string }) => string;
		graceNow?: Date;
		isSubmitting?: boolean;
		isDeleting?: boolean;
		oncreate?: (input: CreateGiftInput) => void;
		onupdate?: (input: UpdateGiftInput) => void;
		ondelete?: (giftId: string) => void;
		/** Read-only view's inline reserve/like action bar (issue #165): opens the
		 *  reserve modal / cancels an existing reservation. */
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		mode,
		gift = null,
		wishlistId,
		priorityLevels,
		categoryOptions = [],
		role = 'visitor',
		readOnly = false,
		isArchived = false,
		hideReservationState = false,
		postShareLocked = false,
		canDelete = true,
		graceExpiresAt = null,
		graceMessage = m.gift_grace_hint,
		graceNow = new Date(),
		isSubmitting = false,
		isDeleting = false,
		oncreate,
		onupdate,
		ondelete,
		onreserve,
		onunreserve,
		onclose,
	}: Props = $props();

	let contentRef = $state<HTMLDivElement | null>(null);

	const styles = giftDetailModalVariants();
	const isEdit = $derived(mode === 'edit');
	const title = $derived(
		readOnly ? m.gift_detail_view_title() : isEdit ? m.gift_edit_title() : m.gift_add_title(),
	);

	function handleOpenChange(newOpen: boolean) {
		if (!newOpen) {
			onclose?.();
		}
		open = newOpen;
	}
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
	<Dialog.Content
		bind:ref={contentRef}
		class={styles.content()}
		showCloseButton={true}
		onOpenAutoFocus={(event) => {
			event.preventDefault();
			contentRef?.focus({ preventScroll: true });
		}}
	>
		<Dialog.Title class="sr-only">{title}</Dialog.Title>
		<Dialog.Description class="sr-only">
			{readOnly
				? m.gift_detail_view_description()
				: isEdit
					? m.gift_edit_description()
					: m.gift_add_description()}
		</Dialog.Description>

		{#if readOnly && gift !== null}
			<GiftDetailView
				{gift}
				{role}
				{isArchived}
				{hideReservationState}
				{onreserve}
				{onunreserve}
			/>
		{:else}
			<!-- The form seeds its field state once at mount (deliberately non-reactive), so a
			     mode/gift swap while it stays mounted would submit the previous gift's typed
			     values under the new gift's id. Keying by identity forces a remount + reseed,
			     making that cross-gift write structurally impossible (incident 2026-08-04). -->
			{#key `${mode}:${gift?.id ?? 'new'}`}
				<GiftDetailForm
					{mode}
					{gift}
					{wishlistId}
					{priorityLevels}
					{categoryOptions}
					{role}
					{hideReservationState}
					{postShareLocked}
					{canDelete}
					{graceExpiresAt}
					{graceMessage}
					{graceNow}
					{isSubmitting}
					{isDeleting}
					{oncreate}
					{onupdate}
					{ondelete}
				/>
			{/key}
		{/if}
	</Dialog.Content>
</Dialog.Root>
