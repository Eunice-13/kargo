# Architecture

KARGO is a React 19 + Vite + Tailwind CSS v4 single-page app. The UI was
originally one 16k-line `src/App.tsx`; it is now organized by tab/feature so
each screen, modal, and shared piece lives in its own small file.

## Folder tree

```
src/
  main.tsx                      React entrypoint; mounts <App/> into #root
  App.tsx                       Root only: stage switch (login/signup/app),
                                shared state, and the app-shell layout (~150 lines)
  index.css                     Global CSS + Tailwind import

  types/
    index.ts                    All shared types: Role, Tab, AppStage, ClaimStatus,
                                SettingsSection, UserInfo, ClaimRow,
                                ToPayRow, PayHistRow, OrderRow,
                                BatchStoredProduct, BatchItem, BatchType,
                                FulfillmentOrder, SharedState

  constants/
    theme.ts                    RETRO_THEME, INDIGO, CREAM, CYAN_L, SKY, CORAL,
                                GREEN, AMBER, TODAY, CAT_GRAD, STATUS_C
    fulfillment.ts              KANBAN_COLS, KanbanCol, KANBAN_COL_BG, PRIOR_FULFILLED

  data/                         Seed data only (initial values; live copies are
                                React state in App). batches, claims, toPay,
                                payHistory, orders, notifications

  state/
    navIntent.ts                Module-level mutable `navIntent` singleton, read/
                                written by App, Header (search), and Batches for
                                cross-tab deep-linking. Exported as the SAME mutable
                                object (intentionally not React state).
    routeScroll.ts              Global navigation scroll policy: `scrollToTop`
                                and `useScrollToTopOnRouteChange(routeKey)`. The
                                app shell keys it on stage + tab; tabs with their
                                own sub-pages (Batches) extend the key. Every page
                                therefore opens at the top without per-page scroll
                                code.

  components/
    shared/                     UI used by 2+ features. Leaf atoms (Card, SH,
                                PrimaryBtn, SecondaryBtn, Toggle, Modal, StatusBadge,
                                Avatar, ProductThumb + PROD_IMG, Countdown,
                                PaymentIcon, CategoryIcon, BIRBadge) and cross-feature
                                modals (PayModal + PAY_METHODS/SELLER_PAY_DETAILS,
                                TrackOrderModal + ORDER_STEPS, ContactSellerModal,
                                BuyerProfileModal). index.ts re-exports them.
    layout/                     App-shell chrome: Header (composed of SearchBox,
                                NotificationsMenu, UserMenu), TabBar (+ TABS,
                                RoleToggle), TabContent (routes the active tab to a
                                feature). index.ts re-exports Header/TabBar/TabContent.

  features/                     One folder per tab/feature. Each has an index.ts that
                                exposes only what other modules may import.
    fulfillment/                Shared board logic used by Dashboard AND Orders:
                                FULFILLMENT_INIT, useFulfillmentBoard,
                                FulfillmentLiveRegion, FulfillmentDetails; re-exports
                                the KANBAN_* constants and FulfillmentOrder type.
    dashboard/                  Dashboard
    batches/                    Batches (+ COLS), BatchPage, SellerShopPage,
                                SellerDirectoryPage, SellerProfileModal (owns
                                BIRInfoModal), ItemClaimModal, FinancialSummaryModal,
                                BuyerRequestFormModal, NewBatchModal (+ BatchProduct),
                                toggleBatchLock helper
    claims/                     MyClaims, ExtensionRequestModal
    payments/                   Payments, SellerPaymentVerification (+ its three
                                modals: Review/Insufficient/Reject and verifyTypes),
                                PaymentSubmitModal, TransactionDetailModal
    orders/                     Orders (+ uses ORDER_STEPS from shared), RateOrderModal
    settings/                   Settings (thin composer) + one file per section
                                (Profile, LinkedAccounts, Notifications,
                                PaymentMethods, Security), the payment-method and 2FA
                                modals, SocialConnectModal, NOTIF_DEFAULTS, PayMethod
    auth/                       Login, SignUp, Onboarding (+ TOUR_STEPS), AuthInput,
                                LogoMark

  _unused/                      Dead code kept for reference, not imported anywhere:
                                BatchDetailPanel, SellerSearchModal
```

## Dependency direction

Imports flow in one direction only. Nothing lower may import from something higher.

```
types, constants, data, state
        -> components/shared
              -> features/*
                    -> components/layout
                          -> App.tsx
```

- A feature may import from `components/*`, `types`, `constants`, `data`, `state`.
- A feature may import another feature ONLY through that feature's `index.ts`
  (e.g. Dashboard and Orders import the board from `@/features/fulfillment`).
- `components/shared` and `components/layout` never import from a feature, except
  `components/layout/TabContent` which composes the feature tab components (this is
  the one intended features -> layout edge, and it sits above features in the graph).
- If you hit a cycle, move the shared piece DOWN to `components/shared` (for UI) or a
  leaf module (for a type/const). Do not paper over a cycle with a dynamic import.
  There are currently no circular imports (verified with
  `npx madge --circular --extensions ts,tsx src`).

