<script lang="ts">
	import { tick, untrack, type ComponentProps } from 'svelte';
	import * as ContextMenu from '$lib/components/base/context-menu/index.js';
	import GiftContextActions from './GiftContextActions.svelte';
	import type { GiftContextFinishPolicy } from './gift_context_invocation.js';

	type Props = ComponentProps<typeof GiftContextActions> & { nativeOpen: boolean };

	let { nativeOpen, ...props }: Props = $props();
	let programmaticOpen = $state(untrack(() => props.programmaticOpen));
	let retainedSessionId = $state(untrack(() => props.sessionId));
	let queuedHandoff = $state<{ sessionId: number; run: () => void } | null>(null);

	$effect(() => {
		if (props.programmaticOpen === true) {
			retainedSessionId = props.sessionId;
			programmaticOpen = true;
		} else if (programmaticOpen === true) {
			programmaticOpen = false;
		}
	});

	function close() {
		programmaticOpen = false;
		props.onclose();
	}

	function finish(policy: GiftContextFinishPolicy, callback: () => void) {
		if (policy === 'handoff') {
			queuedHandoff = { sessionId: retainedSessionId, run: callback };
		} else {
			callback();
		}
		close();
	}

	function contextSurfaceIsOpen() {
		return nativeOpen === true || programmaticOpen === true;
	}

	async function complete(sessionId: number) {
		if (sessionId !== retainedSessionId || contextSurfaceIsOpen()) {
			return;
		}
		await tick();
		if (sessionId !== retainedSessionId || contextSurfaceIsOpen()) {
			return;
		}
		const queued = queuedHandoff?.sessionId === sessionId ? queuedHandoff : null;
		if (queued !== null) {
			queuedHandoff = null;
			queued.run();
		} else if (props.desktopAnchor?.isConnected === true) {
			props.desktopAnchor.focus({ preventScroll: true });
		}
		props.oncomplete(sessionId);
	}
</script>

<ContextMenu.Root open={nativeOpen}>
	<ContextMenu.Trigger>Gift target</ContextMenu.Trigger>
	<GiftContextActions
		{...props}
		{programmaticOpen}
		onclose={close}
		oncomplete={complete}
		onfinish={finish}
	/>
</ContextMenu.Root>
