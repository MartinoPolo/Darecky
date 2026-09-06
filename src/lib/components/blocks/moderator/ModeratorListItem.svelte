<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import type { ModeratorWithUser } from '$lib/modules/moderators/types.js';
	import { moderatorPanelVariants } from './moderator_panel_variants.js';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';

	interface ModeratorListItemProps {
		moderator: ModeratorWithUser;
		canRemove: boolean;
		isRemoving: boolean;
		onremove?: (assignmentId: string) => void;
	}

	let { moderator, canRemove, isRemoving, onremove }: ModeratorListItemProps = $props();

	const styles = moderatorPanelVariants();

	const initials = $derived.by(() => {
		const parts = moderator.userName.split(' ');
		if (parts.length >= 2) {
			return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
		}
		return (moderator.userName[0] ?? '?').toUpperCase();
	});

	const formattedDate = $derived.by(() => {
		try {
			return new Intl.DateTimeFormat(getLocale(), {
				day: 'numeric',
				month: 'short',
				year: 'numeric',
			}).format(new Date(moderator.assignedAt));
		} catch {
			return '';
		}
	});
</script>

<div class={styles.moderatorRow()}>
	{#if moderator.userImage}
		<img
			src={moderator.userImage}
			alt={moderator.userName}
			class="size-8 flex-shrink-0 rounded-full object-cover"
		/>
	{:else}
		<div class={styles.moderatorAvatar()}>
			{initials}
		</div>
	{/if}

	<div class={styles.moderatorInfo()}>
		<div class={styles.moderatorName()}>{moderator.userName}</div>
		<div class={styles.moderatorDate()}>{m.moderator_added_on({ date: formattedDate })}</div>
	</div>

	{#if canRemove}
		<Button
			size="sm"
			intent="ghost"
			class=""
			surfaceClass="text-destructive group-hover:text-destructive"
			disabled={isRemoving}
			aria-label={m.moderator_remove_label({ name: moderator.userName })}
			onclick={() => onremove?.(moderator.id)}
		>
			<TrashIcon data-icon="solo" />
		</Button>
	{/if}
</div>
