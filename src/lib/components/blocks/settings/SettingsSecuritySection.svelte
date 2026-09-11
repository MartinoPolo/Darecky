<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Card from '$lib/components/base/card/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import AuthPasswordInput from '$lib/components/blocks/auth/AuthPasswordInput.svelte';
	import { Field, type FieldControlContext } from '$lib/components/derived/field/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { authClient } from '$lib/auth_client.js';
	import ShieldIcon from '@lucide/svelte/icons/shield';

	// Which control an error attaches to, so a single validation/API error can drive the
	// matching field's error state + aria wiring instead of one generic card-bottom message.
	const PASSWORD_ERROR_FIELD = {
		current: 'current',
		new: 'new',
		confirm: 'confirm',
	} as const;
	type PasswordErrorField = (typeof PASSWORD_ERROR_FIELD)[keyof typeof PASSWORD_ERROR_FIELD];

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let saving = $state(false);
	let passwordError = $state('');
	let passwordErrorField = $state<PasswordErrorField | null>(null);
	let passwordSuccess = $state(false);

	const currentPasswordError = $derived(
		passwordErrorField === PASSWORD_ERROR_FIELD.current ? passwordError : '',
	);
	const newPasswordError = $derived(
		passwordErrorField === PASSWORD_ERROR_FIELD.new ? passwordError : '',
	);
	const confirmPasswordError = $derived(
		passwordErrorField === PASSWORD_ERROR_FIELD.confirm ? passwordError : '',
	);

	async function handleChangePassword() {
		passwordError = '';
		passwordErrorField = null;
		passwordSuccess = false;

		if (newPassword.length < 8) {
			passwordError = m.settings_password_min_length();
			passwordErrorField = PASSWORD_ERROR_FIELD.new;
			return;
		}
		if (newPassword !== confirmPassword) {
			passwordError = m.settings_password_mismatch();
			passwordErrorField = PASSWORD_ERROR_FIELD.confirm;
			return;
		}

		saving = true;
		try {
			const result = await authClient.changePassword({
				currentPassword,
				newPassword,
			});

			if (result.error) {
				// A rejected change is almost always a wrong current password; surface it there.
				passwordError = result.error.message ?? m.settings_password_error();
				passwordErrorField = PASSWORD_ERROR_FIELD.current;
			} else {
				passwordSuccess = true;
				currentPassword = '';
				newPassword = '';
				confirmPassword = '';
				setTimeout(() => {
					passwordSuccess = false;
				}, 3000);
			}
		} catch {
			passwordError = m.error_generic();
			passwordErrorField = PASSWORD_ERROR_FIELD.current;
		} finally {
			saving = false;
		}
	}
</script>

<Card.Root>
	<Card.Header>
		<div class="flex items-center gap-2">
			<ShieldIcon class="size-5 text-muted-foreground" />
			<div>
				<Card.Title>{m.settings_security_title()}</Card.Title>
				<Card.Description>{m.settings_security_description()}</Card.Description>
			</div>
		</div>
	</Card.Header>
	<Card.Content>
		<div class="flex flex-col gap-4">
			<!-- Current password -->
			<Field
				fieldId="settings-current-password"
				label={m.settings_current_password()}
				errorMessage={currentPasswordError}
			>
				{#snippet children({ hasError, errorId }: FieldControlContext)}
					<AuthPasswordInput
						fieldId="settings-current-password"
						autocomplete="current-password"
						bind:value={currentPassword}
						{hasError}
						errorDescribedById={errorId}
					/>
				{/snippet}
			</Field>

			<!-- New password -->
			<Field
				fieldId="settings-new-password"
				label={m.settings_new_password()}
				errorMessage={newPasswordError}
			>
				{#snippet children({ hasError, errorId }: FieldControlContext)}
					<AuthPasswordInput
						fieldId="settings-new-password"
						autocomplete="new-password"
						bind:value={newPassword}
						{hasError}
						errorDescribedById={errorId}
					/>
				{/snippet}
			</Field>

			<!-- Confirm password -->
			<Field
				fieldId="settings-confirm-password"
				label={m.settings_confirm_password()}
				errorMessage={confirmPasswordError}
			>
				{#snippet children({ hasError, errorId }: FieldControlContext)}
					<AuthPasswordInput
						fieldId="settings-confirm-password"
						autocomplete="new-password"
						bind:value={confirmPassword}
						{hasError}
						errorDescribedById={errorId}
					/>
				{/snippet}
			</Field>
			{#if passwordSuccess}
				<HelpText state="success" aria-live="polite">
					{m.settings_password_changed()}
				</HelpText>
			{/if}
		</div>
	</Card.Content>
	<Card.Footer class="flex justify-end">
		<Button
			size="lg"
			onclick={handleChangePassword}
			disabled={saving || !currentPassword || !newPassword || !confirmPassword}
		>
			{saving ? m.saving() : m.settings_change_password()}
		</Button>
	</Card.Footer>
</Card.Root>
