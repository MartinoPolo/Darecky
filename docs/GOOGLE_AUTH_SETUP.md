# Google Authentication Setup

How to enable "Continue with Google" sign-in for Přejeme si.

The application code is **already fully wired** for Google OAuth:

- `src/lib/server/auth.ts` – registers the Google social provider (Better Auth)
- `src/routes/api/auth/[...betterauth]/+server.ts` – handles the OAuth callback
- `src/lib/components/blocks/auth/SocialLoginButtons.svelte` – calls
  `authClient.signIn.social({ provider: 'google' })`
- `src/routes/(auth)/login/+page.svelte` – renders the button

The only missing piece is obtaining **Google Cloud OAuth credentials** and placing them in `.env`.

Stack reference: Better Auth `~1.4.22`, redirect path `{ORIGIN}/api/auth/callback/google`.

---

## 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com/>
2. Top bar → project dropdown → **New Project**.
3. Name it (e.g. `Přejeme si`) → **Create** → select the new project.

## 2. Configure the OAuth consent screen

Required before credentials can be created.

1. Navigate to **APIs & Services → OAuth consent screen** (newer console: **Google Auth Platform →
   Branding**).
2. User type: **External** → **Create**.
3. Fill the required fields:
    - **App name**: `Přejeme si`
    - **User support email**: your email
    - **Developer contact email**: your email
4. **Scopes**: none required. Better Auth requests `openid`, `email`, `profile` by default – all
   non-sensitive, so no verification is needed.
5. **Test users**: while the app is in _Testing_ status, only listed users can sign in. Add the
   Google account(s) you'll test with → **Save**.

## 3. Create OAuth Client ID credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. **Application type**: **Web application**.
3. **Name**: e.g. `Přejeme si Web`.
4. **Authorized JavaScript origins**:
    - `http://localhost:5173`
    - _(production)_ `https://yourdomain.com`
5. **Authorized redirect URIs** – must match **exactly** (Better Auth uses
   `{ORIGIN}/api/auth/callback/google`):
    - `http://localhost:5173/api/auth/callback/google`
    - _(production)_ `https://yourdomain.com/api/auth/callback/google`
6. **Create**, then copy the **Client ID** and **Client secret**.

## 4. Add credentials to `.env`

In the project root `.env`:

```dotenv
GOOGLE_CLIENT_ID="<the client id>.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="<the client secret>"
ORIGIN="http://localhost:5173"

# Required for sessions – generate with: openssl rand -base64 32
AUTH_SECRET="<random 32-byte base64 string>"
```

Keep `ORIGIN` and the Google Console redirect URI in sync – the redirect URI is derived from
`ORIGIN`.

## 5. Restart the dev server

`$env/dynamic/private` is read at runtime, but the server must restart to pick up new `.env` values:

```bash
pnpm run dev
```

Open the login page and click **Continue with Google**.

---

## Code gotcha (fixed)

`src/lib/server/auth.ts` must enable the provider with a truthy guard. This avoids registering
Google when `.env` contains empty strings:

```ts
socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {},
```

---

## Notes

- **No `redirectURI` in code** – Better Auth derives it from `baseURL` (`ORIGIN`). Only keep
  `ORIGIN` and the Console redirect URI aligned.
- **Testing vs Production**: in _Testing_ status only listed test users can log in (no verification
  needed). To open sign-in to anyone, click **Publish App** on the consent screen. Verification is
  only required when requesting sensitive scopes – which Přejeme si does not.
- **Database**: Better Auth's Drizzle adapter stores the Google identity in the `account` table
  linked to `user`. No extra migration is needed beyond the existing schema.

## Troubleshooting

| Symptom                               | Cause / Fix                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `redirect_uri_mismatch`               | The Console redirect URI doesn't exactly match `{ORIGIN}/api/auth/callback/google` (check scheme, port, trailing slash). |
| `access_blocked` / "App not verified" | Your account isn't in **Test users**, or publish the app.                                                                |
| Button does nothing / 500 on callback | `.env` not loaded – restart the dev server; confirm `AUTH_SECRET` is set.                                                |
| Works locally, fails in prod          | Add the production origin **and** redirect URI in the Console; set `ORIGIN` to the prod URL.                             |
