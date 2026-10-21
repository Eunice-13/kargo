# Missing Pasabuy batches — investigation and fix

The batches were hidden by a Phase 4 frontend query regression. Read-only checks
confirmed **38 existing batch records** and 61 catalog rows in the configured
Supabase project. No batches were deleted, recreated, reseeded or modified during
this investigation. After the localized fix, the signed-in buyer Home page again
renders existing Latest Batches and Popular Batches.

## Exact cause

Phase 4 changed the shared `loadCurrentAppData()` order query to embed
`payments.combined_delivery_group_id` and
`combined_delivery_payment_reservations`. The connected project does not yet have
that Phase 4 schema. The exact read request returned HTTP 400 / `PGRST200`:

```text
Could not find a relationship between 'payments' and
'combined_delivery_payment_reservations' in the schema cache
```

A separate read confirmed `42703` for the missing
`payments.combined_delivery_group_id` column and `PGRST205` for the missing
`combined_delivery_payment_accounts` table. These are undeployed schema
dependencies, not evidence of missing batch records.

The app fetches catalog and orders together. It throws `ordersError` before
returning loaded data, so `App.refreshData()` never reaches `setBatches(data.batches)`.
This made an unrelated payment read failure prevent catalog rendering. The previous
working order projection did not request the Phase 4 column or relationship.
The seller payment-submission query acquired the same hard dependency in Phase 4.

Both roles use this shared app loader, so both buyer catalog/dashboard views and
seller batch/dashboard views are affected by the failed initialization. The buyer
view was reproduced and verified in the browser; a separate seller login was not
performed. Seller read compatibility is covered by automated request tests.

## Environment and database findings

The app's Vite environment resolution and `supabase/.temp/project-ref` both identify
`leylmztbknmlwnwgvaud` (`leylmztbknmlwnwgvaud.supabase.co`). There is no observed
mismatch between the configured and repository-linked environment. This does not
independently establish the user's intended deployment environment beyond that
repository configuration.

Checks used read-only REST GET requests with count headers and no returned batch
contents. Server credentials were not logged or added to application code. Results:

| Read                                | Result                                         |
| ----------------------------------- | ---------------------------------------------- |
| `batches`, exact count              | 38 records                                     |
| `batch_catalog`, exact count        | 61 rows; catalog rows are not distinct batches |
| Phase 4 embedded order relationship | Missing, `PGRST200`                            |
| Phase 4 payment group column        | Missing, `42703`                               |
| Phase 4 payment accounts            | Missing, `PGRST205`                            |

Anonymous reads of protected raw orders/batches correctly returned permission
errors. No permission grants or RLS changes were needed or made. The observed
regression is explained by the new query dependency, without a change to the
catalog query, category/month filtering or batch RLS. No production migrations
were applied in the earlier Phase 4 development, and none were applied here.
There is no historical count snapshot to prove that every batch ever created is
still present; the current records exist and the reported frontend outage was
reproduced and corrected.

## Localized application fix

`loadPaymentCompatibleRows()` first uses the full Phase 4 projection. Only known
missing-schema errors naming the new combined payment dependency trigger a retry
with the exact previous standalone projection and sorting. It is used for both
shared app orders and seller proof history.

The helper does not turn failed reads into empty lists, suppress authorization
errors, retry payment mutations, or fall back on ambiguous/unrelated relationships.
Migrated environments keep their complete combined-payment metadata without an
extra read. All Phase 1–4 SQL, reservation rules, payment handlers and UI
implementations remain intact. Combined functionality still requires its validated
migration rollout; this fix does not enable it against an unmigrated database.

## Files modified for this investigation

- `src/services/kargoApi.ts` — route the two affected reads through the compatibility helper.
- `src/services/paymentReadCompatibility.ts` — new, narrowly scoped read compatibility helper.
- `tests/paymentReadCompatibility.test.ts` — ten regression tests using the actual Supabase query builder and intercepted HTTP responses.
- `docs/missing-batches-investigation.md` — this report.

Other uncommitted files belong to prior work and were preserved.

## Validation

- Ten new tests pass: missing relationship/column, both order and seller-proof
  reads, full migrated metadata, sorting, RLS/unrelated/ambiguous errors and
  propagation of a failed fallback.
- Complete application test run: **127/127 pass** using
  `node --test --test-concurrency=1 --test-timeout=30000 tests/*.test.ts tests/*.test.mjs`.
- `npm run typecheck`: pass.
- `npm run build`: pass.
- New helper/test formatting and `git diff --check`: pass. Existing repository
  formatting baseline issues were not reformatted.
- Reloaded the existing signed-in local application in Chrome. Existing catalog
  cards reappeared under Latest Batches and Popular Batches. No claim, checkout,
  payment, favorite or other data-changing UI action was performed.

The fix is local application code only; no deployment occurred. All database and
payment data was preserved. Full-schema staging remains a mandatory release gate
for Combined Delivery. Phase 5 was not started.
