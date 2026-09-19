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
- Configure production SMTP before launch.
- Keep email confirmation enabled if required for production accounts.

Seller signup creates the account first. Once authenticated, KARGO opens the private BIR verification flow because protected Storage uploads cannot safely occur before authentication.

## 6. Validate

```sh
npm run typecheck
npm run build
```

Before production launch, use separate buyer and seller test accounts to verify RLS for claims, payment receipts, seller receiving accounts, addresses, fulfillment transitions, and suspended accounts.

## Financial-summary rule

Gross sales include only `payment_confirmed`, `preparing`, and `completed` orders. An `insufficient_payment` order contributes only its verified partial payment to cash received and its shortfall to outstanding amount. Tax remains a user-entered estimate until KARGO approves a tax formula.
