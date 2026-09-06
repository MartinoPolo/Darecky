import { env } from '$env/dynamic/private';
import { Resend } from 'resend';
import { escapeHtml } from '$lib/utils/escape_html.js';
import { reportOperationalFailure } from '$lib/observability/operational_failures.js';

/**
 * Email sending wrapper around Resend.
 *
 * Optional service: when `RESEND_API_KEY` is unset (e.g. local dev without a
 * Resend account), sends are logged to the console instead of dispatched –
 * mirroring the R2 storage fallback. Configure `RESEND_API_KEY` and
 * `EMAIL_FROM` in `.env` to send for real.
 */

/** Sandbox sender that works without a verified domain. */
const DEFAULT_FROM = 'Přejeme si <onboarding@resend.dev>';

interface SendEmailParams {
	readonly to: string;
	readonly subject: string;
	readonly html: string;
	readonly text?: string;
	/** Prevents duplicate sends on retry. Use a stable per-event key. */
	readonly idempotencyKey?: string;
	/**
	 * Dev-only: the action link embedded in the email (verify / reset).
	 * Logged to the console in dev so these flows can be exercised locally without a
	 * deliverable inbox. Ignored in production.
	 */
	readonly actionUrl?: string;
	/**
	 * Extra headers passed straight through to Resend (issue #206) – notification
	 * emails set `List-Unsubscribe` / `List-Unsubscribe-Post` here so mail clients
	 * offer their own one-click unsubscribe affordance (RFC 8058).
	 */
	readonly headers?: Record<string, string>;
}

let client: Resend | undefined;

function getClient(): Resend | undefined {
	if (env.RESEND_API_KEY === undefined || env.RESEND_API_KEY === '') {
		return undefined;
	}
	client ??= new Resend(env.RESEND_API_KEY);
	return client;
}

function getFrom(): string {
	return env.EMAIL_FROM !== undefined && env.EMAIL_FROM !== '' ? env.EMAIL_FROM : DEFAULT_FROM;
}

/**
 * Sends a transactional email. Throws on dispatch failure so callers can react;
 * no-ops (logging only) when no API key is configured.
 */
export async function sendEmail({
	to,
	subject,
	html,
	text,
	idempotencyKey,
	actionUrl,
	headers,
}: SendEmailParams): Promise<void> {
	// Dev: the Resend sandbox sender can only reach the account owner, so real sends
	// to other recipients fail. Always surface the action link so the flow is testable.
	if (import.meta.env.DEV && actionUrl !== undefined) {
		console.log(`[Email:dev] "${subject}" → ${to}\n[Email:dev] link: ${actionUrl}`);
	}

	const resend = getClient();

	if (resend === undefined) {
		reportOperationalFailure('resend', 'missing_configuration');
		return;
	}

	let response: Awaited<ReturnType<typeof resend.emails.send>>;
	try {
		response = await resend.emails.send(
			{
				from: getFrom(),
				to,
				subject,
				html,
				text: text ?? fallbackTextFromHtml(html),
				...(headers !== undefined ? { headers } : {}),
			},
			idempotencyKey !== undefined ? { idempotencyKey } : {},
		);
	} catch {
		reportOperationalFailure('resend', 'provider_unavailable');
		throw new Error('[Email] dispatch failed');
	}
	const { data, error } = response;

	if (error !== null) {
		reportOperationalFailure('resend', 'provider_rejected');
		// Dev: a sandbox rejection is expected for non-owner recipients; the link was
		// already logged above, so warn instead of throwing to keep sign-up unblocked.
		if (import.meta.env.DEV) {
			console.warn(
				`[Email:dev] Resend rejected "${subject}" (${error.message}) – use the logged link.`,
			);
			return;
		}
		throw new Error('[Email] dispatch failed');
	}

	// Dev-only: avoid logging recipient addresses (PII) on every send in production.
	// Resend's dashboard already records each send with its id.
	if (import.meta.env.DEV) {
		console.log(`[Email] Sent "${subject}" to ${to} (id=${data?.id})`);
	}
}

function formatTextAsHtml(value: string): string {
	return escapeHtml(value).replace(/\n/g, '<br>');
}

function fallbackTextFromHtml(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]*>/g, ' ')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n\s+/g, '\n')
		.trim();
}

interface ActionEmailParams {
	readonly heading: string;
	readonly body: string;
	readonly buttonLabel: string;
	readonly url: string;
	/** Optional localized copy for the action-link fallback; auth emails retain English. */
	readonly copyLinkText?: string;
	/**
	 * Unsubscribe/preferences footer (issue #206). Only notification emails pass
	 * these; auth emails (verify/reset) omit them and get no footer.
	 */
	readonly footerText?: string;
	readonly unsubscribeUrl?: string;
	readonly unsubscribeLabel?: string;
}

/**
 * Renders a minimal action email (heading + body text + a call-to-action button).
 * Shared across auth flows and notification emails to keep markup consistent.
 */
export function renderActionEmail(params: ActionEmailParams): string {
	const { heading, body, buttonLabel, url } = params;
	const copyLinkText = params.copyLinkText ?? 'Or copy this link into your browser:';
	const safeHeading = escapeHtml(heading);
	const safeBody = formatTextAsHtml(body);
	const safeButtonLabel = escapeHtml(buttonLabel);
	const safeUrl = escapeHtml(url);

	const footerHtml =
		params.footerText !== undefined && params.unsubscribeUrl !== undefined
			? `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#999;border-top:1px solid #eee;padding-top:16px;">${escapeHtml(params.footerText)} <a href="${escapeHtml(params.unsubscribeUrl)}" style="color:#999;text-decoration:underline;">${escapeHtml(params.unsubscribeLabel ?? params.unsubscribeUrl)}</a></p>`
			: '';

	return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f6f6;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;">
          <tr><td>
            <h1 style="margin:0 0 16px;font-size:20px;">${safeHeading}</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#444;">${safeBody}</p>
            <a href="${safeUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;">${safeButtonLabel}</a>
	            <p style="margin:24px 0 0;font-size:13px;color:#888;">${escapeHtml(copyLinkText)}<br><span style="word-break:break-all;">${safeUrl}</span></p>
            ${footerHtml}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function renderActionEmailText(params: ActionEmailParams): string {
	const copyLinkText = params.copyLinkText ?? 'Or copy this link into your browser:';
	const footerText =
		params.footerText !== undefined && params.unsubscribeUrl !== undefined
			? `\n\n${params.footerText} ${params.unsubscribeUrl}`
			: '';
	return `${params.heading}

${params.body}

${params.buttonLabel}: ${params.url}

${copyLinkText}
${params.url}${footerText}`;
}

export function renderActionEmailParts(params: ActionEmailParams): {
	readonly html: string;
	readonly text: string;
} {
	return {
		html: renderActionEmail(params),
		text: renderActionEmailText(params),
	};
}
