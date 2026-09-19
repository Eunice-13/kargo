# Refactor Notes — Tab-based folder split of `src/App.tsx`

Pure refactor of the single-file `src/App.tsx` (~16,156 lines) into a tab/feature
folder structure. No behavior, visual, or copy changes intended.

## Baseline (Step 0)

Captured before any changes (commit `chore: baseline before tab-based refactor`).

- `npm run typecheck` (`tsc --noEmit`): PASS
- `npm run build` (`vite build`): PASS
- JS bundle: `dist/assets/index-<hash>.js` = **428.66 kB** (gzip 109.60 kB)
- CSS bundle: `dist/assets/index-<hash>.css` = 61.46 kB (gzip 13.51 kB)
- Modules transformed: 1878
- Package manager: pnpm 10.34.3 via corepack (matches `.mise.toml`). `pnpm` was not
  on PATH; enabled through `corepack`. Dependencies were not installed at start;
  `corepack pnpm install` was run to enable typecheck/build.
- Git: repository did not exist at start; initialized here so each step can be
  committed. Baseline committed as the first commit.

### Smoke checklist
The interactive browser smoke checklist (buyer/seller flows, header menus, log out)
must be run manually by a human against `http://localhost:8443/?preview=original`.
This environment cannot drive a browser. The objective, automatable equivalents
(typecheck + build + bundle size + `madge --circular`) are used as the verifiable
gate after every step, and are recorded per step below.

## Unused / dead code found

- `BatchDetailPanel` (App.tsx L7740–8094) — never rendered. Moved to `src/_unused/`.
- `SellerSearchModal` (App.tsx L9590–9740) — never rendered. Moved to `src/_unused/`.

No other top-level component/helper/type/const was found unused; every other one has
at least one live reference. (Note: `ItemClaimModal` and `SellerProfileModal` are
referenced inside the two dead components above, but both are also rendered by live
features, so they remain live.)

## Final verification

- `npm run typecheck` (`tsc --noEmit`): PASS
- `npm run build` (`vite build`): PASS
- JS bundle: **431.87 kB** (gzip 110.32 kB) vs baseline 428.66 kB = **+0.75%** (within a few percent)
- CSS bundle: 61.46 kB (gzip 13.51 kB) — identical to baseline
- Circular imports: `npx madge --circular --extensions ts,tsx src` -> **"No circular dependency found!"** across 101 files
- `src/App.tsx`: **153 lines** (root only: imports, shared state, stage switch, layout)
- `src/main.tsx`: unchanged; still imports `./App` (default export)

## Bugs noticed but intentionally NOT fixed

None. No pre-existing bugs were observed while moving the code. (Per the task, any bug
found would be listed here and left as-is; none were found.)

## Component files still over ~400 lines after the split (and why)

