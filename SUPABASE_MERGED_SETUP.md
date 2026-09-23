# Supabase setup for the merged KARGO build

This build is the merge of `origin/main` plus the backup-only features that were
ported on top. This note covers **only** what the merge changes about Supabase.
For the full original setup, see `SUPABASE_SETUP.md`.

## TL;DR

- Out of the box the app runs in **in-memory demo mode** — nothing persists to
  Supabase. That's the current state and it's fine for UI testing.
- To connect to Supabase, fill in `.env.local` and restart the dev server.
- **No new tables or migrations are required** by the ported features.
- The one feature that touches Supabase infrastructure is the **batch-history
  email** — it needs its Edge Function deployed (and optionally email secrets).

## 1. Connect the app to Supabase

Edit `.env.local` (already created, git-ignored) and set your real key:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<your key>
```

Find these in the Supabase dashboard → Project Settings → API. Then restart:

```
npm run dev
```

When configured, the console line "Supabase not configured — running in
in-memory demo mode" disappears and reads/writes go to your project.

## 2. Ported features and their Supabase impact

| Ported feature | Needs Supabase changes? |
| --- | --- |
| About Us modal (from logo) | No — pure UI |
| Continue with Facebook (login) | No — demo-only button; real OAuth is not wired |
| Per-item share button | No — client-side link/clipboard |
| Sort reviews by most helpful | No — sorts a local array |
| Upcoming Deadlines < 24h | No — client-side filter |
| Mobile single-column collapse | No — CSS only |
| Extension "request sent" toast | No — uses the existing `request_order_extension` RPC |
| **Batch-history email on close** | **Yes — deploy the Edge Function (below)** |

Everything except the batch-history email works against the **existing** schema
already defined in `supabase/migrations/` — no new entries needed.

## 3. Batch-history email Edge Function (feature #7)

The function lives at `supabase/functions/email-batch-history/`. It only READS
tables that already exist (`batches`, `batch_products`, `orders`) — so there is
nothing new to migrate. It just needs to be deployed to your project.

Deploy it (same pattern as the existing `verify-bir-badge` function):

```
supabase functions deploy email-batch-history
```

### Optional: real email delivery

Without email secrets, the function still runs and returns the composed history
log; it simply skips sending an actual email (a graceful no-op). To send real
email, set these function secrets:

```
supabase secrets set RESEND_API_KEY=<your Resend API key>
supabase secrets set BATCH_HISTORY_FROM_EMAIL=<verified sender address>
```

Until the function is deployed, locking/closing a batch while connected to
Supabase will show an "Unable to email batch history" toast — that just means
the endpoint isn't there yet.

## 4. What was NOT changed

- No migrations were added or modified by the merge.
- The buyer "+ Add Method → Payment Methods settings" deep-link from the backup
  was intentionally not ported, because `origin/main` reorganized payment
  methods to be seller-only. No schema depends on that.