Cross-folder imports use the `@/` alias (configured to `src/`). Sibling imports
inside a folder use relative `./` paths. A file must never import from its own
feature's main component (that creates a cycle); shared types/consts for a feature
live in small leaf files (e.g. `features/settings/types.ts`,
`features/settings/notifDefaults.ts`, `features/payments/verifyTypes.ts`,
`features/batches/toggleBatchLock.ts`).

## Where do I add X?

- **A new tab/feature**: create `src/features/<name>/`, add the tab component (default
  export) and an `index.ts` that exports it. Add the tab name to `Tab` in
  `types/index.ts` and to `TABS` in `components/layout/TabBar.tsx`, then render it in
  `components/layout/TabContent.tsx`. Pass data through the existing `SharedState`
  prop bag from `App.tsx` (extend `SharedState` in `types/index.ts` if new state is
  needed, and add the `useState` in `App.tsx`).
- **A new modal used by ONE feature**: add it as a sibling file inside that feature
  folder and import it relatively; keep its trigger state in the feature component.
- **A new modal/UI used by TWO OR MORE features**: put it in `components/shared` as its
  own default-export file and re-export it from `components/shared/index.ts`.
- **A new shared atom (button, badge, etc.)**: `components/shared/<Name>.tsx` (default
  export) + re-export from the barrel. Import sibling shared pieces relatively to
  avoid barrel-induced cycles.
- **New seed data**: add a file under `data/` and import it into `App.tsx` state.
- **New theme color / constant**: add to `constants/theme.ts`.

## Admin console

The Admin account is a governance/support capability layered on the existing app,
not a third marketplace persona. It shares the same shell, components, and visual
language. `Role` is now `"Buyer" | "Seller" | "Admin"`, resolved in `App.tsx`
(`adminEnabled` wins, then `sellerEnabled`, else Buyer). Everything admin is gated
on `role === "Admin"`; buyer/seller paths are untouched.

```
src/
  features/admin/
    index.ts                    exposes the 5 tab screens + AdminProfile
    AdminDashboard.tsx          KPIs, needs-attention queue, 14-day GMV chart
    AdminUsers.tsx              accounts directory + AdminUserDetailModal
    AdminBatches.tsx            moderation list + AdminBatchDetailModal
    AdminTransactions.tsx       Orders / Payments / Combined sub-tabs
    AdminSecurity.tsx           Team + Audit log sub-tabs
    AdminProfile.tsx            personal profile + password (opened from avatar menu)
    useAdminResource.ts         data/loading/error/refresh hook (stale-response safe)
    adminTypes.ts               UI row/detail types for adminApi results
    components/                 AdminPageHeader, AdminStatCard, AdminFilterBar,
                                AdminBadge, AdminConfirmModal, AdminSectionTabs,
                                AdminStates, and the detail/confirm modals
  services/
    adminApi.ts                 typed RPC wrapper (callAdmin + AdminAccessError) and
                                an in-memory demo adapter toggled by setAdminDemoMode
  constants/admin.ts            ADMIN_TONES, filter options, action labels
  data/admin.ts                 ?preview=admin in-memory demo seed + adapters
```

- Admin top tabs: Dashboard, Users, Batches, Transactions, Security. `Tab` gained
  `"Users" | "Transactions" | "Security"`; `AdminTab` lists the five. `tabsForRole`
  in `TabBar.tsx` returns the admin set for admins, the buyer/seller set otherwise.
  `TabContent` branches shared tab names (Dashboard/Batches) on role.
- Admin data flows through `adminApi` (never the buyer/seller loaders).
  `loadCurrentAppData` short-circuits for admins with an empty snapshot.
- Admin pages use the `admin-page` class, NOT `mobile-data-page` (the latter
  restructures tables into labelled cards; admin tables scroll horizontally).
- `?preview=admin` boots an in-memory admin demo (no Supabase), mirroring
  `?preview=original`.

### Supabase (admin)

Migrations under `supabase/migrations/202611010001..04` add ONLY: `admin_members`
and `admin_audit_log` tables, an `account_status` column + moderation columns on
existing tables, and a set of `security definer`, `is_admin()`-gated RPCs
(`admin_dashboard`, `admin_list_*`, `admin_get_*`, and audited writes
`admin_set_account_status`, `admin_set_seller_access`, `admin_moderate_batch`,
`admin_cancel_order`, `admin_review_payment`, `admin_grant/revoke_admin`). Seller
BIR verification is intentionally out of scope (that infrastructure was removed in
`202609300002` before this work). `can_sell` self-updates are revoked; the
"Start Selling" flow uses the `enable_seller_access()` RPC.

## Conventions

- Components are default exports (see AGENTS.md). Per-folder `index.ts` files re-export
  with named exports.
- Strings containing apostrophes use double quotes.
- Files are UTF-8 without BOM; emoji and symbols (₱, —, ✓, •) are used directly in JSX.