Seed-data files are exempt from the target. The following component files remain over
~400 lines. Each is a single cohesive unit whose internal pieces close over a large,
tightly-shared local state set; splitting them further would mean threading many
setters as props, which raised the risk of a behavior change (the #1 hard rule) without
a real decoupling benefit. Left intact deliberately:

- `features/batches/Batches.tsx` (~1029) — the Batches hub: buyer + seller views, a
  batch grid, a filter bar, deep-link routing to BatchPage/SellerDirectory, and 4 modal
  mounts, all sharing claim/profile/financial state and the `handleClaim` handler.
- `features/claims/MyClaims.tsx` (~830) — buyer claims (card + table views) and the
  seller "orders received" branch; shares filter/target state across both.
- `features/batches/SellerProfileModal.tsx` (~758) — one modal with a 3-tab body
  (Shop/Reviews/About) over shared derived data.
- `features/auth/SignUp.tsx` (~715) — one multi-step form; every field block reads/writes
  the same form state and the single `submit` closes over ~10 values.
- `features/dashboard/Dashboard.tsx` (~689) — role-gated buyer/seller rows + stats +
  fulfillment board, all reading the shared stat derivations.
- `features/payments/Payments.tsx` (~564) — buyer payments view + the three trailing
  child modals; the seller branch was already extracted to `SellerPaymentVerification`.
- `features/batches/BatchPage.tsx` (~551) — full-page batch view (product list + seller
  panels) sharing claim/waitlist state and `handleClaim`.
- `features/orders/Orders.tsx` (~518) — buyer order cards + seller fulfillment board.
- `features/payments/SellerPaymentVerification.tsx` (~513) — the seller verification
  table; its 3 modals were extracted to sibling files, leaving the data table + row
  action logic.
- `features/batches/NewBatchModal.tsx` (~505) — one cohesive create-batch form.
- `features/batches/SellerShopPage.tsx` (~466) — seller shop page (item list + profile
  panel) over shared derived data.
- `components/shared/PayModal.tsx` (~443) — one cross-feature payment modal.
- `features/payments/PaymentSubmitModal.tsx` (~421) — one cohesive submit-proof modal.
- `data/batches.ts` (~420) — SEED DATA (exempt).

Files that WERE split into smaller siblings: `Settings.tsx` (1351 -> 347 + 11 section/
modal files), `Payments.tsx` seller branch -> `SellerPaymentVerification` + 3 modals,
`Header.tsx` (723 -> 86 + SearchBox/NotificationsMenu/UserMenu).

## Unused / dead code found

- `BatchDetailPanel` — never rendered. Moved to `src/_unused/BatchDetailPanel.tsx`.
- `SellerSearchModal` — never rendered. Moved to `src/_unused/SellerSearchModal.tsx`.

No other top-level component/helper/type/const was found unused; every other one has at
least one live reference. (`ItemClaimModal` and `SellerProfileModal` are referenced
inside the two dead components above, but both are also rendered by live features, so
they remain live and stay in `features/batches`.)

## Things not verified

- Interactive browser smoke checklist (buyer/seller flows, header menus, log out,
  console errors) — requires a human running the app in a browser; this environment
  cannot drive one. The automatable gate (typecheck + build + bundle size +
  `madge --circular`) passed after every step and is the substitute used here.
- Runtime visual/pixel equivalence was not diffed; correctness relies on the moves being
  byte-exact (verified per step by comparing extracted content against the original and
  confirming special characters/emoji survived) plus a passing type-check and build.

## Final folder tree

See `ARCHITECTURE.md` for the annotated folder tree and dependency direction. Summary:

```
src/
  App.tsx (153), main.tsx, index.css
  types/index.ts
  constants/{theme,fulfillment}.ts
  data/{batches,claims,toPay,payHistory,orders,reports,notifications}.ts
  state/navIntent.ts
  components/
    shared/   (Card, SH, PrimaryBtn, SecondaryBtn, Toggle, Modal, StatusBadge, Avatar,
               ProductThumb, Countdown, PaymentIcon, CategoryIcon, BIRBadge, PayModal,
               TrackOrderModal, ContactSellerModal, BuyerProfileModal) + index.ts
    layout/   (Header + SearchBox/NotificationsMenu/UserMenu, TabBar, TabContent,
               RoleToggle) + index.ts
  features/
    fulfillment/ dashboard/ batches/ claims/ payments/ orders/ reports/ settings/ auth/
    (each with its components + index.ts)
  _unused/  (BatchDetailPanel, SellerSearchModal)
```

## Notes on tooling / process

- The project had no git repo and no installed dependencies at start. A git repo was
  initialized (so each step could be committed) and dependencies installed with
  `corepack pnpm install` (pnpm 10.34.3, matching `.mise.toml`; `pnpm` was not on PATH,
  so `corepack` was used). Scripts run as `corepack pnpm run typecheck` / `... build`.
- Each step (types, data/state, shared, each feature, layout, App slim, each file split,
  docs) was committed separately after typecheck + build passed.
- Files were moved byte-for-byte (UTF-8, no BOM) so JSX/styles/copy/logic are unchanged.
