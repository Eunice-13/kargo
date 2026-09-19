# KARGO Order Fulfillment Platform

KARGO is a responsive pasabuy order-fulfillment workspace for Filipino buyers
and independent sellers. Buyers can discover seller-run travel batches, claim
items, submit payment details, and follow fulfillment progress. Sellers can
publish batches, review claims and payments, and move orders through the
fulfillment workflow.

KARGO is backed by [Supabase](https://supabase.com/) for authentication and
data. When Supabase credentials are supplied, the app runs against the live
database with persistent auth sessions. When they are absent, it automatically
falls back to an in-memory demo mode seeded from `src/data/` so the UI is fully
explorable without any backend.

> [!NOTE]
> The Supabase integration is detected at runtime via `isSupabaseConfigured`
> (see `src/lib/supabase/client.ts`). Features such as auth, batches, claims,
> payments, notifications, financial summaries, and sales reports have live
> Supabase paths and an in-memory fallback. Payments still simulate money
> movement — no payment provider is connected yet.

## Features

- Supabase-backed auth with an in-memory demo fallback
- Seller access is unlocked only by a verified BIR Registration Seal Badge
  (no free role switcher)
- "Apply to Become a Seller" flow with a multi-stage badge verification pipeline
  and Pending / Verified / Flagged status indicators
- Live batch discovery, seller profiles, item claims, and request forms
- Seller shop pages with collapsible batch cards that expand on tap
- Claim deadlines, payment submission, and seller payment verification
- Order tracking and a fulfillment Kanban board with an expandable full-screen view
- Seller batch creation, financial summaries, a printable sales report, and
  received-order management
- Interactive notifications, profile settings, linked accounts, payment methods,
  and security settings
- Responsive layouts, accessible interaction states, and reduced-motion support

## Tech stack

- React 19 and TypeScript 5.7
- Vite 8
- Tailwind CSS 4
- Supabase (`@supabase/supabase-js`) for auth and data
- Lucide React icons
- oxfmt for formatting

## Requirements

- Node.js 22
- npm or pnpm 10

The expected Node.js and pnpm versions are recorded in `.mise.toml`. If you use
[mise](https://mise.jdx.dev/), run `mise install` from the project directory.

## Getting started

```bash
git clone <repository-url>
cd KARGO_Order_Fulfillment_Platform
npm install
npm run dev
```

The development server listens on `http://localhost:8443` by default. Set the
`PORT` environment variable before starting Vite to use a different port.

### Connecting Supabase

Copy `.env.example` to `.env.local` and fill in your project values. The client
reads Vite-exposed variables, so the keys **must** be prefixed with `VITE_`:

```text
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-or-anon-key>
```

Only `VITE_`-prefixed variables are bundled into the browser, and only the
publishable/anon key belongs there. Keep any secret/service keys server-side and
never expose them to the client. If these variables are missing or unprefixed,
`isSupabaseConfigured` is `false` and the app runs in in-memory demo mode.

### Demo login (no Supabase)

When Supabase is not configured, the app opens on the sign-up screen. You can
create a simulated buyer account, apply as a seller, or select **Log in** and
use:

```text
Email: any valid email address
Password: password123
```

To skip authentication and open the seeded demo directly, visit:

```text
http://localhost:8443/?preview=original
```

### Trying the seller (BIR badge) verification

Seller access is gated behind a verified BIR Registration Seal Badge. Apply
from the sign-up screen or the profile dropdown ("Apply to Become a Seller") and
upload any image. In demo mode the authoritative QR decode is simulated from the
file name so you can exercise the full pipeline
(Uploading -> Scanning -> Verifying -> Verified / Flagged):

- A normal file name verifies (badge domain check passes) and unlocks seller access.
- A name containing `fake`, `tamper`, or `altered` is Flagged (fails the domain check).
- A name containing `blur` or `empty` is Flagged (QR unreadable).

The strict `verify.bir.gov.ph` domain/allow-list check itself is real code; the
authoritative QR decode is intended to run server-side (a Supabase Edge
Function). See `src/features/auth/birVerification.ts` for the documented server
boundary.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server with hot reload |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Run TypeScript checks without emitting files |
| `npm run format` | Format the project with oxfmt |

Equivalent `pnpm` commands can be used with `pnpm-lock.yaml`. Choose one package
manager for a change and avoid updating both lockfiles unintentionally.

## Project structure

```text
src/
|-- components/
|   |-- layout/       # Header, navigation, and tab composition
|   `-- shared/       # Reusable UI and cross-feature modals
|-- constants/        # Theme and fulfillment constants
|-- data/             # Seed data used for the in-memory demo fallback
|-- features/         # Auth, batches, claims, payments, orders, and other screens
|-- lib/              # Supabase client and configuration
|-- services/         # kargoApi — the Supabase-backed data access layer
|-- state/            # Cross-tab navigation intent
|-- types/            # Shared TypeScript types
|-- App.tsx           # Root state, authentication stage, and app shell
|-- index.css         # Global styles and Tailwind import
`-- main.tsx          # React entry point
```

Imports flow from foundational modules toward the application shell:

```text
types/constants/data/state -> lib/services -> shared components -> features -> layout -> App.tsx
```

Use the `@/` alias for imports across folders and relative imports for files in
the same folder. Feature modules expose their public API through `index.ts`.

For the complete folder map and guidance on adding tabs, modals, shared UI, and
seed data, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Data and backend status

- Auth and data run against Supabase when `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` are set; otherwise the app uses the in-memory
  demo seeded from `src/data/`.
- In demo mode, actions update only the current browser session and refreshing
  restores the original seed data.
- Uploaded files are not yet persisted to storage; upload progress is simulated.
- Payment actions do not transfer money or call a payment provider.
- BIR badge verification runs a real domain/allow-list check; the authoritative
  QR decode is intended to run server-side (see the note above). Social-account
  indicators remain references, not verified guarantees.

The broader database and integration plan is documented in
[SUPABASE-WIRING-PLAN.md](./SUPABASE-WIRING-PLAN.md).

## Quality checks

Before submitting a change, run:

```bash
npm run typecheck
npm run build
```

There is currently no automated test suite. Validate affected buyer and seller
flows manually in the browser in addition to running the checks above.

## Additional documentation

- [PRODUCT.md](./PRODUCT.md) — audience, product goals, voice, and design priorities
- [DESIGN.md](./DESIGN.md) — visual and interaction guidance
- [ARCHITECTURE.md](./ARCHITECTURE.md) — module boundaries and contribution guidance
- [REFACTOR_NOTES.md](./REFACTOR_NOTES.md) — refactor history and technical notes
- [SUPABASE-WIRING-PLAN.md](./SUPABASE-WIRING-PLAN.md) — backend integration plan

## Known prototype limitations

- Claim quantities do not consistently update totals and remaining stock.
- Header search has navigation and dismissal edge cases.
- Some payment-history fields and dates are still placeholder values.
- Accessibility work remains for contrast, form labels, and page headings.

## Production readiness

Before deploying KARGO for real transactions, complete payment-provider
integration, secure file handling and storage, server-side authorization checks,
input validation, audit logging, secrets management, and automated tests.
Complete an independent privacy and security review before accepting personal
documents or payment evidence.
