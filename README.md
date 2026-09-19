# KARGO Order Fulfillment Platform

KARGO is a responsive pasabuy order-fulfillment workspace for Filipino buyers
and independent sellers. Buyers can discover seller-run travel batches, claim
items, submit payment details, and follow fulfillment progress. Sellers can
publish batches, review claims and payments, and move orders through the
fulfillment workflow.

> [!IMPORTANT]
> KARGO is currently a front-end prototype. Authentication, file uploads,
> payments, notifications, and account verification are simulated. Application
> data is held in React state and resets when the page is refreshed. No backend
> or database is connected yet.

## Features

- Buyer and seller account flows with an in-app role switcher
- Live batch discovery, seller profiles, item claims, and request forms
- Claim deadlines, payment submission, and seller payment verification
- Order tracking and a fulfillment Kanban board
- Seller batch creation, financial summaries, and received-order management
- Reports, notifications, profile settings, linked accounts, payment methods,
  and security settings
- Responsive layouts, accessible interaction states, and reduced-motion support

## Tech stack

- React 19 and TypeScript 5.7
- Vite 8
- Tailwind CSS 4
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

The app opens on the sign-up screen. You can either create a simulated buyer or
seller account, or select **Log in** and use:

```text
Email: any valid email address
Password: password123
```

To skip authentication and open the seeded demo directly, visit:

```text
http://localhost:8443/?preview=original
```

No environment variables or external services are required for local
development.

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
|-- data/             # Seed data used to initialize in-memory state
|-- features/         # Auth, batches, claims, payments, orders, and other screens
|-- state/            # Cross-tab navigation intent
|-- types/            # Shared TypeScript types
|-- App.tsx           # Root state, authentication stage, and app shell
|-- index.css         # Global styles and Tailwind import
`-- main.tsx          # React entry point
```

Imports flow from foundational modules toward the application shell:

```text
types/constants/data/state -> shared components -> features -> layout -> App.tsx
```

Use the `@/` alias for imports across folders and relative imports for files in
the same folder. Feature modules expose their public API through `index.ts`.

For the complete folder map and guidance on adding tabs, modals, shared UI, and
seed data, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Data and backend status

Seed records live in `src/data/` and are copied into React state by `App.tsx`.
Actions update only the current browser session. In particular:

- Credentials are not stored and login is not connected to an identity provider.
- Uploaded files are not persisted; the UI only simulates upload progress.
- Payment actions do not transfer money or call a payment provider.
- BIR and social-account indicators are references, not verified guarantees.
- Refreshing the browser restores the original seed data.

The proposed database and integration work is documented in
[SUPABASE-WIRING-PLAN.md](./SUPABASE-WIRING-PLAN.md). Do not treat that plan as
an implemented production configuration.

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
- [SUPABASE-WIRING-PLAN.md](./SUPABASE-WIRING-PLAN.md) — proposed backend integration

## Known prototype limitations

- Claim quantities do not consistently update totals and remaining stock.
- Header search has navigation and dismissal edge cases.
- Orders and Reports screens exist but are not exposed in the main tab bar.
- Some payment-history fields and dates are still placeholder values.
- Accessibility work remains for contrast, form labels, and page headings.

## Production readiness

Before deploying KARGO for real transactions, implement server-side
authentication and authorization, persistent storage, secure file handling,
payment-provider integration, input validation, audit logging, secrets
management, and automated tests. Complete an independent privacy and security
review before accepting personal documents or payment evidence.
