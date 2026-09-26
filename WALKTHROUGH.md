# KARGO Developer Walkthrough

## Contents

- [Project Overview](#project-overview)
- [Directory Map](#directory-map)
- [File-by-File Index](#file-by-file-index)
- [Feature-to-File Map](#feature-to-file-map)
- [Entry Points and Render Flow](#entry-points-and-render-flow)
- [Conventions and Patterns](#conventions-and-patterns)
- [Excluded Artifacts](#excluded-artifacts)

## Project Overview

KARGO is a responsive pasabuy order-fulfillment workspace for Filipino buyers and independent sellers. Buyers browse travel batches, claim items, submit payment details, and track fulfillment; sellers manage batches, claims, payment reviews, and orders. The frontend is a React 19 + TypeScript single-page application built with Vite 8 and Tailwind CSS v4, with Supabase for authentication and persistence when configured and in-memory seed data otherwise. Its architecture is feature-oriented: `App.tsx` owns app-level state and the shell, `TabContent` selects feature screens, and feature modules own their UI and workflows.

## Directory Map

```text
/
├── src/                         Application source
│   ├── components/layout/       App shell, header, sidebar, and view composition
│   ├── components/shared/       Reusable UI primitives, dialogs, and helpers
│   ├── constants/               Theme and fulfillment constants
│   ├── data/                    Seed data for demo mode
│   ├── features/                Auth and user-facing feature screens
│   ├── imports/                 Product/design prompt references, not runtime code
│   ├── lib/supabase/            Supabase client setup
│   ├── services/                Supabase-backed application API
│   ├── state/                   Small cross-view navigation intent
│   ├── types/                   Shared application/domain types
│   └── _unused/                 Archived components, not imported by the app
├── supabase/                    Supabase config, Edge Function, migrations, SQL test
├── scripts/                     Local demo-data and QR generation utilities
├── tests/                       Node tests for claim expiry logic
├── public/                      Static public assets (BIR seal placeholder)
├── .figma/make/                 Figma Make tooling and site configuration
├── .agents/, .claude/, .kiro/   Agent skills and Kiro steering documentation
└── dist/, node_modules/          Generated build/dependency output; excluded here
```

## File-by-File Index

### Application entry, layout, and global types

| File | Responsibility; key symbols; notable dependencies |
|---|---|
| `index.html` | Vite document shell; provides `#root` and loads `/src/main.tsx`. |
| `src/main.tsx` | Browser entry; imports global CSS and mounts `<App />` in React Strict Mode. |
| `src/App.tsx` | Root stage (`login`/`signup`/`app`), tab and user state, Supabase boot/refresh, shared data, and shell; composes auth, `Sidebar`, `Header`, and `TabContent`. |
| `src/index.css` | Tailwind import plus global typography, responsive rules, app-shell/sidebar scroll geometry, focus/motion behavior, and feature-wide styles. |
| `src/vite-env.d.ts` | Vite client environment typings. |
| `src/types/index.ts` | Shared `Tab`, `Role`, `UserInfo`, claim/order/batch/payment models, and the `SharedState` prop contract. |
| `src/constants/theme.ts` | Palette, status colors, date constant, and category gradients used across features. |
| `src/constants/fulfillment.ts` | Kanban columns, column colors, and prior fulfillment count shared by board views. |

### Layout components: `src/components/layout/`

| File | Responsibility; key symbols; notable dependencies |
|---|---|
| `src/components/layout/Header.tsx` | Full-width header with Kargo brand, global search, notifications, and user menu; composes the three neighboring components. |
| `src/components/layout/Sidebar.tsx` | Fixed icon rail for Dashboard, Batches, and Payments; owns expanded state, active indicator, click-collapse, and seller New Batch action; uses Lucide icons and `Tab`. |
| `src/components/layout/SearchBox.tsx` | Search input/results for batches, products, and sellers; calls navigation/deep-link callbacks supplied by `Header`/`App`. |
| `src/components/layout/NotificationsMenu.tsx` | Notification menu and route actions; uses notification data, role, and `onNavigate`. |
| `src/components/layout/UserMenu.tsx` | User/profile menu for settings, logout, and seller application; receives user and shell callbacks. |
| `src/components/layout/TabContent.tsx` | State-based route/view switch from `Tab` to Dashboard, Batches, My Claims, Payments, Orders, or Settings; adds transition direction. |
| `src/components/layout/TabBar.tsx` | Legacy horizontal tab implementation and `TABS` route-order constant; no longer mounted by the current `App.tsx` shell, but `TabContent` uses its ordering for transitions. |
| `src/components/layout/Footer.tsx` | Shared footer UI; feature pages can use it where appropriate. |
| `src/components/layout/index.ts` | Layout barrel exports for `Header`, `Sidebar`, `TabContent`, and legacy `TabBar`/`TABS`. |

### Shared UI: `src/components/shared/`

| File | Responsibility; key symbols; notable dependencies |
|---|---|
| `src/components/shared/Avatar.tsx` | Reusable initials/avatar display. |
| `src/components/shared/BIRBadge.tsx` | Seller BIR verification badge/status display. |
| `src/components/shared/BIRInfoModal.tsx` | Shared explainer dialog for BIR status/verification. |
| `src/components/shared/BuyerProfileModal.tsx` | Buyer profile/contact dialog used by seller-facing views. |
| `src/components/shared/Card.tsx` | Shared framed content container. |
| `src/components/shared/CategoryIcon.tsx` | Category-to-icon presentation helper. |
| `src/components/shared/ContactModal.tsx` | Shared contact seller/buyer dialog. |
| `src/components/shared/Countdown.tsx` | Reservation/deadline countdown display; consumes hours and optional item identity. |
| `src/components/shared/ExtensionRequestModal.tsx` | Shared extension-request UI used around claim/order workflows. |
| `src/components/shared/Modal.tsx` | Accessible dialog shell with focus handling, Escape, and background scroll lock. |
| `src/components/shared/PaymentIcon.tsx` | Payment-method icon mapping. |
| `src/components/shared/PaymentSuccessToast.tsx` | Reusable payment success feedback. |
| `src/components/shared/PrimaryBtn.tsx` | Primary action button with size/loading/disabled states. |
| `src/components/shared/ProductThumb.tsx` | Product thumbnail/visual fallback. |
| `src/components/shared/SH.tsx` | Shared section-heading row with optional action. |
| `src/components/shared/SecondaryBtn.tsx` | Secondary action button. |
| `src/components/shared/ShareButton.tsx` | Share action UI; delegates link handling to `shareLink`. |
| `src/components/shared/StatusBadge.tsx` | Claim/payment/order status pill driven by shared status colors. |
| `src/components/shared/Toggle.tsx` | Reusable boolean switch. |
| `src/components/shared/TrackOrderModal.tsx` | Order tracking dialog and status steps. |
| `src/components/shared/contactLink.ts` | Contact URL normalization/validation helper, including `resolveContactUrl`. |
| `src/components/shared/shareLink.ts` | Share/copy-link utility used by `ShareButton`. |
| `src/components/shared/index.ts` | Public barrel for cross-feature shared UI. |

### Authentication: `src/features/auth/`

| File | Responsibility; key symbols; notable dependencies |
|---|---|
| `src/features/auth/AuthLayout.tsx` | Shared login/signup screen frame and responsive auth layout. |
| `src/features/auth/AuthInput.tsx` | Shared auth field; password fields get accessible show/hide state, lock/eye icon, and controlled-value handling. |
| `src/features/auth/Login.tsx` | Login, validation, password recovery, demo fallback, and `kargoApi.signIn`. |
| `src/features/auth/SignUp.tsx` | Buyer/seller registration form, validation, optional seller details, BIR state, and `kargoApi.signUp`. |
| `src/features/auth/LogoMark.tsx` | Auth-screen Kargo logo mark. |
| `src/features/auth/Onboarding.tsx` | Post-signup guided onboarding flow and tour steps. |
| `src/features/auth/ApplyToSellModal.tsx` | Seller application and BIR verification entry point. |
| `src/features/auth/BirVerifier.tsx` | UI for BIR badge upload/scan/verification status. |
| `src/features/auth/birVerification.ts` | BIR URL/domain validation and verification helpers, including `isOfficialBirUrl` and `runBirVerification`. |
| `src/features/auth/index.ts` | Public auth exports used by `App.tsx`. |

### Batches and seller discovery: `src/features/batches/`

| File | Responsibility; key symbols; notable dependencies |
|---|---|
| `src/features/batches/Batches.tsx` | Main buyer/seller batch hub; browsing, filters, claims, seller directory/shop navigation, and modal orchestration. |
| `src/features/batches/BatchPage.tsx` | Batch detail screen; products, claim/waitlist actions, and seller controls. |
| `src/features/batches/NewBatchModal.tsx` | Seller batch/product creation form; exports `BatchProduct` with the modal. |
| `src/features/batches/ItemClaimModal.tsx` | Item claim confirmation/details dialog. |
| `src/features/batches/JoinWaitlistModal.tsx` | Buyer waitlist entry flow. |
| `src/features/batches/BuyerRequestFormModal.tsx` | Buyer request-for-item form tied to a batch. |
| `src/features/batches/SellerDirectoryPage.tsx` | Seller discovery/listing view. |
| `src/features/batches/SellerProfileModal.tsx` | Seller profile, active batches, reviews, and about content; may mount `BIRInfoModal`. |
| `src/features/batches/SellerShopPage.tsx` | Seller storefront with shop products and batch browsing. |
| `src/features/batches/BIRInfoModal.tsx` | Batch-feature BIR detail dialog, re-exported for its owning workflows. |
| `src/features/batches/FinancialSummaryModal.tsx` | Seller batch income/expense/profit summary and printable/export-oriented presentation. |
| `src/features/batches/batchSort.ts` | Batch ordering/sorting helpers used by batch lists. |
| `src/features/batches/expenseStore.ts` | Per-batch expense persistence helper for the current client session. |
| `src/features/batches/toggleBatchLock.ts` | Batch/product lock state mutation helper. |
| `src/features/batches/index.ts` | Public exports for `Batches` and `NewBatchModal`. |

### Claims: `src/features/claims/`

| File | Responsibility; key symbols; notable dependencies |
|---|---|
| `src/features/claims/MyClaims.tsx` | Buyer claims and seller “Orders Received”; filters, table/card modes, payment/cancel/extension actions, and return-to-dashboard action. |
| `src/features/claims/claimExpiry.ts` | Pure expiry/payability transformations (`claimIsPayable`, `expireClaimRows`, `removeExpiredPayments`); covered by Node tests. |
| `src/features/claims/index.ts` | Public `MyClaims` feature export. |

### Dashboard: `src/features/dashboard/`

| File | Responsibility; key symbols; notable dependencies |
|---|---|
| `src/features/dashboard/Dashboard.tsx` | Buyer/seller overview, `MetricCard`, claim/payment metric derivations, upcoming deadlines, recent claims/orders, fulfillment board, and checkout/report modal triggers. |
| `src/features/dashboard/WaitlistModal.tsx` | Buyer waitlist position/detail dialog; can deep-link to Batches. |
| `src/features/dashboard/SellerWaitlistCard.tsx` | Seller-facing waitlist/offer summary card. |
| `src/features/dashboard/SalesReportModal.tsx` | Sales report presentation/export/print flow, consuming batches and fulfillment data. |
| `src/features/dashboard/index.ts` | Public Dashboard export. |

### Fulfillment: `src/features/fulfillment/`

| File | Responsibility; key symbols; notable dependencies |
|---|---|
| `src/features/fulfillment/useFulfillmentBoard.ts` | Board state/actions hook for expanding, moving, and announcing fulfillment orders. |
| `src/features/fulfillment/FulfillmentDetails.tsx` | Expanded order details and status-move controls. |
| `src/features/fulfillment/FulfillmentLiveRegion.tsx` | Screen-reader live announcements for board updates. |
| `src/features/fulfillment/fulfillmentData.ts` | Initial fulfillment board records for demo mode. |
| `src/features/fulfillment/index.ts` | Public board hook/components/constants/types used by Dashboard and Orders. |

### Orders: `src/features/orders/`

| File | Responsibility; key symbols; notable dependencies |
|---|---|
| `src/features/orders/Orders.tsx` | Order tracking and fulfillment view; uses shared tracking/fulfillment pieces. |
| `src/features/orders/RateOrderModal.tsx` | Completed-order rating and review UI. |
| `src/features/orders/ratingOptions.ts` | Review statement/options data. |
| `src/features/orders/index.ts` | Public Orders export. |

### Payments: `src/features/payments/`

| File | Responsibility; key symbols; notable dependencies |
|---|---|
| `src/features/payments/Payments.tsx` | Buyer payment methods, To Pay list, upload proof, payment history, and seller-verification dispatch. |
| `src/features/payments/BatchCheckoutModal.tsx` | Groups pending items by seller, computes subtotals, shows seller payment details/QR, and starts per-item proof submission. |
| `src/features/payments/PaymentSubmitModal.tsx` | Item-level payment method, reference, contact, receipt, and proof submission form. |
| `src/features/payments/SellerPaymentVerification.tsx` | Seller queue for review/accept/reject/insufficient payment submissions. |
| `src/features/payments/ReviewSubmissionModal.tsx` | Detailed proof review UI. |
| `src/features/payments/InsufficientPaymentModal.tsx` | Seller response flow for underpaid submissions. |
| `src/features/payments/RejectPaymentModal.tsx` | Seller rejection/reason flow for a payment proof. |
| `src/features/payments/TransactionDetailModal.tsx` | Payment history/receipt transaction detail view. |
| `src/features/payments/AddressSection.tsx` | Buyer address list and edit/save interactions. |
| `src/features/payments/QrUploadField.tsx` | QR image upload/display field used for payment methods. |
| `src/features/payments/SellerPaymentMethods.tsx` | Seller receive-method management view. |
| `src/features/payments/AddPaymentMethodModal.tsx` | Add a seller receive method. |
| `src/features/payments/EditPaymentMethodModal.tsx` | Edit an existing receive method. |
| `src/features/payments/RemovePaymentMethodModal.tsx` | Confirm removal/deactivation of a receive method. |
| `src/features/payments/buyerPaymentMethods.ts` | Buyer-facing payment method choices/data. |
| `src/features/payments/sellerPaymentDetails.ts` | Seller payment identity/details lookup for grouped checkout. |
| `src/features/payments/paymentMethodTypes.ts` | Shared payment-method type definitions. |
| `src/features/payments/verifyTypes.ts` | Seller payment verification status/types. |
| `src/features/payments/index.ts` | Public exports for Payments and BatchCheckoutModal. |

### Settings: `src/features/settings/`

| File | Responsibility; key symbols; notable dependencies |
|---|---|
| `src/features/settings/Settings.tsx` | Settings shell/section selection and composition. |
| `src/features/settings/ProfileSection.tsx` | User profile display/edit. |
| `src/features/settings/LinkedAccountsSection.tsx` | Connected social/account links. |
| `src/features/settings/NotificationsSection.tsx` | Notification preference controls; uses defaults from `notifDefaults`. |
| `src/features/settings/SecuritySection.tsx` | Password update UI, validation, and per-field password visibility toggles. |
| `src/features/settings/SocialConnectModal.tsx` | Add/edit linked social account dialog. |
| `src/features/settings/notifDefaults.ts` | Default notification preferences and key/type data. |
| `src/features/settings/index.ts` | Public Settings export. |

### Data, state, backend, and supporting source

| File | Responsibility; key symbols; notable dependencies |
|---|---|
| `src/data/batches.ts` | `BATCHES_INIT` demo batch/product data. |
| `src/data/claims.ts` | `CLAIMS_INIT` demo claims. |
| `src/data/toPay.ts` | `TOPAY_INIT` pending payment demo rows. |
| `src/data/payHistory.ts` | `PAYHIST_INIT` demo payment history. |
| `src/data/orders.ts` | `ORDERS_INIT` demo orders. |
| `src/data/notifications.ts` | Demo notification rows. |
| `src/data/waitlist.ts` | Demo waitlist rows and `sortWaitlistUpcoming`. |
| `src/state/navIntent.ts` | Mutable `navIntent` deep-link target for batch/seller navigation across tab changes. |
| `src/lib/supabase/client.ts` | Reads Vite Supabase URL/publishable key, creates client, exports `isSupabaseConfigured`, `supabase`, and `requireSupabase`. |
| `src/lib/supabase/index.ts` | Supabase client barrel. |
| `src/services/kargoApi.ts` | Supabase data/API boundary; auth, profile/app loading, batches, claims, payments, waitlists, addresses, notifications, reviews, financial summaries, and expenses. |
| `src/services/index.ts` | Public `kargoApi` and response-type exports. |
| `src/_unused/BatchDetailPanel.tsx` | Archived, non-imported batch detail implementation kept for reference. |
| `src/_unused/SellerSearchModal.tsx` | Archived, non-imported seller search implementation kept for reference. |

### Server, tests, scripts, and static assets

| File | Responsibility; key symbols; notable dependencies |
|---|---|
| `supabase/config.toml` | Supabase CLI project configuration for local development, function deployment, and database tooling. |
| `supabase/functions/verify-bir-badge/index.ts` | Authenticated Edge Function; downloads the user's BIR image, decodes QR, verifies official BIR host, and updates verification through an RPC. |
| `supabase/tests/expired_claim_payment.sql` | Database integration test proving expired orders cannot accept payments and stock is released. |
| `tests/claimExpiry.test.ts` | Node tests for `claimExpiry` payability, expiry, and payment-list cleanup. |
| `scripts/seed-supabase.mjs` | Authenticated/RLS-aware creation of demo users and domain data; requires local Supabase environment variables. |
| `scripts/seed-maria.mjs` | Adds/reset Maria-specific seller demo data through app RPC paths. |
| `scripts/genGcashQr.mjs` | Generates a decorative, explicitly non-functional sample GCash QR SVG under `scripts/out/`. |
| `public/bir-seal-placeholder.svg` | Static placeholder artwork for the BIR badge flow. |

### Database migrations

Apply migrations in timestamp order with the Supabase CLI. Each migration is the source of truth for the schema/RPC change named below.

| File | Responsibility |
|---|---|
| `supabase/migrations/202609200001_initial_kargo_schema.sql` | Initial KARGO schema, tables, policies, and core RPCs. |
| `supabase/migrations/202609200002_batch_expenses.sql` | Batch expense storage/schema. |
| `supabase/migrations/202609230001_profile_reviews.sql` | Profile review support. |
| `supabase/migrations/202609240001_spec_updates.sql` | Follow-up schema/behavior updates from product requirements. |
| `supabase/migrations/202609250001_per_user_limit.sql` | Per-user claim/order limit protections. |
| `supabase/migrations/202609260001_waitlist_offers_schema.sql` | Waitlist offer schema additions. |
| `supabase/migrations/202609260002_waitlist_offers_rpcs.sql` | Waitlist offer creation/response RPCs. |
| `supabase/migrations/202609260003_expiry_sweep_cron.sql` | Scheduled expiry sweep for stale claims/orders. |
| `supabase/migrations/202609270001_expired_payment_guard.sql` | Reject payment for expired orders at database boundary. |
| `supabase/migrations/202609270002_payment_proof_details.sql` | Payment proof metadata/details fields. |
| `supabase/migrations/202609270003_remove_payer_account_number.sql` | Removes payer account-number storage. |
| `supabase/migrations/202609270004_fix_payment_method_mapping.sql` | Corrects payment method mapping. |
| `supabase/migrations/202609270005_payment_history_realtime.sql` | Realtime support for payment history changes. |
| `supabase/migrations/202609270006_rejected_payment_deadline.sql` | Deadline behavior after rejected payment. |

### Relevant project configuration and documentation

| File | Responsibility |
|---|---|
| `package.json` | Dependencies and `dev`, `build`, `preview`, `format`, `typecheck`, and `test:expiry` scripts. |
| `vite.config.ts` | React/Tailwind/Figma plugins, `@` alias, Supabase-safe env injection, and dev/preview server configuration. |
| `tsconfig.json` | Strict TypeScript and `@/*` path mapping. |
| `.mise.toml` | Expected Node/pnpm toolchain versions. |
| `.env.example` | Environment variable template; copy to local env and use client-safe publishable Supabase credentials only. |
| `README.md` | Setup, feature overview, demo behavior, Supabase configuration, and scripts. |
| `ARCHITECTURE.md` | Maintainer architecture rules and change-placement guidance; some older layout notes may lag the current Sidebar shell. |
| `DESIGN.md` | Product visual language and interaction guidance. |
| `PRODUCT.md` | Product goals, requirements, and domain context. |
| `SUPABASE_SETUP.md` | Supabase project setup instructions. |
| `SUPABASE-WIRING-PLAN.md` | Backend integration plan/status. |
| `REFACTOR_NOTES.md` | Historical notes from the original monolithic-App refactor. |
| `AGENTS.md`, `CLAUDE.md` | Workspace/project assistant instructions. |
| `.kiro/steering/architecture.md` | Kiro-specific architecture steering guidance. |
| `.agents/skills/supabase-server/SKILL.md`, `.claude/skills/supabase-server/SKILL.md`, `.kiro/skills/supabase-server/SKILL.md` | Duplicated tool-specific guidance for Supabase server/Edge Function work. |
| `.figma/make/site.json` | Figma Make site metadata consumed by `vite.config.ts`. |
| `.figma/make/dev`, `deploy`, `deploy-preview`, `format`, `install`, `langserver`, `analyze-routes` | Figma Make local tooling scripts; `dev.json` holds dev configuration. |
| `src/imports/KARGO_Figma_Update_Prompt.md` and `src/imports/pasted_text/*.md` | Imported product/design prompt references, not application modules. |

## Feature-to-File Map

| If you are changing… | Start here; related files |
|---|---|
| App boot, login stage, shared app data, shell layout | `src/App.tsx`; then `src/main.tsx`, `src/components/layout/TabContent.tsx`, `src/types/index.ts`. |
| Sidebar, header, global search, notifications, profile menu | `src/components/layout/Sidebar.tsx`, `Header.tsx`, `SearchBox.tsx`, `NotificationsMenu.tsx`, `UserMenu.tsx`; shell offsets/styles in `src/App.tsx` and `src/index.css`. |
| Route/tab selection or screen transition | `src/App.tsx` (`tab` state), `src/components/layout/TabContent.tsx`, `src/types/index.ts` (`Tab`); sidebar links in `Sidebar.tsx`. `TabBar.tsx` is legacy but still provides transition ordering. |
| Dashboard metrics, claim previews, deadlines, waitlist, seller board | `src/features/dashboard/Dashboard.tsx`; data from `src/App.tsx`, `src/data/*`, and `src/features/fulfillment/*`. |
| Batch browsing, claiming, sorting, batch details | `src/features/batches/Batches.tsx`, `BatchPage.tsx`, `batchSort.ts`, `ItemClaimModal.tsx`, `JoinWaitlistModal.tsx`; persistence through `src/services/kargoApi.ts`. |
| Seller discovery/profile/shop | `SellerDirectoryPage.tsx`, `SellerProfileModal.tsx`, `SellerShopPage.tsx` under `src/features/batches/`. |
| Claims, deadline expiry, buyer/seller claim tables | `src/features/claims/MyClaims.tsx`, `claimExpiry.ts`; tests in `tests/claimExpiry.test.ts`, backend rules in Supabase migrations. |
| Checkout, seller payment details, proof upload | `src/features/payments/Payments.tsx`, `BatchCheckoutModal.tsx`, `PaymentSubmitModal.tsx`, `sellerPaymentDetails.ts`, and shared payment types; API calls in `src/services/kargoApi.ts`. |
| Seller payment review | `SellerPaymentVerification.tsx`, `ReviewSubmissionModal.tsx`, `InsufficientPaymentModal.tsx`, `RejectPaymentModal.tsx`, `verifyTypes.ts`. |
| Payment methods and QR management | `SellerPaymentMethods.tsx`, `buyerPaymentMethods.ts`, `paymentMethodTypes.ts`, `AddPaymentMethodModal.tsx`, `EditPaymentMethodModal.tsx`, `RemovePaymentMethodModal.tsx`, `QrUploadField.tsx`. |
| Authentication and password visibility | `src/features/auth/Login.tsx`, `SignUp.tsx`, shared `AuthInput.tsx`; Supabase session/client and APIs in `src/lib/supabase/client.ts` and `src/services/kargoApi.ts`. Settings password fields are in `src/features/settings/SecuritySection.tsx`. |
| Seller verification/BIR badge | `ApplyToSellModal.tsx`, `BirVerifier.tsx`, `birVerification.ts`, `src/services/kargoApi.ts`, and `supabase/functions/verify-bir-badge/index.ts`. |
| Order tracking, fulfillment board, ratings | `src/features/orders/Orders.tsx`, `RateOrderModal.tsx`, `ratingOptions.ts`, shared `src/features/fulfillment/*`, and `src/components/shared/TrackOrderModal.tsx`. |
| Profile, linked accounts, notifications, security | `src/features/settings/Settings.tsx` plus the matching `*Section.tsx`, `SocialConnectModal.tsx`, and `notifDefaults.ts`. |
| Theme, status colors, Kanban columns | `src/constants/theme.ts`, `src/constants/fulfillment.ts`, then any consuming feature styles. |
| Demo data | `src/data/*.ts`, initialized in `src/App.tsx`; backend demo datasets use `scripts/seed-supabase.mjs` and `scripts/seed-maria.mjs`. |
| Schema, RLS, database functions, scheduled jobs | `supabase/migrations/*.sql`; follow with `src/services/kargoApi.ts` and SQL tests under `supabase/tests/`. |

## Entry Points and Render Flow

1. `index.html` provides `#root` and loads `/src/main.tsx`.
2. `src/main.tsx` imports `src/index.css` and renders `<App />` under `React.StrictMode`.
3. `src/App.tsx` chooses login/signup/app stage, optionally loads the current Supabase session/data, owns shared React state, and constructs `SharedState`.
4. In app stage, `App.tsx` renders `Header`, `Sidebar`, and the scrollable `<main>` containing `TabContent`; global dialogs are mounted alongside the shell.
5. `src/components/layout/TabContent.tsx` maps the current `Tab` to a feature component and provides view transition animation.
6. Feature components receive state and setters via `SharedState`; backend-enabled actions call `src/services/kargoApi.ts`, while no-Supabase mode uses seed data and local state.

There is no React Router, Redux, Zustand, or React Context provider in the current app. Navigation is a `Tab` union plus React state; `src/state/navIntent.ts` carries only batch/seller deep-link intent across a tab switch.

## Conventions and Patterns

- One user-facing area per `src/features/<area>/`; the main screen is usually `<Area>.tsx` and local dialogs/helpers live beside it.
- Feature boundaries are exposed through each folder's `index.ts`; cross-feature imports should use that public barrel. Same-feature siblings use relative imports.
- Shared UI used by multiple features belongs in `src/components/shared/`; app chrome belongs in `src/components/layout/`.
- `App.tsx` owns live shared state and passes data/setters through `SharedState`; `src/data/` is demo seed data, not the live store.
- Shared domain contracts live in `src/types/index.ts`; visual constants live in `src/constants/`.
- Supabase access is centralized in `src/lib/supabase/` and `src/services/kargoApi.ts`; components should use the service layer rather than constructing clients.
- Database changes belong in ordered SQL migrations. Edge Functions live under `supabase/functions/<function-name>/`.
- Components generally use default exports; feature barrels re-export named public symbols.
- Use the `@/` alias across folders and `./` for siblings. Keep dependency direction moving from types/data/constants to shared UI, features, layout, then `App.tsx`.
- Tailwind CSS v4 is configured through the Vite plugin; global styles and custom responsive rules live in `src/index.css`.
- Useful checks: `corepack pnpm run typecheck`, `corepack pnpm run build`, and `corepack pnpm run test:expiry`.

## Excluded Artifacts

This guide omits `node_modules/`, `dist/`, package-manager lockfiles, `.git/`, Supabase CLI state under `supabase/.temp/`, and generated `scripts/out/maria-gcash-qr.svg`. These are dependencies, build products, generated state, or reproducible output rather than source-of-truth code.