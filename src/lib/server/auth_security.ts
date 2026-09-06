export const AUTH_CAPTCHA_ENDPOINTS = [
	'/sign-up/email',
	'/sign-in/email',
	'/request-password-reset',
] as const;

// BetterAuth's built-in limiter runs in the deployed Worker. Disable it for local
// development so parallel E2E account creation is deterministic.
export function authRateLimit(isProduction: boolean) {
	return { enabled: isProduction } as const;
}

// Clients must only be identified from Cloudflare's trusted edge header, never a
// caller-controlled forwarding chain.
export const AUTH_IP_ADDRESS_HEADERS = ['cf-connecting-ip'] as const;
