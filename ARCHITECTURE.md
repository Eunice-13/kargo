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
                                ReportStatus, SettingsSection, UserInfo, ClaimRow,
                                ToPayRow, PayHistRow, OrderRow, ReportRow,
                                BatchStoredProduct, BatchItem, BatchType,
                                FulfillmentOrder, SharedState

  constants/
    theme.ts                    RETRO_THEME, INDIGO, CREAM, CYAN_L, SKY, CORAL,
                                GREEN, AMBER, TODAY, CAT_GRAD, STATUS_C, REPORT_C
    fulfillment.ts              KANBAN_COLS, KanbanCol, KANBAN_COL_BG, PRIOR_FULFILLED

  data/                         Seed data only (initial values; live copies are
                                React state in App). batches, claims, toPay,
                                payHistory, orders, reports, notifications

  state/
    navIntent.ts                Module-level mutable `navIntent` singleton, read/
                                written by App, Header (search), and Batches for
                                cross-tab deep-linking. Exported as the SAME mutable
                                object (intentionally not React state).

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
    reports/                    Reports, ReportDetailModal, ReportBadge
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

## Conventions

- Components are default exports (see AGENTS.md). Per-folder `index.ts` files re-export
  with named exports.
- Strings containing apostrophes use double quotes.
- Files are UTF-8 without BOM; emoji and symbols (₱, —, ✓, •) are used directly in JSX.
