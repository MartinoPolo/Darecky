<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';

	interface RegisterPasswordStrengthBarProps {
		password: string;
	}

	let { password }: RegisterPasswordStrengthBarProps = $props();

	let strength = $derived.by(() => {
		if (!password) {
			return 0;
		}
		let score = 0;
		if (password.length >= 8) {
			score++;
		}
		if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
			score++;
		}
		if (/\d/.test(password)) {
			score++;
		}
		if (/[^a-zA-Z0-9]/.test(password)) {
			score++;
		}
		return score;
	});

	let label = $derived.by(() => {
		if (!password) {
			return '';
		}
		if (strength <= 1) {
			return m.register_strength_weak();
		}
		if (strength === 2) {
			return m.register_strength_fair();
		}
		if (strength === 3) {
			return m.register_strength_good();
		}
		return m.register_strength_strong();
	});

	// Segment fills climb through the palette tokens (`anime-auth.html` strength bar):
	// danger → sticky-note accent → soft brand → full brand.
	let fillColor = $derived.by(() => {
		if (strength <= 1) {
			return 'var(--destructive)';
		}
		if (strength === 2) {
			return 'var(--accent-loud)';
		}
		if (strength === 3) {
			return 'color-mix(in oklab, var(--brand) 62%, var(--card))';
		}
		return 'var(--brand)';
	});
</script>

{#if password}
	<div class="strength-bar" role="progressbar" aria-label={m.register_strength_label({ label })}>
		{#each [0, 1, 2, 3] as index (index)}
			<div
				class="strength-segment"
				style:background={index < strength ? fillColor : undefined}
			></div>
		{/each}
	</div>
	<HelpText>{label}</HelpText>
{/if}

<style>
	.strength-bar {
		display: flex;
		gap: 5px;
		margin-top: 2px;
	}

	.strength-segment {
		flex: 1;
		height: 9px;
		border-radius: 999px;
		border: 2px solid var(--ink);
		background: var(--surface);
		transition: background var(--duration-normal);
	}
</style>
