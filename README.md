# KARGO

[![Live Demo](https://img.shields.io/badge/Live%20Demo-kargo--psi.vercel.app-191ba9?style=for-the-badge)](https://kargo-psi.vercel.app/)
![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-ready-3ecf8e?logo=supabase&logoColor=white)

<p align="center">
  <img src="./public/kargo-logo-head.png" alt="KARGO logo" width="96" />
</p>

KARGO is a centralized pasabuy order-fulfillment workspace for Filipino buyers
and independent sellers. It replaces scattered spreadsheets, comment threads,
and Messenger chains with one clear flow—from discovering travel batches and
claiming items to payment review, fulfillment, and delivery updates.

**Try it now:** [kargo-psi.vercel.app](https://kargo-psi.vercel.app/)

## See the experience

The product is designed around three connected flows:

| Buyer discovery | Seller operations | Trust and access |
| --- | --- | --- |
| Browse travel batches, inspect items, claim a slot, and track the order. | Create batches, review claims and payments, and move orders through fulfillment. | Admin tools support account access, moderation, and audit visibility. |

For a quick visual preview, open the [live demo](https://kargo-psi.vercel.app/)
and explore the Buyer Home, Batch Detail, Seller Fulfillment Board, and seller
onboarding flows.

## Core features

### For buyers

- Live travel-batch discovery with seller profiles, item photos, prices, and
  availability
- Item claiming with reservation deadlines, quantity limits, and waitlists
- Group orders for coordinating purchases
- Payment-proof submission and seller verification status
- Order tracking, notifications, delivery updates, and fulfillment history

### For sellers

- Guided seller onboarding and access approval
- Batch creation with trip dates, product photos, pricing, quantities, and
  waitlist limits
- Claim, payment, and extension-request review
- Fulfillment Kanban board for moving orders from payment to delivery
- Financial summaries, sales reporting, and buyer communication

### For administrators

- User, batch, transaction, and security views
- Seller and admin access management
- Batch moderation and account-status controls
- Payment review and auditable administrative actions

## How it works

- **Frontend:** React components are organized by product feature and shared
  through the application shell.
- **Data layer:** `kargoApi` keeps UI features independent from backend details.
- **Backend:** Supabase provides authentication, persistence, database rules,
  storage, and admin RPCs when configured.
- **Fallback:** Without environment keys, the app automatically uses seeded
  in-memory data so the complete product flow remains explorable locally.

See [ARCHITECTURE.md](./ARCHITECTURE.md) and
[DATABASE_FUNCTIONS.md](./DATABASE_FUNCTIONS.md) for implementation details.

## Quick start

```bash
git clone <repository-url>
cd KARGO_Order_Fulfillment_Platform
npm install
npm run dev
```

Open [http://localhost:8443](http://localhost:8443).

### Environment variables

For persistent authentication and data, copy `.env.example` to `.env.local`:

```text
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-or-anon-key>
```

If these values are omitted, KARGO runs in Demo Mode automatically.

### Evaluator shortcuts

When running locally without Supabase:

```text
Email: any valid email address
Password: password123
```

Useful preview routes:

```text
http://localhost:8443/?preview=original
http://localhost:8443/?preview=admin
```

The admin preview is available only in development builds. The deployed app
requires a real approved admin account.

## Tech stack

- React 19
- TypeScript 5.7
- Vite 8
- Tailwind CSS 4
- Supabase
- Lucide React
- oxfmt

## Documentation

- [PRODUCT.md](./PRODUCT.md) — product goals, audience, and priorities
- [DESIGN.md](./DESIGN.md) — visual language and interaction guidance
- [ARCHITECTURE.md](./ARCHITECTURE.md) — feature boundaries and project map
- [DATABASE_FUNCTIONS.md](./DATABASE_FUNCTIONS.md) — backend RPC reference
- [EMAILS.md](./EMAILS.md) — transactional email templates and behavior
- [WALKTHROUGH.md](./WALKTHROUGH.md) — product walkthrough

## Roadmap

KARGO’s next milestones are:

- Live payment-gateway integration and reconciliation
- Supabase Storage persistence for payment receipts and uploaded seller assets
- Automated end-to-end coverage for buyer, seller, and admin journeys
- Expanded delivery, notification, and reporting integrations

## Local checks

```bash
npm run typecheck
npm run build
```
