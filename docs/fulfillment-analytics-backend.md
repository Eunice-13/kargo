# Order Fulfillment Analytics — Phase 1 backend

Local implementation only. Apply `202611060001_fulfillment_analytics.sql` only after
explicit deployment approval and the existing admin, forward-only fulfillment,
and no-cancellation-after-payment migrations. The dashboard and existing GMV RPC
are deliberately unchanged.

## Counting contract

- The unit is an **order row entering a stage**, not a proof, payment, quantity,
  group checkout, or current-status count.
- Each `(order_id, stage)` contributes at most once: its first evidenced entry.
  A single order may contribute to multiple different stages over time.
  `totalEntries` therefore differs from `uniqueOrders`.
- Stages: `payment_confirmed`, `preparing`, `shipped`, `in_transit`, `delivered`,
  `cancelled`, `incomplete`. These preserve existing database distinctions.
  Expiration is not mislabeled as cancellation or fulfillment. No stage is added
  to the UI. A future UI may explicitly combine series, but must not treat a sum
  of shipped and in-transit entries as a distinct-order count.
- Shared-payment child orders each count once. Retrying verification, updating
  tracking, repeating a stage, and re-verification do not duplicate entries.
- Later cancellation does not erase a real earlier stage entry. This is historical
  operational analytics, not GMV eligibility or a sales/payment measure.

## Recording and historical limits

An additive AFTER INSERT/UPDATE trigger records the effective entered stage and
its observation timestamp atomically with the order write. Existing BEFORE
triggers still reject forbidden transitions first. No payment, inventory,
reservation, authorization, notification, cancellation or forward-only function
is replaced. Failed/rolled-back order writes produce no event. Initial insertion
into a stage records that observed entry; it does not infer earlier stages.

The migration locks order writes while installing capture and loading evidence,
inside one transaction. It writes only new analytics tables, never existing orders.
A backfill takes the earliest available evidence per order/stage from:

1. `orders.payment_confirmed_at` and `orders.completed_at`.
2. Identifiable `fulfillment_<status>_<order_id>` notifications with matching
   `context.order_id` and their recorded timestamps.
3. Admin cancellation audit records with matching order identity and cancelled
   after-state.

Creation/update timestamps, current status, tracking timestamps and absent
intermediate stages are **not** used to invent history. Invalid/future evidence
is omitted. Existing evidence may have incomplete retention or mutable payment
confirmation history, so recovered history is not asserted to be complete.
The response always declares `historicalCoverage: partial_evidence_only` and
`captureStartedAt`. Zero means no recorded entries, not proof that nothing happened
before capture. No guessed baseline event is created for existing rows lacking
stage-entry evidence. Provenance is included in drill-down results.

Raw event and metadata tables have RLS and no direct anon/authenticated grants.
Only the capture trigger can write through the application. Admin reads use the
existing `admin_assert()` authorization. Event deletion is not coupled to order
deletion: the FK restricts deleting an order with retained evidence.

## RPC/API contract

`adminApi.fulfillmentAnalytics(filters)` calls `admin_fulfillment_analytics`.
Filters are `{ period, start?, end? }`, default `last_30_days`.

- `today`: Manila calendar day, 24 hourly buckets.
- `last_7_days` / `last_30_days`: 7/30 Manila calendar dates including today, daily.
- `all_time`: earliest recorded evidence through today, monthly; an empty dataset
  returns the current month with zero counts.
- `custom`: inclusive Manila start/end dates with no future end date. One day is
  hourly, 2–31 days daily, 32–180 days weekly, longer ranges monthly.
- Weeks begin Monday. Weekly/monthly edge buckets may begin before the selected
  range, but only events inside the selected range contribute.
- Bounds are `[startAt, endAt)`; future events are excluded at `generatedAt`.
  All calendar math explicitly uses `Asia/Manila`, regardless of session timezone.

Response includes stage totals, distinct order count, entry count, zero-filled
chart buckets, bounds, grouping, timezone, coverage metadata, `generatedAt`, and
an evidence fingerprint `snapshot`.

`adminApi.fulfillmentOrders(filters, { stage, bucket?, generatedAt, snapshot }, limit, offset)`
returns the precise entries behind a stage/point. Pass the same applied filters
and the original summary's metadata. It uses identical range and bucket rules,
stable `(occurred_at, order_id)` ordering and a maximum page size of 100.
The rows include order identifiers, entry time/provenance, and current order state.
Current state is live context; it is not a claim about the historical entry state.

Events after the summary are excluded. If an older in-flight transaction commits
additional evidence that would change the snapshot, the RPC returns SQLSTATE
`40001` with a refresh instruction instead of silently presenting different
counts. The fingerprint is not a durable database snapshot or an authorization
token. Re-fetch both summary and drill-down after this error.

Demo mode explicitly reports unavailable history rather than manufacturing data.
No UI currently calls these new methods. Phase 2 is not implemented.

## Validation and release checks

Run `node --test tests/fulfillmentAnalytics.test.mjs tests/forwardFulfillment.test.mjs`
and `pnpm exec tsc --noEmit`. The analytics tests use ephemeral PGlite PostgreSQL,
never environment credentials or production records. They apply actual local
migrations against synthetic fixtures and test evidence recovery, Manila
boundaries/grouping, deduplication, transaction rollback, shared child orders,
existing transition/cancellation guards, permissions, pagination and snapshot
consistency. Existing fulfillment/payment regression tests remain applicable.

Before approving deployment: rehearse on a disposable complete Supabase schema,
check multi-session transitions/rollback against the real database and its other
triggers, inspect query plans with representative event volume, and budget the
migration's write-lock window for backfill. No production or staging migration
has been applied as part of this work.
