# KARGO Systemic Wiring Plan

## Agreed direction
The existing React 19 + Vite + Tailwind prototype will be repaired incrementally first. A separate architecture/rebuild track remains possible later, but it will not be mixed into the visual concept review. The target deployment is **Vercel + Supabase**. Seller BIR approval remains a prototype approval flag until an admin surface exists.

## Source of truth
Supabase Postgres becomes the source of truth for users, seller profiles, batches, products, claims, payments, extension requests, fulfillment orders, buyer requests, ratings, and notifications. React screens should read relational data through a small data-access layer rather than importing independent seed arrays.

```text
profiles ──< batches ──< batch_items ──< claims ──< payments
    │            │            │             │           │
    └── ratings  └── seller   └── inventory  └── buyer  └── notifications

claims ──< extension_requests
claims ── fulfillment_orders ── fulfillment_events
profiles ──< buyer_requests
```

## Core invariants
A claim must reference `batch_item_id`, `buyer_id`, and `seller_id`; product names are never identifiers. Inventory is derived from the batch item’s quantity and active claims, with an atomic database operation preventing over-claiming. A claim can enter `pending_payment`, `payment_submitted`, `paid_and_reserved`, `insufficient_payment`, `expired`, or `cancelled`, but the seller review step must be explicit. Every seller mutation checks ownership server-side, not only in the client. The displayed reservation deadline is stored on the claim at claim time and is never recomputed from a hardcoded 48-hour value.

## Recommended tables

| Table | Purpose | Important fields |
|---|---|---|
| `profiles` | Auth-linked identity and role | `id`, `display_name`, `role`, `seller_approval_status`, `created_at` |
| `seller_profiles` | Seller trust and payment configuration | `profile_id`, `shop_name`, `bir_status`, `facebook_url`, `member_since` |
| `payment_methods` | Current seller receiving accounts | `seller_id`, `method`, `account_name`, `account_number`, `is_active` |
| `batches` | Seller-owned trips/hauls | `id`, `seller_id`, `title`, `status`, `reserve_hours`, `starts_at`, `ends_at` |
| `batch_items` | Inventory and price source | `id`, `batch_id`, `name`, `base_price`, `markup`, `selling_price`, `quantity_total` |
| `claims` | Buyer reservation and lifecycle | `id`, `batch_item_id`, `buyer_id`, `seller_id`, `quantity`, `status`, `expires_at` |
| `payments` | Submitted payment evidence and seller decision | `id`, `claim_id`, `amount_paid`, `amount_due`, `phone`, `reference`, `status`, `reviewed_at` |
| `extension_requests` | Buyer request / seller decision | `id`, `claim_id`, `requested_hours`, `status`, `reviewed_by` |
| `fulfillment_orders` | Seller-facing fulfillment state | `id`, `claim_id`, `status`, `tracking_number`, `eta` |
| `ratings` | Transaction-backed reviews | `id`, `order_id`, `from_profile_id`, `to_profile_id`, `score`, `comment` |
| `notifications` | Durable cross-role updates | `id`, `profile_id`, `type`, `payload`, `read_at` |

## Repair sequence

### Phase 1 — Relational state and inventory
Replace product-name matching with IDs. Add a shared repository interface and Supabase adapters. Implement an atomic `claim_batch_item` RPC that checks remaining inventory, creates the claim, and returns the authoritative expiration time. Update buyer batches, My Claims, seller Orders Received, and dashboard counts to consume the same claim records.

### Phase 2 — Payment verification
Change Pay Now to create a `payment_submitted` record rather than immediately marking the claim paid. Seller review reads the actual buyer submission and the seller’s configured receiving account. Underpayment creates `insufficient_payment`, stores the calculated shortfall, and inserts a buyer notification. Mark as Paid transitions the claim only after review.

### Phase 3 — Ownership, extensions, and requests
Enforce seller ownership through Supabase Row Level Security and server-side mutation checks. Persist extension requests and buyer requests. Approval updates the real claim expiration timestamp and emits a notification. No client-only flag should represent a workflow decision.

### Phase 4 — Fulfillment and ratings
Make the fulfillment board a view over `fulfillment_orders`, with status changes producing fulfillment events. Aggregate ratings from completed transaction records; do not stamp new batches with a default 5.0 rating. Keep BIR approval as a visible prototype flag until an admin surface is added.

### Phase 5 — Session, timers, and accessibility
Add Supabase Auth session persistence. Use a shared time source and re-render countdowns on an interval. Add accessible names, keyboard interaction, non-color status markers, real image alt text, and error/empty/loading states across the repaired flows.

## Delivery boundaries
The current clickable concept prototypes are review-only and do not change production behavior. After one visual direction is selected, the chosen system can be applied to the existing UI while the transactional work proceeds incrementally underneath it. A future architecture rebuild can then reuse the same relational contracts instead of recreating isolated demo arrays.
