# KARGO Supabase setup

The application runs in demo mode when Supabase environment variables are absent. Once they are present, authentication and persisted data are loaded from Supabase instead of the seed arrays.

## 1. Create and link a project

Install the Supabase CLI, authenticate, and link the repository to the intended project:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

## 2. Apply the database migration

Review and apply `supabase/migrations/202609200001_initial_kargo_schema.sql`:

```sh
supabase db push
```

The migration creates the approved 11 application tables, RLS policies, transactional functions, financial-summary function, public catalog projection, and three Storage buckets.

## 3. Deploy automated BIR verification

Deploy the server-owned QR decoder:

```sh
supabase functions deploy verify-bir-badge
```

The hosted Edge Function receives `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the Supabase runtime. Never add the service-role key to a Vite variable or browser environment.

The function downloads the current private BIR image, performs deterministic QR decoding, requires HTTPS and the exact hostname `verify.bir.gov.ph`, and calls the atomic conditional database function. A stale result is discarded when its expected object path is no longer current.

## 4. Configure the frontend

Copy `.env.example` to `.env.local` and provide:

```dotenv
VITE_SUPABASE_URL=https://leylmztbknmlwnwgvaud.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

For a project still using legacy keys, `VITE_SUPABASE_ANON_KEY` is also supported. Do not commit `.env.local`.

## 5. Configure Auth

In Supabase Auth:

- Enable email/password authentication.
- Set the production Site URL to the Vercel URL.
- Add local and production confirmation/reset redirect URLs.
- Configure custom SMTP under Authentication → Emails → SMTP Settings before enabling email confirmation. The default Supabase sender is capped at two messages per hour for the entire project and that cap cannot be raised, so signup and password reset fail with "Email rate limit exceeded" once it is spent.
- Email confirmation is enabled: signup sends a confirmation link and the account stays unconfirmed until it is clicked. Send from an address on a domain you control — sending as a free-mail address (a `gmail.com` address, for example) through a third-party relay fails SPF and DMARC alignment, so the confirmation mail can be filtered into spam.
- Allow-list every origin a confirmation or reset link may return to, including the local development origin. Supabase silently falls back to the Site URL for origins that are not allow-listed.
- Password reset links return to `/reset-password`, which the app renders as its own screen. Vercel's Vite preset does not fall back to `index.html` for unknown paths, so `vercel.json` carries the rewrite that lets that link resolve on a deployment. The app also recognises a recovery token that arrives on the root with `type=recovery` in the fragment, which is what happens when the redirect falls back to the Site URL.

### Signup profile fields

The signup form collects the display name, shop name, social links, and whether the account can sell. All of them travel as `auth.signUp` metadata (`options.data`), and the `handle_new_auth_user` trigger writes them into `user_profiles` as the auth user is created. The trigger runs whether or not Supabase returns a session, so the fields survive an unconfirmed-email round trip.

A client-side `user_profiles` update cannot do this: the table is update-authenticated only, and `auth.signUp` issues no session while a confirmation is pending, so the update matches zero rows and raises no error.

Apply `202610180004_signup_metadata_profile_fields.sql` together with the frontend change — through the Supabase SQL editor, like the other files in `supabase/migrations (to update profile database name)` (see `NYLAS_SETUP.md` §3). Without it the trigger writes only `display_name`, and the shop name, social links and seller flag are dropped again.

Seller signup creates the account first. Once authenticated, KARGO opens the private BIR verification flow because protected Storage uploads cannot safely occur before authentication.

## 6. Validate

```sh
npm run typecheck
npm run build
```

Before production launch, use separate buyer and seller test accounts to verify RLS for claims, payment receipts, seller receiving accounts, addresses, fulfillment transitions, and suspended accounts.

## Financial-summary rule

Gross sales include only `payment_confirmed`, `preparing`, and `completed` orders. An `insufficient_payment` order contributes only its verified partial payment to cash received and its shortfall to outstanding amount. Tax remains a user-entered estimate until KARGO approves a tax formula.
