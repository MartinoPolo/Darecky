# Resend Email Setup

Status of email sending in Přejeme si, the free-tier limits, what's already wired, and the
production domain setup.

## Current production status

- Resend domain `prejemesi.cz` is verified.
- Production sender is `Přejeme si <noreply@prejemesi.cz>` via `EMAIL_FROM` in `wrangler.jsonc`.
- Production API key is stored as the Cloudflare Worker secret `RESEND_API_KEY`.
- DMARC is still external DNS work: add `_dmarc.prejemesi.cz` as a TXT record in Cloudflare.
- Receiving is disabled in Resend; the app only sends transactional emails.
- Signup email verification is enabled in BetterAuth.
- Critical notification emails are dispatched from app events through
  `notification_dispatcher.ts`.

## Service: Resend (free tier)

| Limit            | Free tier                   |
| ---------------- | --------------------------- |
| Emails / month   | 3,000                       |
| **Emails / day** | **100** ← the binding limit |
| Verified domains | 1                           |
| Log retention    | 30 days                     |
| Webhooks         | Basic                       |

Plenty for dev and early production. Pro ($20/mo) drops the daily cap and raises domains to 10.

**Sandbox vs. verified domain:**

- Until a domain is verified, the sandbox sender `onboarding@resend.dev` only delivers to:
    - the email you signed up to Resend with, and
    - the test addresses `delivered@resend.dev` (always succeeds), `bounced@resend.dev`,
      `complained@resend.dev` (simulate failures).
- Sending to any other real address requires a verified domain. Production uses verified
  `prejemesi.cz`.

## What's already wired (in code)

- `resend@6.x` installed.
- `src/lib/server/email.ts`
    - `sendEmail({ to, subject, html, text?, idempotencyKey? })` – wraps Resend, handles the
      `{ data, error }` response, **throws on failure**, and **logs instead of sending when
      `RESEND_API_KEY` is unset** (same optional-service fallback as R2 storage).
      It always sends a plain-text alternative, either caller-supplied or generated from HTML.
    - `renderActionEmailParts({ heading, body, buttonLabel, url })` – shared HTML + text
      template. User-controlled text is escaped before embedding in the HTML email.
- `src/lib/server/auth.ts` – the three better-auth stubs now send real emails:
    - `sendResetPassword` (password reset)
    - `sendVerificationEmail` (email verification)
- `.env.example` documents `RESEND_API_KEY` and `EMAIL_FROM`.

## Local setup

### 1. Create a Resend account + API key

1. Sign up at <https://resend.com> (free, no card). Use the email you'll test with –
   sandbox only delivers there.
2. Dashboard → **API Keys** → **Create API Key** (name `prejemesi-dev`, **Sending access**, domain **All**).
3. Copy the `re_...` key (shown once).

### 2. Configure `.env`

```
RESEND_API_KEY=re_your_key_here
EMAIL_FROM="Přejeme si <onboarding@resend.dev>"
```

Restart the dev server after editing `.env` so Vite reloads it.

### 3. Test the slice

1. `pnpm run dev`
2. From the login UI, request a **password reset** using your **Resend
   account email** (the only deliverable sandbox recipient).
3. Server console prints `[Email] Sent "..." (id=...)` on success. Check the inbox.

Troubleshooting:

- `(not sent – RESEND_API_KEY unset)` → key didn't load; check `.env` and restart dev server.
- `[Email] Failed ...` to a non-sandbox address → expected before domain verification.

### 4. Production domain

Already done for `prejemesi.cz`. If the domain is ever recreated, add the Resend DNS
records in Cloudflare and keep receiving disabled unless inbound email is intentionally
needed.

Also add a DMARC record in Cloudflare DNS:

```
_dmarc.prejemesi.cz TXT "v=DMARC1; p=none; adkim=s; aspf=s"
```

After monitoring delivery, consider tightening `p=quarantine` and then `p=reject`.

## Notification email coverage

Auth emails are wired: signup verification and password reset.

Notification dispatcher coverage:

- `liked_gift_reserved` – email + in-app when someone reserves a gift a user liked.
- `reserved_gift_edited` – email + in-app when a moderator edits a reserved gift.
- `wishlist_archived` – email + in-app to followers/moderators when a wishlist is archived.
- `owner_self_promoted` – email + in-app to followers when the owner enables reservation visibility.
- `moderator_invited` – email when an invite is generated for a target email address.
- `new_gift_added` – in-app only to followers.
- `gift_reserved` – in-app only to followers.

Still not covered:

- Saving notification preferences; the settings UI exists, but server persistence is still TODO.

## References

- Resend Node.js docs: <https://resend.com/docs/send-with-nodejs>
- Quotas & limits: <https://resend.com/docs/knowledge-base/account-quotas-and-limits>
- Pricing: <https://resend.com/pricing>
