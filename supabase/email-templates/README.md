# Supabase Auth email templates

These six files are the **Brevo** half of KARGO's transactional email. The other
half — 16 order and payment emails — is rendered at send time by
`supabase/functions/process-pending-emails/email/`.

Both halves deliberately share one shell: indigo masthead with the ship mark,
the waterline rules, a manifest strip, Manrope headings on DM Sans body, and the
same cream footer. That is why the auth templates are **generated**, not
hand-edited: Supabase stores them as standalone HTML strings and they cannot
import `layout.ts`, so `scripts/build-auth-emails.mjs` re-declares the tokens
and fragments in one place.

| File | When it is sent |
| --- | --- |
| `confirmation.html` | Sign-up, until the address is confirmed |
| `recovery.html` | "Forgot password?" |
| `magic_link.html` | Passwordless sign-in |
| `invite.html` | An owner invites a teammate |
| `email_change.html` | Changing the account address |
| `reauthentication.html` | Re-entering a sensitive screen, sends a 6-digit code |

## Regenerate

Edit the `TEMPLATES` object in `scripts/build-auth-emails.mjs`, then:

```bash
node scripts/build-auth-emails.mjs          # write the six HTML files
node scripts/build-auth-emails.mjs --push   # write, then PATCH the live project
```

`--push` copies the current live HTML into `previous/` before replacing it, so a
change is reversible. Subject lines are never touched by the script.

## Preview

```bash
node scripts/shot-auth-emails.mjs                          # 700px, all six
node scripts/shot-auth-emails.mjs --width=390               # phone width
node scripts/shot-auth-emails.mjs --templates=recovery --dark=true
```

PNGs land in `scripts/out/auth-shots/` (git-ignored).

## Things to know

- **Do not edit the templates in the Supabase dashboard.** The next `--push`
  overwrites them. Change the generator instead.
- The banner logo is served from the deployed app
  (`/kargo-logo-head.png`) because the `brand-assets` storage bucket is not
  populated yet. If the worker switches to the bucket, change `LOGO` here too.
- Two Supabase Auth variables are easy to get wrong: `{{ .NewEmail }}` only
  exists in `email_change`, and `{{ .Token }}` is the 6-digit code used by
  `reauthentication` and `magic_link`.
- Keep the copy factual. Supabase creates an unconfirmed user row on sign-up,
  so an email must never claim that "no account is created".
