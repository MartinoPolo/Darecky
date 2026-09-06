<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Input } from '$lib/components/base/input/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import AuthBrandPanel from '$lib/components/blocks/auth/AuthBrandPanel.svelte';
	import AuthBrandFeature from '$lib/components/blocks/auth/AuthBrandFeature.svelte';
	import AuthFormCard from '$lib/components/blocks/auth/AuthFormCard.svelte';
	import AuthDivider from '$lib/components/blocks/auth/AuthDivider.svelte';
	import SocialLoginButtons from '$lib/components/blocks/auth/SocialLoginButtons.svelte';
	import ErrorBanner from '$lib/components/blocks/auth/ErrorBanner.svelte';
	import AuthFormField from '$lib/components/blocks/auth/AuthFormField.svelte';
	import AuthPasswordInput from '$lib/components/blocks/auth/AuthPasswordInput.svelte';
	import AuthFooterLink from '$lib/components/blocks/auth/AuthFooterLink.svelte';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { authClient } from '$lib/auth_client.js';
	import {
		getLocalizedAuthCallback,
		getLocalizedAuthHref,
		localizeInternalHref,
	} from '$lib/i18n/locale.js';
	import * as m from '$lib/paraglide/messages.js';
	import ListIcon from '@lucide/svelte/icons/list';
	import LinkIcon from '@lucide/svelte/icons/link';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import MailIcon from '@lucide/svelte/icons/mail';
	import MailCheckIcon from '@lucide/svelte/icons/mail-check';
	import TurnstileWidget from '$lib/components/blocks/security/TurnstileWidget.svelte';

	const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let errorMessage = $state('');
	let emailError = $state('');
	let passwordError = $state('');
	// Set when sign-in is rejected because the address is unverified; drives the
	// resend-verification prompt below instead of the generic credentials error.
	let unverifiedEmail = $state('');
	let resending = $state(false);
	let resendSent = $state(false);
	let turnstileToken = $state<string | null>(null);
	let turnstileResetSignal = $state(0);

	let callbackUrl = $derived(
		getLocalizedAuthCallback(page.url.searchParams.get('redirect'), resolve('/home')),
	);

	function validateEmail(): boolean {
		if (!email.trim()) {
			emailError = m.enter_email();
			return false;
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			emailError = m.enter_valid_email();
			return false;
		}
		emailError = '';
		return true;
	}

	function validatePassword(): boolean {
		if (!password) {
			passwordError = m.enter_password();
			return false;
		}
		passwordError = '';
		return true;
	}

	function handleEmailBlur() {
		if (email) {
			validateEmail();
		}
	}

	function handlePasswordBlur() {
		if (password) {
			validatePassword();
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		unverifiedEmail = '';
		resendSent = false;

		const emailValid = validateEmail();
		const passwordValid = validatePassword();
		if (!emailValid || !passwordValid) {
			return;
		}

		loading = true;
		try {
			const result = await authClient.signIn.email(
				{
					email,
					password,
					callbackURL: callbackUrl,
				},
				{ headers: { 'x-captcha-response': turnstileToken ?? '' } },
			);

			if (result.error) {
				if (result.error.code === EMAIL_NOT_VERIFIED) {
					unverifiedEmail = email.trim();
				} else {
					errorMessage = m.login_error_credentials();
				}
			} else {
				await goto(callbackUrl);
			}
		} catch {
			errorMessage = m.error_generic();
		} finally {
			loading = false;
			turnstileToken = null;
			turnstileResetSignal += 1;
		}
	}

	async function handleResendVerification() {
		errorMessage = '';
		resending = true;
		try {
			const result = await authClient.sendVerificationEmail({
				email: unverifiedEmail,
				callbackURL: callbackUrl,
			});

			if (result.error) {
				errorMessage = m.error_generic();
			} else {
				resendSent = true;
			}
		} catch {
			errorMessage = m.error_generic();
		} finally {
			resending = false;
		}
	}
</script>

<svelte:head>
	<title>{m.login_title()} – Přejeme si</title>
	<meta name="description" content={m.login_subtitle()} />
</svelte:head>

<AuthBrandPanel>
	{#snippet tagline()}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html m.auth_tagline_login()}
	{/snippet}
	{#snippet features()}
		<AuthBrandFeature
			icon={ListIcon}
			title={m.auth_feature_wishlists_title()}
			description={m.auth_feature_wishlists_description()}
		/>
		<AuthBrandFeature
			icon={EyeOffIcon}
			title={m.auth_feature_hidden_title()}
			description={m.auth_feature_hidden_description()}
		/>
		<AuthBrandFeature
			icon={LinkIcon}
			title={m.auth_feature_sharing_title()}
			description={m.auth_feature_sharing_description()}
		/>
	{/snippet}
</AuthBrandPanel>

<AuthFormCard
	title={m.login_title()}
	subtitle={m.login_subtitle()}
	tabs={[
		{
			label: m.auth_tab_login(),
			href: getLocalizedAuthHref(resolve('/login'), callbackUrl),
			active: true,
		},
		{
			label: m.auth_tab_register(),
			href: getLocalizedAuthHref(resolve('/register'), callbackUrl),
			active: false,
		},
	]}
>
	{#if errorMessage}
		<ErrorBanner message={errorMessage} />
	{/if}

	{#if unverifiedEmail}
		{#if resendSent}
			<Alert.Root tone="default" class="mb-5">
				<MailCheckIcon />
				<Alert.Description>{m.login_resend_success()}</Alert.Description>
			</Alert.Root>
		{:else}
			<Alert.Root tone="warning" class="mb-5">
				<MailIcon />
				<Alert.Description>{m.login_error_unverified()}</Alert.Description>
			</Alert.Root>
			<Button
				type="button"
				intent="outline"
				size="lg"
				class="mb-5 w-full"
				disabled={resending}
				onclick={handleResendVerification}
			>
				{#if resending}
					<span class="spinner"></span>
				{/if}
				{m.login_resend_verification()}
			</Button>
		{/if}
	{/if}

	<form onsubmit={handleSubmit} novalidate>
		<div class="form-stack">
			<AuthFormField fieldId="login-email" label={m.email_label()} errorMessage={emailError}>
				<Input
					id="login-email"
					size="lg"
					type="email"
					placeholder={m.email_placeholder()}
					autocomplete="email"
					bind:value={email}
					onblur={handleEmailBlur}
					state={emailError ? 'error' : 'default'}
					aria-invalid={emailError ? true : undefined}
					aria-describedby={emailError ? 'login-email-error' : undefined}
					disabled={loading}
				/>
			</AuthFormField>

			<AuthFormField
				fieldId="login-password"
				label={m.password_label()}
				errorMessage={passwordError}
			>
				<AuthPasswordInput
					fieldId="login-password"
					bind:value={password}
					autocomplete="current-password"
					placeholder="........"
					hasError={!!passwordError}
					errorDescribedById={passwordError ? 'login-password-error' : undefined}
					disabled={loading}
					onblur={handlePasswordBlur}
				/>
				<a href={localizeInternalHref(resolve('/reset-password'))} class="forgot-link"
					>{m.login_forgot_password()}</a
				>
			</AuthFormField>
		</div>

		{#key turnstileResetSignal}
			<TurnstileWidget bind:token={turnstileToken} />
		{/key}

		<Button
			type="submit"
			class="mt-6 w-full"
			size="lg"
			disabled={loading || turnstileToken === null}
		>
			{#if loading}
				<span class="spinner"></span>
			{/if}
			{m.login_submit()}
		</Button>
	</form>

	<AuthDivider />

	<SocialLoginButtons googleLabel={m.login_google()} {callbackUrl} {loading} />

	<AuthFooterLink
		promptText={m.login_no_account()}
		linkHref={getLocalizedAuthHref(resolve('/register'), callbackUrl)}
		linkText={m.login_signup_link()}
	/>
</AuthFormCard>

<style>
	.form-stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.forgot-link {
		font-size: 13px;
		font-weight: 600;
		color: var(--link);
		text-decoration: underline;
		text-underline-offset: 3px;
		text-align: right;
		display: block;
		margin-top: 2px;
	}

	.forgot-link:hover {
		text-decoration-thickness: 2px;
	}

	.spinner {
		width: 18px;
		height: 18px;
		border: 2px solid oklch(from var(--primary-foreground) l c h / 35%);
		border-top-color: var(--primary-foreground);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		flex-shrink: 0;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
