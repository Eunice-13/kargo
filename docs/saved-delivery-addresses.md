# Saved delivery addresses

Prepared on `jenna`; no commit, push, deployment or production database operation.

## Database

`supabase/migrations/202610250001_buyer_addresses.sql` is a standalone feature delta. It depends on existing `auth.users`, `public.is_active(uuid)` and `public.can_sell(uuid)`. This new standard migration directory contains this delta only; it is not a reconstruction of production's migration history. Do not blindly push the archived historical directory or reset any database.

The table uses two numbered slots with a unique `(buyer_id, slot)` constraint, a partial unique default index, coordinate/text constraints, ownership RLS and transactional RPC mutations. Authenticated users can select their own rows; direct writes are revoked. Each mutation checks the active buyer identity and locks that buyer's existing Auth row without changing it. Concurrent requests serialize, and slot uniqueness independently prevents a third address. The first address becomes default; deleting a default assigns the remaining address. Updates use server timestamps. No profile, reservation or combined-delivery schema is altered.

The migration was applied **only to the existing guarded isolated local Supabase database** and recorded as `202610250001`. It has not been applied to production. Applying it to `leylmztbknmlwnwgvaud` requires separate explicit approval. Until then the production-backed localhost:8443 app explains that saved addresses are not enabled and keeps one-time claiming available.

## Interface and snapshots

Buyer Settings → My Addresses supports two addresses, label editing, default selection and confirmed deletion. The selector in the item-claim modal loads the default without overwriting in-progress input. Explicitly choosing a saved/custom address resets only the reused map instance, cancelling obsolete lookup requests. The existing map provider, pin interactions and claim submission handler remain intact. A complete-address textarea permits unit/building details alongside map search.

Claims copy address text and coordinates into existing reservation fields; no saved-address ID is submitted. One-time edits never save or update an address. Saved-address editing/deletion cannot cascade into historical reservations. Strict combined-delivery destination and batch matching are unchanged.

Manage Addresses in Settings closes the claim modal, selects the existing Settings tab and focuses My Addresses.

## Focused validation

- Five selection/snapshot tests: empty accounts, default autofill, in-progress custom input, copied snapshots and strict combined-delivery matching.
- Three rendering tests: reused map/full address input, safe loading state and buyer-only Settings navigation. Rendering tests use a map stand-in; they do not prove live tile-provider availability.
- Authenticated local REST integration: concurrent third-insert rejection; first/default switching/reassignment; editing/deletion; invalid input; cross-buyer read/mutation denial; direct-write and anonymous denial; unchanged existing reservation fingerprints.
- TypeScript and whitespace checks passed. No unrelated suites or production smoke-test writes.

The local runtime had stopped; its existing OrbStack/edge container was restarted before the safety guard permitted local validation. No new project, database or test website was created. End-to-end visual map interaction was not automated in this task; the original map component was not modified.

## Files changed

- `docs/saved-delivery-addresses.md`
- `scripts/local-staging/test-buyer-addresses.mjs`
- `src/components/layout/TabContent.tsx`
- `src/components/shared/DeliveryAddressFields.tsx`
- `src/components/shared/SavedAddressSelector.tsx`
- `src/components/shared/savedAddressSelection.ts`
- `src/components/shared/useBuyerAddresses.ts`
- `src/features/batches/ItemClaimModal.tsx`
- `src/features/settings/MyAddressesSection.tsx`
- `src/features/settings/Settings.tsx`
- `src/services/buyerAddresses.ts`
- `src/state/navIntent.ts`
- `src/types/index.ts`
- `supabase/migrations/202610250001_buyer_addresses.sql`
- `tests/fixtures/SavedAddressMap.tsx`
- `tests/fixtures/SavedAddressesShared.ts`
- `tests/savedAddressSelection.test.ts`
- `tests/savedAddressesUi.test.mjs`
